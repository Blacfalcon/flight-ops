import { describe, expect, it } from 'vitest';
import { validateCrew, eligibleForSeat, pilotInCommandSeat, type CrewMember } from '../src/lib/rules/pairing';
import { computeRisk, weatherRatingFrom } from '../src/lib/rules/risk';
import { parseWeather } from '../src/lib/weather/metar';
import { localToUtc, localDate, localTime, weekStart } from '../src/lib/time';
import { toBoth } from '../src/lib/fuel';
import { permissionsFor, rolesFor } from '../src/lib/rbac';
import { formatHours, parseHours } from '../src/lib/hours';
import { blankForm, composeMetar } from '../src/lib/weather/compose';
import { describeConditions } from '../src/lib/weather/plain';
import { entryProblem, expiresAt, isExpired } from '../src/lib/weather/validity';

const ip: CrewMember = { userId: 'ip', seat: 'INSTRUCTOR', flightStatus: 'CAPTAIN', pilotCategory: 'INSTRUCTOR' };
const tp: CrewMember = { userId: 'tp', seat: 'TRAINEE', flightStatus: 'CO_PILOT', pilotCategory: 'TRAINEE' };
const cap: CrewMember = { userId: 'c', seat: 'CAPTAIN', flightStatus: 'CAPTAIN', pilotCategory: 'NIL' };
const cp: CrewMember = { userId: 'cp', seat: 'CO_PILOT', flightStatus: 'CO_PILOT', pilotCategory: 'NIL' };

describe('crew pairing', () => {
  it('accepts instructor + trainee', () => expect(validateCrew([ip, tp])).toEqual([]));
  it('accepts captain + co-pilot', () => expect(validateCrew([cap, cp])).toEqual([]));
  it('accepts instructor + co-pilot', () => expect(validateCrew([ip, { ...cp }])).toEqual([]));
  it('rejects a trainee without an instructor', () => {
    expect(validateCrew([cap, tp]).map((e) => e.message)).toContain('A Trainee Pilot must fly with an Instructor Pilot.');
  });
  it('rejects a co-pilot without a captain or instructor', () => {
    const errors = validateCrew([cp, tp]).map((e) => e.message);
    expect(errors).toContain('A Co-Pilot must fly with an Instructor Pilot or a Captain.');
  });
  it('rejects a single crew member', () => expect(validateCrew([cap]).some((e) => e.field === 'crew')).toBe(true));
  it('rejects the wrong person in a seat', () => {
    expect(eligibleForSeat('INSTRUCTOR', { flightStatus: 'CAPTAIN', pilotCategory: 'NIL' })).toBe(false);
    expect(eligibleForSeat('CAPTAIN', { flightStatus: 'CO_PILOT', pilotCategory: 'NIL' })).toBe(false);
  });
  it('picks the pilot in command', () => {
    expect(pilotInCommandSeat(['TRAINEE', 'INSTRUCTOR'])).toBe('INSTRUCTOR');
    expect(pilotInCommandSeat(['CO_PILOT', 'CAPTAIN'])).toBe('CAPTAIN');
  });
});

const T = { lowMax: 16, mediumMax: 26, softImsafePoints: 2 };
const clear = { illness: false, medication: false, stress: false, alcohol: false, fatigue: false, eating: false };
const ones = { weather: 2, aircraftCondition: 2, crewReadiness: 2, missionComplexity: 2, fuelStatus: 2, terrain: 2, fatigue: 2, operationalThreats: 1 };

describe('risk scoring', () => {
  it('scores Low', () => expect(computeRisk(ones, [clear], T)).toMatchObject({ score: 15, level: 'LOW' }));
  it('scores Medium by total', () => expect(computeRisk({ ...ones, weather: 3, terrain: 3, operationalThreats: 2 }, [clear], T).level).toBe('MEDIUM'));
  it('raises any 5 to at least Medium', () => expect(computeRisk({ ...ones, operationalThreats: 5 }, [clear], T).level).toBe('MEDIUM'));
  it('raises three 4s to High', () => expect(computeRisk({ ...ones, weather: 4, fatigue: 4, terrain: 4 }, [clear], T).level).toBe('HIGH'));
  it('makes illness, medication or alcohol High', () => expect(computeRisk(ones, [{ ...clear, medication: true }], T).level).toBe('HIGH'));
  it('adds points for stress, fatigue, eating', () => expect(computeRisk(ones, [{ ...clear, stress: true }], T).score).toBe(17));
  it('needs mitigation when a category is 4+', () => expect(computeRisk({ ...ones, weather: 4 }, [clear], T).mitigationRequired).toBe(true));
});

describe('weather', () => {
  const m = parseWeather('METAR DNEN 151900Z 24008G18KT 8000 SCT018 BKN030 27/23 Q1011', 'METAR', new Date('2026-10-15T20:00:00Z'));
  it('parses the main groups', () => {
    expect(m).toMatchObject({ station: 'DNEN', windDir: 240, windSpeedKt: 8, gustKt: 18, visibilityM: 8000, temperatureC: 27, dewpointC: 23, qnhHpa: 1011, ceilingFt: 3000 });
    expect(m.observedAt?.toISOString()).toBe('2026-10-15T19:00:00.000Z');
  });
  it('handles CAVOK and minus temperatures', () => {
    const c = parseWeather('DNEN 151900Z VRB03KT CAVOK M02/M05 Q1020', 'METAR');
    expect(c).toMatchObject({ windDir: null, visibilityM: 10000, temperatureC: -2, dewpointC: -5, ceilingFt: null });
  });
  it('reads only the base TAF period', () => {
    const t = parseWeather('TAF DNEN 151700Z 1518/1618 23008KT 8000 SCT018 TEMPO 1600/1608 4000 BR', 'TAF', new Date('2026-10-15T17:30:00Z'));
    expect(t.visibilityM).toBe(8000);
    expect(t.validFrom?.toISOString()).toBe('2026-10-15T18:00:00.000Z');
  });
  const minima = { visibilityM: 5000, ceilingFt: 1500, nightVisibilityM: 5000, nightCeilingFt: 1500 };
  it('rates weather against minima', () => {
    expect(weatherRatingFrom({ visibilityM: 4000, ceilingFt: null }, minima, false).rating).toBe(5);
    expect(weatherRatingFrom({ visibilityM: 10000, ceilingFt: null }, minima, false).rating).toBe(1);
    expect(weatherRatingFrom({ visibilityM: 10000, ceilingFt: 2500 }, minima, false).rating).toBe(2);
    expect(weatherRatingFrom({ visibilityM: 10000, ceilingFt: 2000 }, minima, false).rating).toBe(3);
    expect(weatherRatingFrom({ visibilityM: 5500, ceilingFt: null }, minima, false).rating).toBe(4);
    expect(weatherRatingFrom(null, minima, false).rating).toBe(3);
  });
});

describe('time (WAT, UTC+1)', () => {
  it('converts local to UTC and back', () => {
    const d = localToUtc('2026-10-16', '07:30');
    expect(d.toISOString()).toBe('2026-10-16T06:30:00.000Z');
    expect(localTime(d)).toBe('07:30');
    expect(localDate(localToUtc('2026-10-16', '00:30'))).toBe('2026-10-16');
  });
  it('finds the Monday of a week', () => expect(weekStart('2026-10-18')).toBe('2026-10-12'));
});

describe('fuel', () => {
  it('converts kg and litres', () => {
    expect(toBoth(800, 'kg', 0.8)).toEqual({ kg: 800, l: 1000 });
    expect(toBoth(1000, 'l', 0.8)).toEqual({ kg: 800, l: 1000 });
  });
});

describe('roles', () => {
  it('gives the GOO pilot rights unless acting', () => {
    const goo = { appointment: 'GOO', flightStatus: 'CAPTAIN' };
    expect(permissionsFor(rolesFor(goo, { actingCommander: false })).has('risk.approve')).toBe(false);
    expect(permissionsFor(rolesFor(goo, { actingCommander: true })).has('risk.approve')).toBe(true);
  });
  it('gives an Ops Officer who flies both sets of rights', () => {
    const p = permissionsFor(rolesFor({ appointment: 'OPERATIONS_OFFICER', flightStatus: 'CAPTAIN' }, { actingCommander: false }));
    expect(p.has('mission.publish') && p.has('risk.submit')).toBe(true);
  });
  it('limits approvals, publishing and report export to the right people', () => {
    const roles = (appointment: string) => permissionsFor(rolesFor({ appointment, flightStatus: 'NONE' }, { actingCommander: false }));
    expect(roles('CO_ENGINEERING').has('risk.approve')).toBe(false);
    expect(roles('OPERATIONS_OFFICER').has('risk.approve')).toBe(false);
    expect(roles('CO_FLYING_WING').has('order.approve')).toBe(true);
    expect(roles('TRAINING_OFFICER').has('mission.publish')).toBe(false);
    expect(roles('SAFETY_OFFICER').has('summary.export')).toBe(false);
    expect(roles('SAFETY_OFFICER').has('summary.exportSafety')).toBe(true);
    expect(roles('ADMIN').has('summary.export')).toBe(false);
  });
});

describe('hours as HH:MM', () => {
  it('round-trips whole minutes', () => {
    expect(parseHours('1234:30')).toBe(1234.5);
    expect(formatHours(parseHours('85:20'))).toBe('85:20');
    expect(formatHours(0.75)).toBe('0:45');
    expect(parseHours('12:75')).toBe(null);
  });
});

describe('weather', () => {
  it('builds a METAR from the form and reads it back in plain English', () => {
    const f = { ...blankForm('DNAA', new Date('2026-10-19T14:12:00Z')), windDir: '240', windSpeed: '8', visibilityM: '8000', weather: ['-SHRA'], clouds: [{ cover: 'BKN' as const, baseFt: '3000', type: 'CB' as const }], temp: '27', dew: '23', qnh: '1011' };
    const { code, errors } = composeMetar(f);
    expect(Object.keys(errors).length).toBe(0);
    expect(code).toBe('METAR DNAA 191400Z 24008KT 8000 -SHRA BKN030CB 27/23 Q1011=');
    const p = parseWeather(code, 'METAR');
    expect(p.ceilingFt).toBe(3000);
    expect(describeConditions(p)).toContain('Light showers of rain');
  });
});

describe('weather validity', () => {
  it('expires a METAR one hour after observation and refuses old ones', () => {
    const obs = new Date('2026-10-19T14:00:00Z');
    expect(expiresAt({ kind: 'METAR', observedAt: obs, validTo: null, createdAt: obs }).toISOString()).toBe('2026-10-19T15:00:00.000Z');
    expect(isExpired({ kind: 'METAR', observedAt: obs, validTo: null, createdAt: obs }, new Date('2026-10-19T15:01:00Z'))).toBe(true);
    expect(entryProblem({ kind: 'METAR', observedAt: obs, validFrom: null, validTo: null }, new Date('2026-10-19T15:30:00Z'))).toContain('expired');
    expect(entryProblem({ kind: 'METAR', observedAt: obs, validFrom: null, validTo: null }, new Date('2026-10-19T14:20:00Z'))).toBe(null);
  });
  it('uses the TAF validity period, at most 30 hours', () => {
    const from = new Date('2026-10-19T12:00:00Z');
    expect(entryProblem({ kind: 'TAF', observedAt: from, validFrom: from, validTo: new Date('2026-10-20T18:00:00Z') }, from)).toBe(null);
    expect(entryProblem({ kind: 'TAF', observedAt: from, validFrom: from, validTo: new Date('2026-10-20T20:00:00Z') }, from)).toContain('30 hours');
    expect(isExpired({ kind: 'TAF', observedAt: from, validTo: new Date('2026-10-20T18:00:00Z'), createdAt: from }, new Date('2026-10-20T18:00:00Z'))).toBe(true);
  });
});
