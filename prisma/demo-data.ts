/**
 * Demo data for briefings and presentations.
 *
 * Adds a complete, fictional picture of the unit so the app can be shown working: 20 pilots, a
 * CO Engineering and an Engineering Officer, aircraft HEL-501 to HEL-515, a week of sorties (flown, today and planned), mission
 * orders, risk assessments, flight plans, snags, safety reports and home-aerodrome weather. All names, service
 * numbers, phone numbers and events are made up.
 *
 * It only ADDS records, and keeps a list of everything it added, so `remove` takes out exactly that
 * (plus anything people did with the demo people or aircraft while showing the app) and leaves all
 * other data as it was. No app file is changed.
 *
 *   npx tsx prisma/demo-data.ts add      add the demo data (if it is already there, it is refreshed)
 *   npx tsx prisma/demo-data.ts metar    enter a fresh METAR for the home aerodrome (a METAR is valid for one hour)
 *   npx tsx prisma/demo-data.ts remove   remove all demo data
 *
 * Run `add` an hour or two before the briefing: today's sorties are timed from the moment you run it.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { computeRisk, type Imsafe, type Ratings } from '../src/lib/rules/risk';
import { pilotInCommandSeat, validateCrew, type CrewMember } from '../src/lib/rules/pairing';
import { parseWeather } from '../src/lib/weather/metar';
import { splitName } from '../src/lib/names';
import { addDays, dateOnly, localDate, localToUtc } from '../src/lib/time';
import { MISSION_CATEGORY_PREFIX } from '../src/lib/constants';

// ───────────────────────────── Setup ─────────────────────────────

/** Load .env from the project folder (only for variables not already set). */
function loadEnv() {
  for (const file of [path.join(process.cwd(), '.env'), path.join(__dirname, '..', '.env')]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m || process.env[m[1]] !== undefined) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
    return;
  }
}

export const DEMO_DOMAIN = 'demo.example.com';
const MANIFEST_KEY = 'demo.data';
const MIN = 60_000;

type Seat = CrewMember['seat'];
type Tx = Prisma.TransactionClient;

export type Manifest = {
  createdAt: string;
  userIds: string[];
  aircraftIds: string[];
  missionIds: string[];
  weatherIds: string[];
  safetyReportIds: string[];
  delegationIds: string[];
  changeRequestIds: string[];
};

// ───────────────────────────── People ─────────────────────────────

type PersonKey =
  | 'CMD' | 'GOO' | 'COFW' | 'COENG' | 'OPSO' | 'TRGO' | 'SAFO'
  | 'IP1' | 'IP2' | 'IP3' | 'C1' | 'C2' | 'C3' | 'C4' | 'CP1' | 'CP2' | 'CP3' | 'TP1' | 'TP2' | 'TP3' | 'TP4' | 'ENGO';

type PersonDef = {
  key: PersonKey;
  rank: Prisma.UserCreateManyInput['rank'];
  name: string;
  appointment: Prisma.UserCreateManyInput['appointment'];
  flightStatus: 'CAPTAIN' | 'CO_PILOT' | 'NONE';
  pilotCategory: 'INSTRUCTOR' | 'TRAINEE' | 'NIL';
};

export const PEOPLE: PersonDef[] = [
  { key: 'CMD', rank: 'GROUP_CAPTAIN', name: 'Olumide Bankole', appointment: 'COMMANDER', flightStatus: 'CAPTAIN', pilotCategory: 'INSTRUCTOR' },
  { key: 'GOO', rank: 'WING_COMMANDER', name: 'Chukwuemeka Obi', appointment: 'GOO', flightStatus: 'CAPTAIN', pilotCategory: 'INSTRUCTOR' },
  { key: 'COFW', rank: 'WING_COMMANDER', name: 'Aisha Bello', appointment: 'CO_FLYING_WING', flightStatus: 'CAPTAIN', pilotCategory: 'INSTRUCTOR' },
  { key: 'COENG', rank: 'WING_COMMANDER', name: 'Ibrahim Danjuma', appointment: 'CO_ENGINEERING', flightStatus: 'NONE', pilotCategory: 'NIL' },
  { key: 'OPSO', rank: 'SQUADRON_LEADER', name: 'Tamunotonye Briggs', appointment: 'OPERATIONS_OFFICER', flightStatus: 'CAPTAIN', pilotCategory: 'NIL' },
  { key: 'TRGO', rank: 'SQUADRON_LEADER', name: 'Funmilayo Ogunleye', appointment: 'TRAINING_OFFICER', flightStatus: 'CAPTAIN', pilotCategory: 'INSTRUCTOR' },
  { key: 'SAFO', rank: 'FLIGHT_LIEUTENANT', name: 'Emeka Nwosu', appointment: 'SAFETY_OFFICER', flightStatus: 'CAPTAIN', pilotCategory: 'NIL' },
  { key: 'IP1', rank: 'SQUADRON_LEADER', name: 'Yusuf Abubakar', appointment: 'SQUADRON_PILOT', flightStatus: 'CAPTAIN', pilotCategory: 'INSTRUCTOR' },
  { key: 'IP2', rank: 'FLIGHT_LIEUTENANT', name: 'Ngozi Eze', appointment: 'SQUADRON_PILOT', flightStatus: 'CAPTAIN', pilotCategory: 'INSTRUCTOR' },
  { key: 'IP3', rank: 'FLIGHT_LIEUTENANT', name: 'Tunde Afolabi', appointment: 'SQUADRON_PILOT', flightStatus: 'CAPTAIN', pilotCategory: 'INSTRUCTOR' },
  { key: 'C1', rank: 'FLIGHT_LIEUTENANT', name: 'Sani Garba', appointment: 'SQUADRON_PILOT', flightStatus: 'CAPTAIN', pilotCategory: 'NIL' },
  { key: 'C2', rank: 'FLIGHT_LIEUTENANT', name: 'Ebiere Alagoa', appointment: 'SQUADRON_PILOT', flightStatus: 'CAPTAIN', pilotCategory: 'NIL' },
  { key: 'C3', rank: 'FLIGHT_LIEUTENANT', name: 'Kelechi Okafor', appointment: 'SQUADRON_PILOT', flightStatus: 'CAPTAIN', pilotCategory: 'NIL' },
  { key: 'C4', rank: 'FLIGHT_LIEUTENANT', name: 'Halima Musa', appointment: 'SQUADRON_PILOT', flightStatus: 'CAPTAIN', pilotCategory: 'NIL' },
  { key: 'CP1', rank: 'FLYING_OFFICER', name: 'Daniel Ekpo', appointment: 'SQUADRON_PILOT', flightStatus: 'CO_PILOT', pilotCategory: 'NIL' },
  { key: 'CP2', rank: 'FLYING_OFFICER', name: 'Zainab Lawal', appointment: 'SQUADRON_PILOT', flightStatus: 'CO_PILOT', pilotCategory: 'NIL' },
  { key: 'CP3', rank: 'FLYING_OFFICER', name: 'Ifeanyi Uche', appointment: 'SQUADRON_PILOT', flightStatus: 'CO_PILOT', pilotCategory: 'NIL' },
  { key: 'TP1', rank: 'PILOT_OFFICER', name: 'Seun Adebayo', appointment: 'SQUADRON_PILOT', flightStatus: 'CO_PILOT', pilotCategory: 'TRAINEE' },
  { key: 'TP2', rank: 'PILOT_OFFICER', name: 'Blessing Okon', appointment: 'SQUADRON_PILOT', flightStatus: 'CO_PILOT', pilotCategory: 'TRAINEE' },
  { key: 'TP3', rank: 'FLYING_OFFICER', name: 'Musa Shehu', appointment: 'SQUADRON_PILOT', flightStatus: 'CO_PILOT', pilotCategory: 'TRAINEE' },
  { key: 'TP4', rank: 'PILOT_OFFICER', name: 'Precious Amadi', appointment: 'SQUADRON_PILOT', flightStatus: 'CO_PILOT', pilotCategory: 'TRAINEE' },
  { key: 'ENGO', rank: 'FLIGHT_LIEUTENANT', name: 'Chinedu Okeke', appointment: 'ENGINEERING_OFFICER', flightStatus: 'NONE', pilotCategory: 'NIL' },
];

export function personEmail(p: PersonDef) {
  return `${p.name.toLowerCase().replace(/[^a-z ]/g, '').trim().replace(/\s+/g, '.')}@${DEMO_DOMAIN}`;
}
export function personNaf(i: number) {
  return `SVC/${9101 + i}`;
}
function personPhone(i: number) {
  return `+234800000${String(101 + i).padStart(4, '0')}`;
}

// Who fills which seat. Commander and CO Flying Wing approve, so they are never crewed.
const POOLS: Record<'IP' | 'TP' | 'C' | 'CP' | 'CHECKED', PersonKey[]> = {
  IP: ['TRGO', 'IP1', 'IP2', 'IP3', 'GOO'],
  TP: ['TP1', 'TP2', 'TP3', 'TP4'],
  C: ['C1', 'C2', 'C3', 'C4', 'SAFO'],
  CP: ['CP1', 'CP2', 'CP3'],
  CHECKED: ['C3', 'OPSO', 'C1', 'SAFO', 'C4', 'C2'], // captains having a check ride
};

// ───────────────────────────── Aircraft ─────────────────────────────

type AircraftDef = {
  reg: string;
  type: string;
  burnKgPerH: number;
  endHours: number; // flying hours after the demo week
  endToNext: number; // hours to next inspection after the demo week; 'limit' aircraft run out on their last flight
  limit?: boolean;
  lastInspDays: number; // days before today
};

export const AIRCRAFT: AircraftDef[] = [
  { reg: 'HEL-501', type: 'AW109 Power', burnKgPerH: 270, endHours: 2140.5, endToNext: 62.3, lastInspDays: 40 },
  { reg: 'HEL-502', type: 'AW109 Power', burnKgPerH: 270, endHours: 1876.2, endToNext: 41.0, lastInspDays: 55 },
  { reg: 'HEL-503', type: 'AW109 Power', burnKgPerH: 270, endHours: 2410.8, endToNext: 7.5, lastInspDays: 110 },
  { reg: 'HEL-504', type: 'AW109 Power', burnKgPerH: 270, endHours: 1520.0, endToNext: 88.4, lastInspDays: 20 },
  { reg: 'HEL-505', type: 'AW109 Power', burnKgPerH: 270, endHours: 998.7, endToNext: 95.0, lastInspDays: 9 },
  { reg: 'HEL-506', type: 'AW109 Power', burnKgPerH: 270, endHours: 2265.3, endToNext: 54.1, lastInspDays: 60 },
  { reg: 'HEL-507', type: 'Bell 412EP', burnKgPerH: 330, endHours: 3320.4, endToNext: 30.2, lastInspDays: 80 },
  { reg: 'HEL-508', type: 'Bell 412EP', burnKgPerH: 330, endHours: 2988.0, endToNext: 71.6, lastInspDays: 35 },
  { reg: 'HEL-509', type: 'Bell 412EP', burnKgPerH: 330, endHours: 3105.5, endToNext: 18.9, lastInspDays: 95 },
  { reg: 'HEL-510', type: 'Bell 412EP', burnKgPerH: 330, endHours: 3410.0, endToNext: 0, limit: true, lastInspDays: 170 },
  { reg: 'HEL-511', type: 'Mi-171E', burnKgPerH: 750, endHours: 1420.2, endToNext: 66.0, lastInspDays: 50 },
  { reg: 'HEL-512', type: 'Mi-171E', burnKgPerH: 750, endHours: 1611.8, endToNext: 45.5, lastInspDays: 70 },
  { reg: 'HEL-513', type: 'Mi-171E', burnKgPerH: 750, endHours: 980.4, endToNext: 92.3, lastInspDays: 12 },
  { reg: 'HEL-514', type: 'Mi-171E', burnKgPerH: 750, endHours: 1755.0, endToNext: 0, limit: true, lastInspDays: 100 },
  { reg: 'HEL-515', type: 'Mi-171E', burnKgPerH: 750, endHours: 1203.6, endToNext: 77.7, lastInspDays: 30 },
];
const INTERVAL_H = 100;
const INTERVAL_DAYS = 180;

// Status changes made by CO Engineering during the week (day offset, local time).
const STATUS_EVENTS: Array<{ reg: string; day: number; at: string; status: 'SERVICEABLE' | 'UNSERVICEABLE' | 'UNDER_MAINTENANCE'; remarks: string }> = [
  { reg: 'HEL-510', day: -5, at: '07:30', status: 'UNDER_MAINTENANCE', remarks: '100-hour inspection in progress. Expected back in two days.' },
  { reg: 'HEL-502', day: -3, at: '17:00', status: 'UNSERVICEABLE', remarks: 'Pitot heat caution. Awaiting replacement heater element.' },
  { reg: 'HEL-502', day: -1, at: '10:00', status: 'SERVICEABLE', remarks: 'Pitot heater replaced. Air test required before tasking.' },
  { reg: 'HEL-506', day: -2, at: '12:30', status: 'UNSERVICEABLE', remarks: 'No.2 engine chip detector caution in flight. Chip detector and engine borescope inspection in progress.' },
];

// ───────────────────────────── Sorties ─────────────────────────────

type CrewKind = 'IP_TP' | 'IP_C' | 'IP_CP' | 'C_CP';
type Outcome = 'COMPLETED' | 'ABORTED' | 'CANCELLED' | 'CLEARED' | 'RISK_SUBMITTED' | 'CREW_READY' | 'PUBLISHED' | 'PLANNED';
type RiskPreset = keyof typeof RISK;

type Tpl = {
  day: number;
  at?: string; // local take-off time (past and future days)
  rel?: number; // minutes from now (today)
  cat: 'TRAINING' | 'OPERATIONAL';
  type: string;
  name: string;
  crew: CrewKind;
  fixed?: Partial<Record<Seat, PersonKey>>;
  ac: string;
  planned: number; // minutes
  actual?: number; // minutes flown (default: planned with a small variation)
  outcome: Outcome;
  order?: 'APPROVED' | 'SUBMITTED' | 'REJECTED'; // future sorties
  risk: RiskPreset;
  fp?: { dest: string; route: string; alt: string; status?: 'DRAFT' | 'SUBMITTED' | 'APPROVED' };
  note?: 'rejectedFirst' | 'softImsafe' | 'notAvailable';
  cancel?: string;
  abort?: string;
};

const RISK = {
  routine: { weather: 1, aircraftCondition: 1, crewReadiness: 2, missionComplexity: 2, fuelStatus: 1, terrain: 1, fatigue: 1, operationalThreats: 1 },
  ep: { weather: 1, aircraftCondition: 1, crewReadiness: 3, missionComplexity: 3, fuelStatus: 1, terrain: 1, fatigue: 1, operationalThreats: 1 },
  nav: { weather: 2, aircraftCondition: 1, crewReadiness: 2, missionComplexity: 3, fuelStatus: 2, terrain: 2, fatigue: 1, operationalThreats: 1 },
  confined: { weather: 2, aircraftCondition: 1, crewReadiness: 2, missionComplexity: 3, fuelStatus: 1, terrain: 3, fatigue: 1, operationalThreats: 1 },
  night: { weather: 3, aircraftCondition: 1, crewReadiness: 3, missionComplexity: 4, fuelStatus: 1, terrain: 2, fatigue: 2, operationalThreats: 1 },
  winch: { weather: 2, aircraftCondition: 1, crewReadiness: 3, missionComplexity: 4, fuelStatus: 1, terrain: 3, fatigue: 1, operationalThreats: 1 },
  check: { weather: 1, aircraftCondition: 1, crewReadiness: 2, missionComplexity: 2, fuelStatus: 1, terrain: 1, fatigue: 1, operationalThreats: 1 },
  logistics: { weather: 2, aircraftCondition: 1, crewReadiness: 2, missionComplexity: 3, fuelStatus: 2, terrain: 3, fatigue: 2, operationalThreats: 3 },
  recce: { weather: 2, aircraftCondition: 1, crewReadiness: 2, missionComplexity: 3, fuelStatus: 2, terrain: 3, fatigue: 2, operationalThreats: 2 },
  casevac: { weather: 2, aircraftCondition: 1, crewReadiness: 2, missionComplexity: 4, fuelStatus: 2, terrain: 3, fatigue: 2, operationalThreats: 2 },
  sar: { weather: 3, aircraftCondition: 1, crewReadiness: 2, missionComplexity: 4, fuelStatus: 2, terrain: 4, fatigue: 2, operationalThreats: 1 },
  gfs: { weather: 2, aircraftCondition: 2, crewReadiness: 2, missionComplexity: 4, fuelStatus: 2, terrain: 4, fatigue: 2, operationalThreats: 4 },
  vip: { weather: 1, aircraftCondition: 1, crewReadiness: 1, missionComplexity: 2, fuelStatus: 1, terrain: 2, fatigue: 1, operationalThreats: 2 },
  airtest: { weather: 1, aircraftCondition: 2, crewReadiness: 2, missionComplexity: 3, fuelStatus: 1, terrain: 1, fatigue: 1, operationalThreats: 1 },
  ferry: { weather: 2, aircraftCondition: 1, crewReadiness: 1, missionComplexity: 2, fuelStatus: 2, terrain: 2, fatigue: 2, operationalThreats: 1 },
} satisfies Record<string, Ratings>;

const MITIGATIONS: Partial<Record<RiskPreset, string>> = {
  night: 'Instructor to brief night illusions and the go-around plan. Two circuits before departing the circuit. Landing light and searchlight checked serviceable.',
  winch: 'Safety boat on station before hoisting starts. Hoist operator current. Hover references briefed; abort if wind exceeds 20 kt.',
  casevac: 'Medical team briefed on loading and seating. Landing site confirmed clear by ground party by radio before approach.',
  sar: 'Fuel planned for search plus 30 minutes. Life jackets and life raft on board. Search pattern and lost-contact procedure briefed with the ground station.',
  gfs: 'Threat update from the ground force commander before lift. Alternate landing site identified. Second aircraft on standby at DNAA. Door gunner briefed on rules of engagement.',
  logistics: 'Route avoids known threat areas. Landing site confirmed clear by the ground party before approach.',
  recce: 'Minimum height 500 ft over built-up areas. Route and timings passed to ground stations.',
};

const OUTCOME_TEXT: Record<string, string> = {
  CIRCUITS_LANDINGS: 'All circuit exercises completed, including crosswind and limited-power approaches. Trainee progressing to standard.',
  INSTRUMENT_HOOD: 'Instrument general handling and approaches flown to standard. Unusual attitude recoveries satisfactory.',
  LOCAL_FAMILIARISATION: 'Local area features, reporting points and emergency landing sites covered.',
  EMERGENCY_PROCEDURES: 'Engine failure, tail rotor and autorotation exercises completed.',
  NIGHT_FLYING: 'Night circuits and local area flown. Trainee confident with night references.',
  NAVIGATION_EXERCISE: 'All turning points found on time. Fuel checks and position reports correct.',
  CONFINED_AREA_PINNACLE: 'Confined area recce and landings completed at three sites.',
  CONVERSION: 'Final conversion sortie flown to captaincy standard. Recommended for check ride.',
  CHECK_RIDE: 'Check ride passed. Handling, procedures and decision-making to standard.',
  WINCHING_SLING_LOAD: 'Winching over water completed: six lifts, two with the rescue strop.',
  AIR_MOBILITY: 'Troops lifted to the landing zone and returned. Timings achieved.',
  CASEVAC: 'Casualty drill completed with the medical team. Loading time 4 minutes.',
  RECCE_SURVEILLANCE: 'Surveillance of the assigned sector completed. Report passed to the Operations Officer.',
  LOGISTICS_RESUPPLY: 'Stores delivered to the forward operating base. Return load carried.',
  SEARCH_AND_RESCUE: 'Expanding square search flown; the exercise target was located on the second leg.',
  STAFF_VIP_TRANSPORT: 'Passengers delivered on time.',
  GROUND_FORCE_SUPPORT: 'Support provided to the ground force as tasked. No threats encountered.',
  AIR_TEST: 'Air test satisfactory. Pitot heat and airspeed indications normal. Aircraft serviceable.',
  FERRY: 'Ferry completed.',
};

const ORDER_TEXT: Record<string, [string, string]> = {
  CIRCUITS_LANDINGS: ['Circuit training for a trainee pilot at DNAA.', 'Normal, crosswind and limited-power approaches; go-arounds.'],
  INSTRUMENT_HOOD: ['Instrument flying under the hood.', 'General handling on instruments, unusual attitudes, instrument approach.'],
  LOCAL_FAMILIARISATION: ['Familiarisation with the local flying area.', 'Reporting points, landmarks and emergency landing sites.'],
  EMERGENCY_PROCEDURES: ['Emergency procedures training.', 'Simulated engine failure, autorotation, tail rotor malfunctions.'],
  NIGHT_FLYING: ['Night flying training.', 'Night circuits and local area navigation.'],
  NAVIGATION_EXERCISE: ['Navigation exercise along the planned route.', 'Map reading, timing, fuel management and position reporting.'],
  CONFINED_AREA_PINNACLE: ['Confined area and pinnacle landing training.', 'Site recce, power checks, approach and departure from confined sites.'],
  CONVERSION: ['Captaincy conversion training.', 'Captain-level handling, crew management and decision-making.'],
  CHECK_RIDE: ['Proficiency check ride.', 'Assess handling, procedures and decision-making against the standard.'],
  WINCHING_SLING_LOAD: ['Winching training over water.', 'Hover over water, hoist operations, rescue strop lifts.'],
  AIR_MOBILITY: ['Lift troops to the landing zone and return.', 'Deliver the troops safely and on time.'],
  CASEVAC: ['Casualty evacuation drill with the medical team.', 'Practise loading, in-flight care positions and handover.'],
  RECCE_SURVEILLANCE: ['Surveillance of the assigned sector.', 'Observe and report activity along the sector.'],
  LOGISTICS_RESUPPLY: ['Resupply of the forward operating base.', 'Deliver stores and carry the return load.'],
  SEARCH_AND_RESCUE: ['Search and rescue exercise.', 'Fly the search pattern and locate the exercise target.'],
  STAFF_VIP_TRANSPORT: ['Staff transport.', 'Carry the staff party safely and on time.'],
  GROUND_FORCE_SUPPORT: ['Support to the ground force in the sector.', 'Provide air support as directed by the ground force commander.'],
  AIR_TEST: ['Post-maintenance air test.', 'Confirm the rectification and the aircraft serviceable.'],
  FERRY: ['Ferry flight.', 'Deliver the aircraft safely.'],
};

const P = (dest: string, route: string, alt = 'DNMN', status?: 'DRAFT' | 'SUBMITTED' | 'APPROVED') => ({ dest, route, alt, status });

export const TEMPLATES: Tpl[] = [
  // 6 days ago
  { day: -6, at: '08:00', cat: 'TRAINING', type: 'CIRCUITS_LANDINGS', name: 'Circuit consolidation', crew: 'IP_TP', ac: 'HEL-501', planned: 60, outcome: 'COMPLETED', risk: 'routine' },
  { day: -6, at: '09:30', cat: 'TRAINING', type: 'INSTRUMENT_HOOD', name: 'Instrument flying, general handling', crew: 'IP_TP', ac: 'HEL-502', planned: 90, outcome: 'COMPLETED', risk: 'routine' },
  { day: -6, at: '11:00', cat: 'OPERATIONAL', type: 'LOGISTICS_RESUPPLY', name: 'Resupply to FOB Alpha', crew: 'C_CP', ac: 'HEL-511', planned: 120, outcome: 'COMPLETED', risk: 'logistics', fp: P('FOB ALPHA HLS', 'DNAA DCT FOB ALPHA DCT DNAA') },
  { day: -6, at: '14:00', cat: 'OPERATIONAL', type: 'RECCE_SURVEILLANCE', name: 'Area surveillance, Sector 2', crew: 'C_CP', ac: 'HEL-510', planned: 140, actual: 150, outcome: 'COMPLETED', risk: 'recce', fp: P('DNAA', 'DNAA SECTOR 2 AREA PATROL DNAA') },
  { day: -6, at: '15:30', cat: 'TRAINING', type: 'CHECK_RIDE', name: 'Annual proficiency check', crew: 'IP_C', ac: 'HEL-503', planned: 90, outcome: 'COMPLETED', risk: 'check' },
  // 5 days ago
  { day: -5, at: '08:00', cat: 'TRAINING', type: 'LOCAL_FAMILIARISATION', name: 'Local area familiarisation', crew: 'IP_TP', ac: 'HEL-504', planned: 75, outcome: 'COMPLETED', risk: 'routine' },
  { day: -5, at: '09:30', cat: 'TRAINING', type: 'EMERGENCY_PROCEDURES', name: 'Autorotation and EP practice', crew: 'IP_TP', ac: 'HEL-505', planned: 60, outcome: 'COMPLETED', risk: 'ep' },
  { day: -5, at: '11:00', cat: 'OPERATIONAL', type: 'AIR_MOBILITY', name: 'Troop lift, Exercise Sea Hawk', crew: 'C_CP', ac: 'HEL-512', planned: 120, outcome: 'COMPLETED', risk: 'logistics', fp: P('LZ SEA HAWK', 'DNAA DCT LZ SEA HAWK DCT DNAA') },
  { day: -5, at: '14:00', cat: 'OPERATIONAL', type: 'CASEVAC', name: 'CASEVAC drill with medical team', crew: 'C_CP', ac: 'HEL-508', planned: 90, outcome: 'COMPLETED', risk: 'casevac', note: 'softImsafe', fp: P('DNAA', 'DNAA DCT EXERCISE SITE ECHO DCT DNAA') },
  { day: -5, at: '19:30', cat: 'TRAINING', type: 'NIGHT_FLYING', name: 'Night circuits and local area', crew: 'IP_TP', ac: 'HEL-501', planned: 90, outcome: 'COMPLETED', risk: 'night' },
  // 4 days ago
  { day: -4, at: '08:00', cat: 'TRAINING', type: 'CIRCUITS_LANDINGS', name: 'Circuits, crosswind practice', crew: 'IP_TP', ac: 'HEL-502', planned: 60, outcome: 'COMPLETED', risk: 'routine' },
  { day: -4, at: '09:30', cat: 'TRAINING', type: 'NAVIGATION_EXERCISE', name: 'Navigation exercise, DNAA to Minna and Kaduna', crew: 'IP_TP', ac: 'HEL-503', planned: 120, outcome: 'COMPLETED', risk: 'nav', fp: P('DNAA', 'DNAA DCT DNMN DCT DNKA DCT DNAA', 'DNKA') },
  { day: -4, at: '11:00', cat: 'OPERATIONAL', type: 'GROUND_FORCE_SUPPORT', name: 'Ground force support, Sector 4', crew: 'C_CP', ac: 'HEL-513', planned: 120, outcome: 'COMPLETED', risk: 'gfs', fp: P('DNAA', 'DNAA SECTOR 4 DNAA') },
  { day: -4, at: '14:00', cat: 'OPERATIONAL', type: 'RECCE_SURVEILLANCE', name: 'Pipeline route surveillance, Sector 3', crew: 'C_CP', ac: 'HEL-509', planned: 150, actual: 40, outcome: 'ABORTED', risk: 'recce', abort: 'Weather: embedded CBs and heavy rain across the route 20 nm west of base. Returned to base.', fp: P('DNAA', 'DNAA SECTOR 3 PIPELINE ROUTE DNAA') },
  { day: -4, at: '15:30', cat: 'TRAINING', type: 'CONFINED_AREA_PINNACLE', name: 'Confined area landings', crew: 'IP_TP', ac: 'HEL-504', planned: 75, outcome: 'COMPLETED', risk: 'confined' },
  // 3 days ago (Commander away, GOO acting)
  { day: -3, at: '08:00', cat: 'TRAINING', type: 'CONVERSION', name: 'Captaincy conversion, final sortie', crew: 'IP_CP', fixed: { CO_PILOT: 'CP1' }, ac: 'HEL-505', planned: 90, outcome: 'COMPLETED', risk: 'ep' },
  { day: -3, at: '09:30', cat: 'TRAINING', type: 'WINCHING_SLING_LOAD', name: 'Winching practice over water', crew: 'IP_TP', ac: 'HEL-507', planned: 75, outcome: 'COMPLETED', risk: 'winch' },
  { day: -3, at: '11:00', cat: 'OPERATIONAL', type: 'STAFF_VIP_TRANSPORT', name: 'Staff movement to Kaduna', crew: 'C_CP', ac: 'HEL-501', planned: 90, outcome: 'CANCELLED', risk: 'vip', cancel: 'Staff movement postponed by Headquarters.' },
  { day: -3, at: '14:00', cat: 'OPERATIONAL', type: 'LOGISTICS_RESUPPLY', name: 'Resupply to FOB Bravo', crew: 'C_CP', ac: 'HEL-514', planned: 120, actual: 118, outcome: 'COMPLETED', risk: 'logistics', fp: P('FOB BRAVO HLS', 'DNAA DCT FOB BRAVO DCT DNAA') },
  { day: -3, at: '15:30', cat: 'TRAINING', type: 'CIRCUITS_LANDINGS', name: 'Circuits, limited-power approaches', crew: 'IP_TP', ac: 'HEL-502', planned: 60, outcome: 'COMPLETED', risk: 'routine' },
  // 2 days ago
  { day: -2, at: '08:00', cat: 'TRAINING', type: 'INSTRUMENT_HOOD', name: 'Instrument approaches', crew: 'IP_TP', ac: 'HEL-503', planned: 90, outcome: 'COMPLETED', risk: 'routine' },
  { day: -2, at: '09:30', cat: 'OPERATIONAL', type: 'SEARCH_AND_RESCUE', name: 'SAR exercise, river search pattern', crew: 'C_CP', ac: 'HEL-508', planned: 150, outcome: 'COMPLETED', risk: 'sar', fp: P('DNAA', 'DNAA SEARCH AREA KILO DNAA') },
  { day: -2, at: '11:00', cat: 'OPERATIONAL', type: 'AIR_MOBILITY', name: 'Troop lift, FOB Alpha rotation', crew: 'C_CP', ac: 'HEL-506', planned: 120, actual: 25, outcome: 'ABORTED', risk: 'logistics', abort: 'No.2 engine chip detector caution 15 minutes after take-off. Precautionary return to base.', fp: P('FOB ALPHA HLS', 'DNAA DCT FOB ALPHA DCT DNAA') },
  { day: -2, at: '14:00', cat: 'OPERATIONAL', type: 'LOGISTICS_RESUPPLY', name: 'Ration and water resupply', crew: 'C_CP', ac: 'HEL-515', planned: 120, outcome: 'COMPLETED', risk: 'logistics', fp: P('FOB CHARLIE HLS', 'DNAA DCT FOB CHARLIE DCT DNAA') },
  // yesterday
  { day: -1, at: '08:00', cat: 'TRAINING', type: 'LOCAL_FAMILIARISATION', name: 'Local area familiarisation', crew: 'IP_TP', ac: 'HEL-505', planned: 75, outcome: 'COMPLETED', risk: 'routine' },
  { day: -1, at: '09:30', cat: 'TRAINING', type: 'CHECK_RIDE', name: 'Instrument rating renewal', crew: 'IP_C', ac: 'HEL-501', planned: 90, outcome: 'COMPLETED', risk: 'check', note: 'rejectedFirst' },
  { day: -1, at: '11:00', cat: 'OPERATIONAL', type: 'RECCE_SURVEILLANCE', name: 'Area surveillance, Sector 1', crew: 'C_CP', ac: 'HEL-507', planned: 150, outcome: 'COMPLETED', risk: 'recce', fp: P('DNAA', 'DNAA SECTOR 1 AREA PATROL DNAA') },
  { day: -1, at: '14:00', cat: 'OPERATIONAL', type: 'LOGISTICS_RESUPPLY', name: 'Resupply to FOB Charlie', crew: 'C_CP', ac: 'HEL-514', planned: 105, actual: 124, outcome: 'COMPLETED', risk: 'logistics', fp: P('FOB CHARLIE HLS', 'DNAA DCT FOB CHARLIE DCT DNAA') },
  { day: -1, at: '15:30', cat: 'TRAINING', type: 'EMERGENCY_PROCEDURES', name: 'EP practice', crew: 'IP_TP', ac: 'HEL-504', planned: 60, outcome: 'CANCELLED', risk: 'ep', note: 'notAvailable', cancel: 'Trainee not available and no replacement before take-off.' },
  { day: -1, at: '16:30', cat: 'OPERATIONAL', type: 'AIR_TEST', name: 'Air test after pitot heater change', crew: 'C_CP', ac: 'HEL-502', planned: 45, outcome: 'COMPLETED', risk: 'airtest' },
  // today (timed from when the script runs)
  { day: 0, rel: 40, cat: 'OPERATIONAL', type: 'LOGISTICS_RESUPPLY', name: 'Resupply to FOB Alpha', crew: 'C_CP', ac: 'HEL-512', planned: 105, outcome: 'CLEARED', risk: 'logistics', fp: P('FOB ALPHA HLS', 'DNAA DCT FOB ALPHA DCT DNAA', 'DNMN', 'APPROVED') },
  { day: 0, rel: 95, cat: 'TRAINING', type: 'NAVIGATION_EXERCISE', name: 'Navigation exercise, DNAA to Jos', crew: 'IP_TP', ac: 'HEL-501', planned: 120, outcome: 'RISK_SUBMITTED', risk: 'nav', fp: P('DNAA', 'DNAA DCT DNJO DCT DNAA', 'DNJO', 'APPROVED') },
  { day: 0, rel: 150, cat: 'OPERATIONAL', type: 'RECCE_SURVEILLANCE', name: 'Area surveillance, Sector 2', crew: 'C_CP', ac: 'HEL-508', planned: 120, outcome: 'CREW_READY', risk: 'recce', fp: P('DNAA', 'DNAA SECTOR 2 AREA PATROL DNAA', 'DNMN', 'SUBMITTED') },
  { day: 0, rel: 210, cat: 'TRAINING', type: 'CIRCUITS_LANDINGS', name: 'Circuit consolidation', crew: 'IP_TP', ac: 'HEL-505', planned: 60, outcome: 'PUBLISHED', risk: 'routine' },
  { day: 0, rel: 300, cat: 'OPERATIONAL', type: 'STAFF_VIP_TRANSPORT', name: 'Staff movement to Minna', crew: 'C_CP', ac: 'HEL-504', planned: 90, outcome: 'PLANNED', order: 'SUBMITTED', risk: 'vip', fp: P('DNMN', 'DNAA DCT DNMN', 'DNAA', 'DRAFT') },
  // tomorrow (aircraft already confirmed by CO Engineering)
  { day: 1, at: '08:00', cat: 'TRAINING', type: 'CIRCUITS_LANDINGS', name: 'Circuits, pre-solo check preparation', crew: 'IP_TP', ac: 'HEL-501', planned: 60, outcome: 'PUBLISHED', risk: 'routine' },
  { day: 1, at: '09:30', cat: 'TRAINING', type: 'INSTRUMENT_HOOD', name: 'Instrument flying, unusual attitudes', crew: 'IP_TP', ac: 'HEL-502', planned: 90, outcome: 'PUBLISHED', risk: 'routine' },
  { day: 1, at: '11:00', cat: 'OPERATIONAL', type: 'LOGISTICS_RESUPPLY', name: 'Resupply to FOB Bravo', crew: 'C_CP', ac: 'HEL-513', planned: 120, outcome: 'PUBLISHED', risk: 'logistics', fp: P('FOB BRAVO HLS', 'DNAA DCT FOB BRAVO DCT DNAA', 'DNMN', 'SUBMITTED') },
  { day: 1, at: '14:00', cat: 'OPERATIONAL', type: 'GROUND_FORCE_SUPPORT', name: 'Ground force support, Sector 4', crew: 'C_CP', ac: 'HEL-515', planned: 120, outcome: 'PLANNED', order: 'SUBMITTED', risk: 'gfs' },
  // later this week (waiting for CO Engineering to confirm the aircraft)
  { day: 2, at: '08:00', cat: 'TRAINING', type: 'CONFINED_AREA_PINNACLE', name: 'Confined area and pinnacle landings', crew: 'IP_TP', ac: 'HEL-503', planned: 75, outcome: 'PLANNED', order: 'APPROVED', risk: 'confined' },
  { day: 2, at: '11:00', cat: 'OPERATIONAL', type: 'RECCE_SURVEILLANCE', name: 'Pipeline route surveillance, Sector 3', crew: 'C_CP', ac: 'HEL-507', planned: 150, outcome: 'PLANNED', order: 'APPROVED', risk: 'recce' },
  { day: 2, at: '19:30', cat: 'TRAINING', type: 'NIGHT_FLYING', name: 'Night navigation', crew: 'IP_TP', ac: 'HEL-505', planned: 90, outcome: 'PLANNED', order: 'SUBMITTED', risk: 'night' },
  { day: 3, at: '09:30', cat: 'TRAINING', type: 'NAVIGATION_EXERCISE', name: 'Navigation exercise, DNAA to Minna', crew: 'IP_TP', ac: 'HEL-504', planned: 120, outcome: 'PLANNED', order: 'REJECTED', risk: 'nav' },
  { day: 3, at: '14:00', cat: 'OPERATIONAL', type: 'SEARCH_AND_RESCUE', name: 'SAR exercise, open-area search', crew: 'C_CP', ac: 'HEL-508', planned: 150, outcome: 'PLANNED', order: 'APPROVED', risk: 'sar' },
  { day: 4, at: '09:30', cat: 'TRAINING', type: 'CHECK_RIDE', name: 'Annual proficiency check', crew: 'IP_C', ac: 'HEL-501', planned: 90, outcome: 'PLANNED', order: 'SUBMITTED', risk: 'check' },
  { day: 4, at: '11:00', cat: 'OPERATIONAL', type: 'LOGISTICS_RESUPPLY', name: 'Resupply to FOB Charlie', crew: 'C_CP', ac: 'HEL-511', planned: 120, outcome: 'PLANNED', order: 'APPROVED', risk: 'logistics' },
  { day: 5, at: '09:00', cat: 'OPERATIONAL', type: 'FERRY', name: 'Ferry to Makurdi for servicing', crew: 'C_CP', ac: 'HEL-512', planned: 150, outcome: 'PLANNED', order: 'APPROVED', risk: 'ferry', fp: P('DNMK', 'DNAA DCT DNMK', 'DNKA', 'DRAFT') },
];

const ACTING_DAYS = new Set([-3, -2]); // Commander away; GOO acting Commander

// ───────────────────────────── Settings ─────────────────────────────

type DemoSettings = {
  thresholds: { lowMax: number; mediumMax: number; softImsafePoints: number };
  requiredApprovers: Array<'COMMANDER' | 'CO_FLYING_WING'>;
  density: number;
};

async function readSettings(db: PrismaClient): Promise<DemoSettings> {
  const out: DemoSettings = { thresholds: { lowMax: 16, mediumMax: 26, softImsafePoints: 2 }, requiredApprovers: ['CO_FLYING_WING', 'COMMANDER'], density: 0.8 };
  const rows = await db.setting.findMany({ where: { key: { in: ['riskThresholds', 'requiredApprovers', 'fuelDensityKgPerL'] } } });
  for (const r of rows) {
    const v = r.value as unknown;
    if (r.key === 'riskThresholds' && v && typeof v === 'object') {
      const t = v as Record<string, unknown>;
      if ([t.lowMax, t.mediumMax, t.softImsafePoints].every((n) => typeof n === 'number')) out.thresholds = t as DemoSettings['thresholds'];
    } else if (r.key === 'requiredApprovers' && Array.isArray(v) && v.length && v.every((x) => x === 'COMMANDER' || x === 'CO_FLYING_WING')) {
      out.requiredApprovers = v as DemoSettings['requiredApprovers'];
    } else if (r.key === 'fuelDensityKgPerL' && typeof v === 'number') {
      out.density = v;
    }
  }
  return out;
}

// ───────────────────────────── Building the plan ─────────────────────────────

const round1 = (n: number) => Math.round(n * 10) / 10;
const at = (day: number, hhmm: string, today: string) => localToUtc(addDays(today, day), hhmm);
const plus = (d: Date, minutes: number) => new Date(d.getTime() + minutes * MIN);
/** Small, repeatable variation so the numbers do not look machine-made */
const wobble = (i: number, span: number) => ((i * 7919) % (2 * span + 1)) - span;

function weatherText(obs: Date): string {
  const h = Number(localTimeOf(obs).slice(0, 2));
  const ddhhmm = `${String(obs.getUTCDate()).padStart(2, '0')}${String(obs.getUTCHours()).padStart(2, '0')}${String(obs.getUTCMinutes()).padStart(2, '0')}Z`;
  let body: string;
  if (h < 6) body = 'VRB02KT 6000 BR SCT008 24/23 Q1011';
  else if (h < 9) body = '21004KT 7000 SCT010 26/24 Q1012';
  else if (h < 15) body = `22008KT 9999 SCT018 FEW025CB ${29 + (h % 3)}/24 Q1011`;
  else if (h < 19) body = '24010KT 9999 SCT020 FEW030CB 31/24 Q1009';
  else body = '20005KT 9000 SCT012 27/24 Q1011';
  return `METAR DNAA ${ddhhmm} ${body} NOSIG`;
}

function localTimeOf(d: Date) {
  return new Date(d.getTime() + 60 * MIN).toISOString().slice(11, 16);
}

function ddhh(d: Date) {
  return `${String(d.getUTCDate()).padStart(2, '0')}${String(d.getUTCHours()).padStart(2, '0')}`;
}

function tafText(issued: Date): string {
  const vf = plus(issued, 60);
  const vt = plus(vf, 24 * 60);
  const g = (a: number, b: number) => `${ddhh(plus(vf, a * 60))}/${ddhh(plus(vf, b * 60))}`;
  const issue = `${String(issued.getUTCDate()).padStart(2, '0')}${String(issued.getUTCHours()).padStart(2, '0')}00Z`;
  return (
    `TAF DNAA ${issue} ${ddhh(vf)}/${ddhh(vt)} 22008KT 9999 SCT018 ` +
    `TEMPO ${g(3, 7)} 25015G25KT 3000 TSRA BKN012 FEW015CB ` +
    `BECMG ${g(10, 12)} VRB03KT 6000 BR SCT010 ` +
    `BECMG ${g(20, 22)} 22008KT 9999 SCT018`
  );
}

type PlanMission = {
  tpl: Tpl;
  id: string;
  missionNo: string;
  date: string;
  briefingAt: Date;
  takeoffAt: Date;
  landingAt: Date;
  status: Prisma.MissionCreateManyInput['status'];
  crew: Array<{ id: string; seat: Seat; key: PersonKey; readiness: 'PENDING' | 'READY' | 'NOT_AVAILABLE'; reason: string | null; respondedAt: Date | null }>;
  createdBy: PersonKey;
  createdAt: Date;
  publishedAt: Date | null;
  readinessRequestedAt: Date | null;
  actualMin: number;
  orderStatus: 'APPROVED' | 'SUBMITTED' | 'REJECTED';
};

export type Plan = ReturnType<typeof buildPlan>;

/**
 * Everything the demo adds, as plain rows. Pure (no database), so it can be checked on its own.
 * `numbering` gives the next free mission and order numbers per prefix.
 */
export function buildPlan(now: Date, settings: DemoSettings, nextNumber: (prefix: string) => number, passwordHash: string) {
  const today = localDate(now);
  const ids = new Map<PersonKey, string>(PEOPLE.map((p) => [p.key, randomUUID()]));
  const uid = (k: PersonKey) => ids.get(k)!;
  const acIds = new Map(AIRCRAFT.map((a) => [a.reg, randomUUID()]));
  const acId = (reg: string) => acIds.get(reg)!;
  const def = (k: PersonKey) => PEOPLE.find((p) => p.key === k)!;

  // People
  const users: Prisma.UserCreateManyInput[] = PEOPLE.map((p, i) => ({
    id: uid(p.key),
    rank: p.rank,
    fullName: p.name,
    ...splitName(p.name),
    nafNumber: personNaf(i),
    email: personEmail(p),
    phone: personPhone(i),
    appointment: p.appointment,
    flightStatus: p.flightStatus,
    pilotCategory: p.pilotCategory,
    passwordHash,
    emailVerifiedAt: at(-30, '09:00', today),
    accountStatus: 'ACTIVE',
    emailAlerts: 'NONE', // made-up addresses: never email them
    createdAt: at(-30, '09:00', today),
  }));

  const delegations: Prisma.DelegationCreateManyInput[] = [
    { id: randomUUID(), fromUserId: uid('CMD'), toUserId: uid('GOO'), startsAt: at(-3, '00:00', today), endsAt: at(-1, '00:00', today), setById: uid('CMD'), createdAt: at(-4, '16:00', today) },
  ];

  // Today's take-off base: now rounded up to the next 5 minutes
  const base = new Date(Math.ceil(now.getTime() / (5 * MIN)) * 5 * MIN);

  // ── Sorties: times, crew, numbers ──
  const used = new Map<number, Set<PersonKey>>();
  const pointer: Record<string, number> = { IP: 0, TP: 0, C: 0, CP: 0, CHECKED: 0 };
  const pick = (pool: keyof typeof POOLS, day: number): PersonKey => {
    const set = used.get(day) ?? new Set<PersonKey>();
    used.set(day, set);
    const list = POOLS[pool];
    for (let i = 0; i < list.length; i++) {
      const k = list[(pointer[pool] + i) % list.length];
      if (set.has(k)) continue;
      if (k === 'GOO' && ACTING_DAYS.has(day)) continue;
      pointer[pool] = (pointer[pool] + i + 1) % list.length;
      set.add(k);
      return k;
    }
    throw new Error(`Not enough ${pool} pilots on day ${day}`);
  };

  const sorted = TEMPLATES.map((t, i) => ({ t, i }));
  const missions: PlanMission[] = [];
  for (const { t, i } of sorted) {
    const takeoffAt = t.day === 0 ? plus(base, t.rel ?? 60) : at(t.day, t.at!, today);
    // Fixed crew first so the rotation does not take them
    const set = used.get(t.day) ?? new Set<PersonKey>();
    used.set(t.day, set);
    for (const k of Object.values(t.fixed ?? {})) set.add(k as PersonKey);
    const seat = (s: Seat, pool: keyof typeof POOLS) => (t.fixed?.[s] as PersonKey | undefined) ?? pick(pool, t.day);
    const crewKeys: Array<[Seat, PersonKey]> =
      t.crew === 'IP_TP' ? [['INSTRUCTOR', seat('INSTRUCTOR', 'IP')], ['TRAINEE', seat('TRAINEE', 'TP')]]
      : t.crew === 'IP_C' ? [['INSTRUCTOR', seat('INSTRUCTOR', 'IP')], ['CAPTAIN', seat('CAPTAIN', 'CHECKED')]]
      : t.crew === 'IP_CP' ? [['INSTRUCTOR', seat('INSTRUCTOR', 'IP')], ['CO_PILOT', seat('CO_PILOT', 'CP')]]
      : [['CAPTAIN', seat('CAPTAIN', 'C')], ['CO_PILOT', seat('CO_PILOT', 'CP')]];

    // The app's own pairing rules must accept the crew
    const problems = validateCrew(crewKeys.map(([s, k]) => ({ userId: k, seat: s, flightStatus: def(k).flightStatus, pilotCategory: def(k).pilotCategory, name: k })));
    if (problems.length) throw new Error(`Crew rule broken for ${t.name}: ${problems[0].message}`);

    const actualMin = t.actual ?? (t.outcome === 'COMPLETED' ? t.planned + wobble(i, 8) : 0);
    const flown = t.outcome === 'COMPLETED' || t.outcome === 'ABORTED';
    const past = t.day < 0;
    const published = past || ['CLEARED', 'RISK_SUBMITTED', 'CREW_READY', 'PUBLISHED'].includes(t.outcome);
    const orderStatus = t.order ?? 'APPROVED';
    const createdAt = past || t.day === 0 && published ? at(t.day - 1, '13:00', today) : plus(now, -180 + i);
    const confirmedDay = t.day <= 1;
    const status: PlanMission['status'] =
      t.outcome === 'PLANNED' ? (confirmedDay ? 'DRAFT' : 'AWAITING_ENGINEERING') : t.outcome;

    // Readiness
    const crew = crewKeys.map(([s, k], ci) => {
      let readiness: 'PENDING' | 'READY' | 'NOT_AVAILABLE' = 'PENDING';
      let reason: string | null = null;
      let respondedAt: Date | null = null;
      if (past) {
        readiness = 'READY';
        respondedAt = plus(takeoffAt, -58 + ci * 3);
        if (t.note === 'notAvailable' && s === 'TRAINEE') {
          readiness = 'NOT_AVAILABLE';
          reason = 'On sick report at the medical centre this morning.';
        }
        if (t.outcome === 'CANCELLED' && !t.note && ci === 1) {
          readiness = 'PENDING';
          respondedAt = null;
        }
      } else if (t.day === 0 && ['CLEARED', 'RISK_SUBMITTED', 'CREW_READY'].includes(t.outcome)) {
        readiness = 'READY';
        respondedAt = plus(now, -30 + ci * 3);
      } else if (t.day === 0 && t.outcome === 'PUBLISHED' && ci === 0) {
        readiness = 'READY';
        respondedAt = plus(now, -15);
      }
      return { id: randomUUID(), seat: s, key: k, readiness, reason, respondedAt };
    });

    const date = localDate(takeoffAt);
    missions.push({
      tpl: t,
      id: randomUUID(),
      missionNo: '',
      date,
      briefingAt: plus(takeoffAt, -60),
      takeoffAt,
      landingAt: plus(takeoffAt, t.planned),
      status,
      crew,
      createdBy: t.cat === 'TRAINING' ? 'TRGO' : 'OPSO',
      createdAt,
      publishedAt: published ? (past || t.day === 0 ? at(t.day - 1, '16:00', today) : plus(now, -60)) : null,
      readinessRequestedAt: past && t.outcome !== 'CANCELLED' ? plus(takeoffAt, -60) : t.day === 0 && ['CLEARED', 'RISK_SUBMITTED'].includes(t.outcome) ? plus(now, -32) : null,
      actualMin: flown ? actualMin : 0,
      orderStatus,
    });
  }

  // Aircraft used once a day, and never while unavailable
  const perDay = new Map<string, string>();
  for (const m of missions) {
    const k = `${m.tpl.day}:${m.tpl.ac}`;
    if (perDay.has(k)) throw new Error(`${m.tpl.ac} is booked twice on day ${m.tpl.day}`);
    perDay.set(k, m.tpl.name);
  }

  // Numbers, in take-off order
  missions.sort((a, b) => a.takeoffAt.getTime() - b.takeoffAt.getTime());
  const counters = new Map<string, number>();
  const take = (prefix: string) => {
    const n = counters.get(prefix) ?? nextNumber(prefix);
    counters.set(prefix, n + 1);
    return `${prefix}${String(n).padStart(3, '0')}`;
  };
  const orderNos = new Map<string, string>();
  for (const m of missions) {
    m.missionNo = take(`${MISSION_CATEGORY_PREFIX[m.tpl.cat]}-${m.date.slice(2, 4)}-`);
    orderNos.set(m.id, take(`MO-${m.date.slice(2, 4)}-`));
  }

  // ── Aircraft hours: start values worked back from the end values, then flown forward ──
  const flownCents = new Map<string, number>();
  for (const m of missions) if (m.actualMin > 0) flownCents.set(m.tpl.ac, (flownCents.get(m.tpl.ac) ?? 0) + Math.round((m.actualMin / 60) * 100));
  type AcState = { status: 'SERVICEABLE' | 'UNSERVICEABLE' | 'UNDER_MAINTENANCE' | 'INSPECTION_DUE'; hours: number; toNext: number; remarks: string | null };
  const state = new Map<string, AcState>();
  for (const a of AIRCRAFT) {
    const f = flownCents.get(a.reg) ?? 0;
    state.set(a.reg, {
      status: 'SERVICEABLE',
      hours: Math.round(a.endHours * 100) - f,
      toNext: a.limit ? f - 10 : Math.round(a.endToNext * 100) + f,
      remarks: null,
    });
  }

  const history: Prisma.AircraftStatusHistoryCreateManyInput[] = [];
  const events: Array<{ at: Date; run: () => void }> = [];
  const statusAt = new Map<string, Array<{ at: Date; status: AcState['status']; remarks: string | null }>>();
  const noteStatus = (reg: string, when: Date) => {
    const s = state.get(reg)!;
    const list = statusAt.get(reg) ?? [];
    list.push({ at: when, status: s.status, remarks: s.remarks });
    statusAt.set(reg, list);
  };

  for (const m of missions) {
    if (m.actualMin <= 0) continue;
    const landed = plus(m.takeoffAt, m.actualMin);
    events.push({
      at: plus(landed, 20),
      run: () => {
        const s = state.get(m.tpl.ac)!;
        const cents = Math.round((m.actualMin / 60) * 100);
        s.hours += cents;
        s.toNext -= cents;
        if (s.toNext <= 0 && s.status === 'SERVICEABLE') {
          s.status = 'INSPECTION_DUE';
          s.toNext = 0;
          s.remarks = 'Inspection limit reached.';
        }
        history.push({
          id: randomUUID(),
          aircraftId: acId(m.tpl.ac),
          status: s.status,
          flyingHours: (s.hours / 100).toFixed(2),
          hoursToNextInspection: (Math.max(s.toNext, 0) / 100).toFixed(2),
          remarks: `${m.missionNo}: +${(cents / 100).toFixed(2)} h`,
          changedById: uid(m.crew[0].key),
          createdAt: plus(landed, 20),
        });
        noteStatus(m.tpl.ac, plus(landed, 20));
      },
    });
  }
  for (const e of STATUS_EVENTS) {
    const when = at(e.day, e.at, today);
    events.push({
      at: when,
      run: () => {
        const s = state.get(e.reg)!;
        s.status = e.status;
        s.remarks = e.remarks;
        history.push({
          id: randomUUID(),
          aircraftId: acId(e.reg),
          status: s.status,
          flyingHours: (s.hours / 100).toFixed(2),
          hoursToNextInspection: (Math.max(s.toNext, 0) / 100).toFixed(2),
          remarks: e.remarks,
          changedById: uid('COENG'),
          createdAt: when,
        });
        noteStatus(e.reg, when);
      },
    });
  }
  events.sort((a, b) => a.at.getTime() - b.at.getTime());
  for (const e of events) e.run();

  // Check: no aircraft flew while unavailable, and future sorties fit the hours left
  for (const m of missions) {
    const list = statusAt.get(m.tpl.ac) ?? [];
    const before = [...list].filter((x) => x.at <= m.takeoffAt).pop();
    const statusThen = before?.status ?? 'SERVICEABLE';
    if (statusThen !== 'SERVICEABLE' && m.status !== 'CANCELLED') throw new Error(`${m.tpl.ac} is ${statusThen} for ${m.tpl.name} on day ${m.tpl.day}`);
    if (m.tpl.day >= 0 && state.get(m.tpl.ac)!.toNext / 100 * 60 < m.tpl.planned) throw new Error(`${m.tpl.ac} has too few hours for ${m.tpl.name}`);
  }

  const aircraft: Prisma.AircraftCreateManyInput[] = AIRCRAFT.map((a) => {
    const s = state.get(a.reg)!;
    if (!a.limit && Math.abs(s.toNext - Math.round(a.endToNext * 100)) > 1) throw new Error(`Hours mismatch on ${a.reg}`);
    const last = addDays(today, -a.lastInspDays);
    return {
      id: acId(a.reg),
      registration: a.reg,
      type: a.type,
      status: s.status,
      flyingHours: (s.hours / 100).toFixed(2),
      hoursToNextInspection: (Math.max(s.toNext, 0) / 100).toFixed(2),
      inspectionIntervalHours: INTERVAL_H,
      inspectionIntervalDays: INTERVAL_DAYS,
      lastInspectionDate: dateOnly(last),
      nextInspectionDue: dateOnly(addDays(last, INTERVAL_DAYS)),
      maintenanceRemarks: s.remarks,
      createdAt: at(-30, '09:00', today),
    };
  });

  // CO Engineering's daily confirmation, six days ago to tomorrow
  const checks: Prisma.ServiceabilityCheckCreateManyInput[] = [];
  for (let d = -6; d <= 1; d++) {
    for (const a of AIRCRAFT) {
      const list = statusAt.get(a.reg) ?? [];
      const ref = d < 0 ? at(d, '12:00', today) : new Date(8.64e15);
      const s = [...list].filter((x) => x.at <= ref).pop();
      checks.push({
        id: randomUUID(),
        aircraftId: acId(a.reg),
        flyingDate: dateOnly(addDays(today, d)),
        status: s?.status ?? 'SERVICEABLE',
        remarks: s && s.status !== 'SERVICEABLE' ? s.remarks : null,
        confirmedById: uid('COENG'),
        createdAt: new Date(Math.min((d <= 0 ? at(d, '06:30', today) : at(0, '16:30', today)).getTime(), plus(now, -90).getTime())),
      });
    }
  }

  // ── Mission rows ──
  const missionRows: Prisma.MissionCreateManyInput[] = [];
  const crewRows: Prisma.MissionCrewCreateManyInput[] = [];
  const orderRows: Prisma.MissionOrderCreateManyInput[] = [];
  const planRows: Prisma.FlightPlanCreateManyInput[] = [];
  const riskRows: Prisma.RiskAssessmentCreateManyInput[] = [];
  const imsafeRows: Prisma.ImsafeCheckCreateManyInput[] = [];
  const approvalRows: Prisma.RiskApprovalCreateManyInput[] = [];
  const reportRows: Prisma.MissionReportCreateManyInput[] = [];
  const snagRows: Prisma.SnagCreateManyInput[] = [];
  const commentRows: Prisma.CommentCreateManyInput[] = [];
  const reportIdByTpl = new Map<Tpl, { id: string; pic: PersonKey; landed: Date }>();
  const missionIdByTpl = new Map<Tpl, string>();

  const noImsafe: Imsafe = { illness: false, medication: false, stress: false, alcohol: false, fatigue: false, eating: false };

  for (const m of missions) {
    const t = m.tpl;
    missionIdByTpl.set(t, m.id);
    const pic = m.crew.find((c) => c.seat === pilotInCommandSeat(m.crew.map((x) => x.seat)))!;
    const commander: PersonKey = ACTING_DAYS.has(t.day) ? 'GOO' : 'CMD';
    const orderDecider: PersonKey = t.day < 0 && ACTING_DAYS.has(t.day - 1) ? 'COFW' : m.missionNo.endsWith('2') || m.missionNo.endsWith('7') ? 'CMD' : 'COFW';

    missionRows.push({
      id: m.id,
      missionNo: m.missionNo,
      date: dateOnly(m.date),
      name: t.name,
      category: t.cat,
      type: t.type,
      aircraftId: acId(t.ac),
      briefingAt: m.briefingAt,
      takeoffAt: m.takeoffAt,
      landingAt: m.landingAt,
      status: m.status,
      cancelReason: t.cancel ?? null,
      createdById: uid(m.createdBy),
      publishedAt: m.publishedAt,
      readinessRequestedAt: m.readinessRequestedAt,
      createdAt: m.createdAt,
    });
    for (const c of m.crew) {
      crewRows.push({ id: c.id, missionId: m.id, userId: uid(c.key), seat: c.seat, readiness: c.readiness, readinessReason: c.reason, respondedAt: c.respondedAt, createdAt: m.createdAt });
    }

    // Mission order
    const [task, objectives] = ORDER_TEXT[t.type] ?? [t.name, t.name];
    const decided = m.orderStatus !== 'SUBMITTED';
    const decidedAt = t.day < 0 || (t.day === 0 && m.publishedAt) ? at(t.day - 1, '14:30', today) : plus(now, -100);
    orderRows.push({
      id: randomUUID(),
      missionId: m.id,
      orderNo: orderNos.get(m.id)!,
      taskDescription: `${task} Aircraft ${t.ac}.`,
      objectives,
      priority: t.type === 'CASEVAC' ? 'IMMEDIATE' : t.cat === 'OPERATIONAL' && ['GROUND_FORCE_SUPPORT', 'SEARCH_AND_RESCUE'].includes(t.type) ? 'PRIORITY' : 'ROUTINE',
      operationalRemarks: t.cat === 'OPERATIONAL' ? 'Crew to collect the latest threat and weather brief from Ops before walking.' : null,
      status: m.orderStatus,
      submittedAt: m.createdAt,
      decidedById: decided ? uid(m.orderStatus === 'REJECTED' ? 'CMD' : orderDecider) : null,
      decidedAt: decided ? decidedAt : null,
      decisionRemarks: m.orderStatus === 'REJECTED' ? 'Amend the route: the leg over the restricted area needs prior clearance. Route around it and resubmit.' : null,
      createdById: uid(m.createdBy),
      createdAt: m.createdAt,
    });

    // Flight plan
    if (t.fp) {
      const fpStatus = t.fp.status ?? (t.day < 0 ? 'APPROVED' : 'SUBMITTED');
      const submittedAt = t.day < 0 ? plus(m.takeoffAt, -95) : plus(now, -45);
      const kg = round1(((AIRCRAFT.find((a) => a.reg === t.ac)!.burnKgPerH * t.planned) / 60) * 1.3);
      planRows.push({
        id: randomUUID(),
        missionId: m.id,
        departure: 'DNAA',
        destination: t.fp.dest,
        route: t.fp.route,
        alternate: t.fp.alt,
        estFlightTimeMin: t.planned,
        fuelRequiredKg: kg,
        fuelRequiredL: round1(kg / settings.density),
        crewNotes: t.cat === 'OPERATIONAL' ? 'Ground party to confirm the landing site clear by radio before approach.' : null,
        status: fpStatus,
        submittedById: uid(pic.key),
        submittedAt: fpStatus === 'DRAFT' ? null : submittedAt,
        approvedById: fpStatus === 'APPROVED' ? uid('OPSO') : null,
        approvedAt: fpStatus === 'APPROVED' ? (t.day < 0 ? plus(m.takeoffAt, -80) : plus(now, -35)) : null,
        createdAt: fpStatus === 'DRAFT' ? plus(now, -50) : submittedAt,
      });
    }

    // Risk assessment(s): every sortie that was cleared to fly, and today's awaiting approval
    const needsRisk = (t.day < 0 && (t.outcome === 'COMPLETED' || t.outcome === 'ABORTED')) || t.outcome === 'CLEARED' || t.outcome === 'RISK_SUBMITTED';
    if (needsRisk) {
      const versions: Array<{ ratings: Ratings; status: 'CLEARED' | 'REJECTED' | 'SUBMITTED'; mitigations: string | null }> = [];
      const base: Ratings = { ...RISK[t.risk] };
      if (t.note === 'rejectedFirst') {
        versions.push({ ratings: { ...base }, status: 'REJECTED', mitigations: null });
        versions.push({ ratings: { ...base, fatigue: 3 }, status: 'CLEARED', mitigations: 'Captain had 10 hours rest after the late finish. Sortie limited to 90 minutes.' });
      } else {
        versions.push({ ratings: base, status: t.outcome === 'RISK_SUBMITTED' ? 'SUBMITTED' : 'CLEARED', mitigations: MITIGATIONS[t.risk] ?? null });
      }
      versions.forEach((v, vi) => {
        const raId = randomUUID();
        const today0 = t.day === 0;
        const created = today0 ? plus(now, t.outcome === 'CLEARED' ? -22 : -12) : plus(m.takeoffAt, vi === 0 && versions.length > 1 ? -50 : -35);
        const imsafe = m.crew.map((c, ci) => ({ ...noImsafe, stress: t.note === 'softImsafe' && ci === 1, key: c.key, at: plus(created, 2 + ci * 2) }));
        const r = computeRisk(v.ratings, imsafe, settings.thresholds);
        const mitigation = v.mitigations ?? (r.mitigationRequired ? 'Crew briefed on the higher-rated items; the Instructor or Captain will stop the sortie if conditions change.' : null);
        riskRows.push({
          id: raId,
          missionId: m.id,
          version: vi + 1,
          submittedById: uid(pic.key),
          ...v.ratings,
          weatherLoweredReason: null,
          mitigations: mitigation,
          totalScore: r.score,
          level: r.level,
          levelReason: r.reason,
          status: v.status,
          requiredRoles: settings.requiredApprovers,
          createdAt: created,
        });
        for (const s of imsafe) {
          imsafeRows.push({ id: randomUUID(), riskAssessmentId: raId, userId: uid(s.key), illness: false, medication: false, stress: s.stress, alcohol: false, fatigue: false, eating: false, notes: s.stress ? 'Family matter at home; fit to fly.' : null, createdAt: s.at });
        }
        settings.requiredApprovers.forEach((role, ri) => {
          const who: PersonKey = role === 'COMMANDER' ? commander : 'COFW';
          let decision: 'APPROVE' | 'APPROVE_WITH_REMARKS' | 'REJECT' | null = null;
          let remarks: string | null = null;
          if (v.status === 'CLEARED') {
            decision = r.level === 'LOW' ? 'APPROVE' : 'APPROVE_WITH_REMARKS';
            remarks = r.level === 'HIGH' ? (role === 'COMMANDER' ? 'Approved. Abort if the threat picture changes en route.' : 'Approved with the stated mitigations.') : r.level === 'MEDIUM' ? 'Approved. Brief the higher-rated items at the walk.' : null;
          } else if (v.status === 'REJECTED') {
            if (role === 'CO_FLYING_WING') {
              decision = 'REJECT';
              remarks = "Fatigue rating does not reflect the captain's late finish yesterday. Revise and confirm crew rest.";
            } else return;
          } else {
            return; // awaiting decision
          }
          approvalRows.push({
            id: randomUUID(),
            riskAssessmentId: raId,
            approverRole: role,
            approverId: uid(who),
            decision,
            remarks,
            actingFor: role === 'COMMANDER' && who === 'GOO',
            decidedAt: today0 ? plus(now, -14 + ri * 4) : plus(created, 10 + ri * 5),
            createdAt: created,
          });
        });
        // Empty decision slots for roles that have not decided
        for (const role of settings.requiredApprovers) {
          if (approvalRows.some((a) => a.riskAssessmentId === raId && a.approverRole === role)) continue;
          approvalRows.push({ id: randomUUID(), riskAssessmentId: raId, approverRole: role, createdAt: created });
        }
        if (r.level === 'HIGH') {
          commentRows.push({ id: randomUUID(), entityType: 'risk_assessment', entityId: raId, authorId: uid('SAFO'), body: 'Reviewed. Mitigations are adequate. Make sure the threat update from the ground force is received before lift.', createdAt: plus(created, 8) });
        }
      });
    }

    // Mission report
    if (t.day < 0 && (t.outcome === 'COMPLETED' || t.outcome === 'ABORTED')) {
      const burn = AIRCRAFT.find((a) => a.reg === t.ac)!.burnKgPerH;
      const kg = round1((burn * m.actualMin) / 60 * (1 + wobble(m.actualMin, 4) / 100));
      const landed = plus(m.takeoffAt, m.actualMin);
      const rid = randomUUID();
      reportRows.push({
        id: rid,
        missionId: m.id,
        outcome: t.outcome,
        flightTimeMin: m.actualMin,
        fuelUsedKg: kg,
        fuelUsedL: round1(kg / settings.density),
        abortReason: t.abort ?? null,
        missionOutcome: t.outcome === 'COMPLETED' ? OUTCOME_TEXT[t.type] ?? 'Completed as tasked.' : null,
        remarks: t.outcome === 'ABORTED' ? 'Crew and aircraft safe. Sortie to be re-tasked.' : 'Nil.',
        submittedById: uid(pic.key),
        createdAt: plus(landed, 20),
      });
      reportIdByTpl.set(t, { id: rid, pic: pic.key, landed });
    }
  }

  // ── Snags ──
  const tplOf = (day: number, ac: string) => TEMPLATES.find((t) => t.day === day && t.ac === ac)!;
  const snag = (day: number, ac: string, description: string, closed?: { day: number; at: string; action: string }) => {
    const r = reportIdByTpl.get(tplOf(day, ac))!;
    snagRows.push({
      id: randomUUID(),
      aircraftId: acId(ac),
      missionReportId: r.id,
      description,
      status: closed ? 'CLOSED' : 'OPEN',
      raisedById: uid(r.pic),
      closedById: closed ? uid('COENG') : null,
      closedAt: closed ? at(closed.day, closed.at, today) : null,
      actionTaken: closed?.action ?? null,
      createdAt: plus(r.landed, 20),
    });
  };
  snag(-3, 'HEL-502', 'Pitot heat caution light on in cruise.', { day: -1, at: '10:00', action: 'Pitot heater element replaced. Ground run satisfactory. Air test raised.' });
  snag(-3, 'HEL-507', 'Cabin door seal worn at the lower aft corner. Water ingress in rain.', { day: -2, at: '15:00', action: 'Door seal replaced.' });
  snag(-4, 'HEL-509', 'Weather radar display intermittent.');
  snag(-2, 'HEL-506', 'No.2 engine chip detector caution in flight.');
  snag(-2, 'HEL-503', 'Light oil seep at the tail rotor gearbox, within limits. Monitor.');

  // ── Safety reports ──
  const safety: Prisma.SafetyReportCreateManyInput[] = [
    { id: randomUUID(), reportedById: uid('C2'), kind: 'HAZARD', description: 'Large flocks of birds on short final between 0700 and 0800 local, near the drainage canal.', location: 'Home aerodrome, runway approach', status: 'UNDER_REVIEW', createdAt: at(-5, '09:10', today) },
    { id: randomUUID(), reportedById: uid('TP2'), kind: 'HAZARD', description: 'Loose plastic sheeting blown onto the helicopter parking area after the storm.', location: 'Helicopter apron', status: 'CLOSED', createdAt: at(-2, '07:20', today) },
    { id: randomUUID(), reportedById: uid(missions.find((m) => m.tpl === tplOf(-4, 'HEL-504'))!.crew[0].key), kind: 'INCIDENT', description: 'Firm landing during the confined area exercise, caused by a late flare in gusty wind. No damage found at the post-flight inspection.', location: 'Confined area site 2', aircraftId: acId('HEL-504'), missionId: missionIdByTpl.get(tplOf(-4, 'HEL-504')), status: 'OPEN', createdAt: at(-4, '17:30', today) },
    { id: randomUUID(), reportedById: uid('CP2'), kind: 'HAZARD', description: 'Earthing cable on fuel bowser 2 is frayed near the clamp.', location: 'Refuelling point', status: 'OPEN', createdAt: plus(now, -150) },
  ];
  commentRows.push(
    { id: randomUUID(), entityType: 'safety_report', entityId: safety[0].id!, authorId: uid('SAFO'), body: 'Shared with airport wildlife control. Crews to brief bird activity at the morning briefing.', createdAt: at(-5, '11:00', today) },
    { id: randomUUID(), entityType: 'safety_report', entityId: safety[1].id!, authorId: uid('SAFO'), body: 'FOD walk done on the apron. Cleared.', createdAt: at(-2, '09:00', today) },
  );

  // ── A pending change request for Admin (co-pilot upgraded after his conversion) ──
  const changeRequests: Prisma.ProfileChangeRequestCreateManyInput[] = [
    { id: randomUUID(), userId: uid('CP1'), field: 'flightStatus', oldValue: 'CO_PILOT', newValue: 'CAPTAIN', reason: 'Completed captaincy conversion and passed the check ride.', status: 'PENDING', createdAt: at(-1, '18:00', today) },
  ];

  // ── Weather: hourly METARs for the last six hours, the current one, and two TAFs ──
  const weather: Prisma.WeatherReportCreateManyInput[] = [];
  const addWeather = (raw: string, kind: 'METAR' | 'TAF', createdAt: Date) => {
    const p = parseWeather(raw, kind, now);
    weather.push({
      id: randomUUID(),
      kind,
      station: p.station ?? 'DNAA',
      rawText: raw.trim().toUpperCase(),
      windDir: p.windDir,
      windSpeedKt: p.windSpeedKt,
      gustKt: p.gustKt,
      visibilityM: p.visibilityM,
      temperatureC: p.temperatureC,
      dewpointC: p.dewpointC,
      qnhHpa: p.qnhHpa,
      clouds: p.clouds as Prisma.InputJsonValue,
      phenomena: p.phenomena as Prisma.InputJsonValue,
      changeGroups: p.changeGroups,
      ceilingFt: p.ceilingFt,
      observedAt: p.observedAt,
      validFrom: p.validFrom,
      validTo: p.validTo,
      enteredById: uid('OPSO'),
      createdAt,
    });
  };
  const half = new Date(Math.floor(now.getTime() / (30 * MIN)) * 30 * MIN);
  const issueHours = [5, 11, 17, 23];
  const lastIssue = (() => {
    for (let back = 0; back < 48; back++) {
      const d = new Date(Math.floor(now.getTime() / (60 * MIN)) * 60 * MIN - back * 60 * MIN);
      if (issueHours.includes(d.getUTCHours()) && d.getTime() <= now.getTime() - 10 * MIN) return d;
    }
    return new Date(Math.floor(now.getTime() / (60 * MIN)) * 60 * MIN - 60 * MIN);
  })();
  addWeather(tafText(plus(lastIssue, -6 * 60)), 'TAF', plus(lastIssue, -6 * 60 + 5));
  for (let h = 6; h >= 1; h--) {
    const obs = new Date(Math.floor(now.getTime() / (60 * MIN)) * 60 * MIN - h * 60 * MIN);
    addWeather(weatherText(obs), 'METAR', plus(obs, 4));
  }
  addWeather(tafText(lastIssue), 'TAF', plus(lastIssue, 5));
  addWeather(weatherText(half), 'METAR', new Date(Math.min(plus(half, 3).getTime(), now.getTime())));
  weather.sort((a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime());

  return {
    today,
    users,
    delegations,
    aircraft,
    history,
    checks,
    weather,
    missions: missionRows,
    crew: crewRows,
    orders: orderRows,
    plans: planRows,
    risks: riskRows,
    imsafe: imsafeRows,
    approvals: approvalRows,
    reports: reportRows,
    snags: snagRows,
    safety,
    comments: commentRows,
    changeRequests,
  };
}

// ───────────────────────────── Database ─────────────────────────────

async function readManifest(tx: Tx | PrismaClient): Promise<Manifest | null> {
  const row = await tx.setting.findUnique({ where: { key: MANIFEST_KEY } });
  return row ? (row.value as unknown as Manifest) : null;
}

async function nextNumbers(db: PrismaClient, plan: () => string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const prefix of plan()) {
    if (out.has(prefix)) continue;
    if (prefix.startsWith('MO-')) {
      const last = await db.missionOrder.findFirst({ where: { orderNo: { startsWith: prefix } }, orderBy: { orderNo: 'desc' }, select: { orderNo: true } });
      out.set(prefix, last ? Number(last.orderNo.slice(prefix.length)) + 1 : 1);
    } else {
      const last = await db.mission.findFirst({ where: { missionNo: { startsWith: prefix } }, orderBy: { missionNo: 'desc' }, select: { missionNo: true } });
      out.set(prefix, last ? Number(last.missionNo.slice(prefix.length)) + 1 : 1);
    }
  }
  for (const [k, v] of out) if (!Number.isFinite(v)) out.set(k, 1);
  return out;
}

async function add(db: PrismaClient) {
  if (await readManifest(db)) {
    console.log('Demo data is already in. Removing it first so it can be added fresh...');
    await remove(db, { quiet: true });
  }

  // Never collide with real records
  const emails = PEOPLE.map(personEmail);
  const nafs = PEOPLE.map((_, i) => personNaf(i));
  const clashUsers = await db.user.findMany({ where: { OR: [{ email: { in: emails } }, { nafNumber: { in: nafs } }] }, select: { email: true, nafNumber: true } });
  const clashAircraft = await db.aircraft.findMany({ where: { registration: { in: AIRCRAFT.map((a) => a.reg) } }, select: { registration: true } });
  if (clashUsers.length || clashAircraft.length) {
    console.error('Stopped: some demo records would clash with records already in the app:');
    for (const u of clashUsers) console.error(`  person ${u.nafNumber} ${u.email}`);
    for (const a of clashAircraft) console.error(`  aircraft ${a.registration}`);
    console.error('Nothing was added.');
    process.exitCode = 1;
    return;
  }

  const settings = await readSettings(db);
  const password = process.env.DEMO_PASSWORD || `Demo-${randomBytes(3).toString('hex')}-2026`;
  const passwordHash = await hash(password, { memoryCost: 19_456, timeCost: 2, parallelism: 1 });
  const now = new Date();

  // Work out which number prefixes are needed, then the next free number for each
  const prefixes: string[] = [];
  buildPlan(now, settings, (p) => {
    prefixes.push(p);
    return 1;
  }, passwordHash);
  const next = await nextNumbers(db, () => prefixes);
  const plan = buildPlan(now, settings, (p) => next.get(p) ?? 1, passwordHash);

  await db.$transaction(
    async (tx) => {
      await tx.user.createMany({ data: plan.users });
      await tx.delegation.createMany({ data: plan.delegations });
      await tx.aircraft.createMany({ data: plan.aircraft });
      await tx.aircraftStatusHistory.createMany({ data: plan.history });
      await tx.serviceabilityCheck.createMany({ data: plan.checks });
      await tx.weatherReport.createMany({ data: plan.weather });
      await tx.mission.createMany({ data: plan.missions });
      await tx.missionCrew.createMany({ data: plan.crew });
      await tx.missionOrder.createMany({ data: plan.orders });
      await tx.flightPlan.createMany({ data: plan.plans });
      await tx.riskAssessment.createMany({ data: plan.risks });
      await tx.imsafeCheck.createMany({ data: plan.imsafe });
      await tx.riskApproval.createMany({ data: plan.approvals });
      await tx.missionReport.createMany({ data: plan.reports });
      await tx.snag.createMany({ data: plan.snags });
      await tx.safetyReport.createMany({ data: plan.safety });
      await tx.comment.createMany({ data: plan.comments });
      await tx.profileChangeRequest.createMany({ data: plan.changeRequests });
      const manifest: Manifest = {
        createdAt: now.toISOString(),
        userIds: plan.users.map((u) => u.id!),
        aircraftIds: plan.aircraft.map((a) => a.id!),
        missionIds: plan.missions.map((m) => m.id!),
        weatherIds: plan.weather.map((w) => w.id!),
        safetyReportIds: plan.safety.map((s) => s.id!),
        delegationIds: plan.delegations.map((d) => d.id!),
        changeRequestIds: plan.changeRequests.map((c) => c.id!),
      };
      await tx.setting.create({ data: { key: MANIFEST_KEY, value: manifest as unknown as Prisma.InputJsonValue } });
      await tx.auditLog.create({ data: { actorId: null, action: 'demo.add', entityType: 'demo', after: { people: plan.users.length, aircraft: plan.aircraft.length, missions: plan.missions.length } } });
    },
    { timeout: 120_000, maxWait: 20_000 },
  );

  const byKey = (k: PersonKey) => {
    const i = PEOPLE.findIndex((p) => p.key === k);
    return `${personNaf(i).padEnd(9)} ${personEmail(PEOPLE[i])}`;
  };
  console.log('');
  console.log(`Demo data added: ${plan.users.length} people, ${plan.aircraft.length} aircraft, ${plan.missions.length} sorties, ${plan.weather.length} weather reports.`);
  console.log('');
  console.log(`Password for every demo person:  ${password}`);
  console.log('Sign in with the service number or the email:');
  console.log(`  Commander (2-step sign-in)  ${byKey('CMD')}`);
  console.log(`  CO Flying Wing              ${byKey('COFW')}`);
  console.log(`  CO Engineering              ${byKey('COENG')}`);
  console.log(`  Engineering Officer         ${byKey('ENGO')}`);
  console.log(`  Operations Officer          ${byKey('OPSO')}`);
  console.log(`  Training Officer            ${byKey('TRGO')}`);
  console.log(`  Safety Officer              ${byKey('SAFO')}`);
  console.log(`  Pilot (instructor)          ${byKey('IP1')}`);
  console.log(`  Pilot (trainee)             ${byKey('TP1')}`);
  console.log('');
  console.log('A METAR is valid for one hour. Before showing a risk assessment, run:  npx tsx prisma/demo-data.ts metar');
  console.log('To take all demo data out again, run:                                   npx tsx prisma/demo-data.ts remove');
}

async function metar(db: PrismaClient) {
  const manifest = await readManifest(db);
  if (!manifest) {
    console.error('No demo data found. Run "npx tsx prisma/demo-data.ts add" first.');
    process.exitCode = 1;
    return;
  }
  const ops = await db.user.findFirst({ where: { id: { in: manifest.userIds }, appointment: 'OPERATIONS_OFFICER' }, select: { id: true } });
  if (!ops) throw new Error('Demo Operations Officer not found.');
  const now = new Date();
  const obs = new Date(Math.floor(now.getTime() / MIN) * MIN);
  const raw = weatherText(obs);
  const p = parseWeather(raw, 'METAR', now);
  const w = await db.weatherReport.create({
    data: {
      kind: 'METAR',
      station: p.station ?? 'DNAA',
      rawText: raw,
      windDir: p.windDir,
      windSpeedKt: p.windSpeedKt,
      gustKt: p.gustKt,
      visibilityM: p.visibilityM,
      temperatureC: p.temperatureC,
      dewpointC: p.dewpointC,
      qnhHpa: p.qnhHpa,
      clouds: p.clouds as Prisma.InputJsonValue,
      phenomena: p.phenomena as Prisma.InputJsonValue,
      changeGroups: p.changeGroups,
      ceilingFt: p.ceilingFt,
      observedAt: p.observedAt,
      enteredById: ops.id,
    },
  });
  await db.setting.update({ where: { key: MANIFEST_KEY }, data: { value: { ...manifest, weatherIds: [...manifest.weatherIds, w.id] } as unknown as Prisma.InputJsonValue } });
  const until = new Date(obs.getTime() + 60 * MIN);
  console.log(`New METAR entered: ${raw}`);
  console.log(`Valid until ${localTimeOf(until)} local (${until.toISOString().slice(11, 16)}Z).`);
}

async function remove(db: PrismaClient, opts: { quiet?: boolean } = {}) {
  const manifest = await readManifest(db);
  const byDomain = await db.user.findMany({ where: { email: { endsWith: `@${DEMO_DOMAIN}` } }, select: { id: true } });
  if (!manifest && !byDomain.length) {
    console.log('No demo data found. Nothing to remove.');
    return;
  }
  const U = [...new Set([...(manifest?.userIds ?? []), ...byDomain.map((u) => u.id)])];
  const A = manifest?.aircraftIds ?? [];
  const since = manifest ? new Date(manifest.createdAt) : null;

  const counts = await db.$transaction(
    async (tx) => {
      // Sorties: the demo ones, plus any made during the demo with demo people or aircraft
      const missions = await tx.mission.findMany({
        where: {
          OR: [
            { id: { in: manifest?.missionIds ?? [] } },
            { aircraftId: { in: A } },
            { createdById: { in: U } },
            { crew: { some: { userId: { in: U } } } },
            { order: { createdById: { in: U } } },
          ],
        },
        select: { id: true, order: { select: { id: true } }, riskAssessments: { select: { id: true } }, report: { select: { id: true } } },
      });
      const M = missions.map((m) => m.id);
      const orderIds = missions.flatMap((m) => (m.order ? [m.order.id] : []));
      const riskIds = missions.flatMap((m) => m.riskAssessments.map((r) => r.id));
      const reportIds = missions.flatMap((m) => (m.report ? [m.report.id] : []));

      const safety = await tx.safetyReport.findMany({
        where: { OR: [{ id: { in: manifest?.safetyReportIds ?? [] } }, { reportedById: { in: U } }, { aircraftId: { in: A } }, { missionId: { in: M } }] },
        select: { id: true },
      });
      const S = safety.map((s) => s.id);
      const weather = await tx.weatherReport.findMany({ where: { OR: [{ id: { in: manifest?.weatherIds ?? [] } }, { enteredById: { in: U } }] }, select: { id: true } });
      const W = weather.map((w) => w.id);

      const c: Record<string, number> = {};
      c.comments = (await tx.comment.deleteMany({
        where: {
          OR: [
            { authorId: { in: U } },
            { entityType: 'risk_assessment', entityId: { in: riskIds } },
            { entityType: 'mission', entityId: { in: M } },
            { entityType: 'safety_report', entityId: { in: S } },
          ],
        },
      })).count;
      c.safetyReports = (await tx.safetyReport.deleteMany({ where: { id: { in: S } } })).count;
      c.attachments = (await tx.attachment.deleteMany({ where: { OR: [{ uploadedById: { in: U } }, { entityType: 'mission_order', entityId: { in: orderIds } }] } })).count;
      // Notifications that point at demo items (including ones sent to real people)
      const linkIds = [...M, ...riskIds, ...A, ...W];
      let notes = 0;
      for (let i = 0; i < linkIds.length; i += 200) {
        notes += (await tx.notification.deleteMany({ where: { OR: linkIds.slice(i, i + 200).map((id) => ({ link: { contains: id } })) } })).count;
      }
      notes += (await tx.notification.deleteMany({ where: { userId: { in: U } } })).count;
      c.notifications = notes;
      c.snags = (await tx.snag.deleteMany({ where: { OR: [{ aircraftId: { in: A } }, { raisedById: { in: U } }, { missionReportId: { in: reportIds } }] } })).count;
      c.flightPlans = (await tx.flightPlan.deleteMany({ where: { OR: [{ missionId: { in: M } }, { submittedById: { in: U } }] } })).count;
      c.missions = (await tx.mission.deleteMany({ where: { id: { in: M } } })).count; // crew, orders, risk, reports go with them
      c.serviceabilityChecks = (await tx.serviceabilityCheck.deleteMany({ where: { OR: [{ aircraftId: { in: A } }, { confirmedById: { in: U } }] } })).count;
      c.weatherReports = (await tx.weatherReport.deleteMany({ where: { id: { in: W } } })).count;
      c.delegations = (await tx.delegation.deleteMany({ where: { OR: [{ fromUserId: { in: U } }, { toUserId: { in: U } }, { setById: { in: U } }] } })).count;
      c.changeRequests = (await tx.profileChangeRequest.deleteMany({ where: { userId: { in: U } } })).count;
      // Summary reports made while the demo data was in contain demo figures
      c.summaryReports = since ? (await tx.summaryReport.deleteMany({ where: { generatedAt: { gte: since } } })).count : 0;
      c.aircraft = (await tx.aircraft.deleteMany({ where: { id: { in: A } } })).count;

      // The audit log is permanent by design: its lines stay, with the demo person's name cleared.
      // Clearing the name is an update, which the audit log's guard blocks, so it is lifted for this
      // one statement only and put back straight after.
      const auditRefs = await tx.auditLog.count({ where: { actorId: { in: U } } });
      const guard = await tx.$queryRaw<Array<{ n: bigint }>>`SELECT count(*)::bigint AS n FROM pg_trigger WHERE tgname = 'audit_log_no_update' AND tgrelid = 'audit_log'::regclass`;
      const hasGuard = Number(guard[0]?.n ?? 0) > 0;
      if (auditRefs && hasGuard) await tx.$executeRawUnsafe('ALTER TABLE audit_log DISABLE TRIGGER audit_log_no_update');
      c.people = (await tx.user.deleteMany({ where: { id: { in: U } } })).count;
      if (auditRefs && hasGuard) await tx.$executeRawUnsafe('ALTER TABLE audit_log ENABLE TRIGGER audit_log_no_update');

      await tx.setting.deleteMany({ where: { key: MANIFEST_KEY } });
      await tx.auditLog.create({ data: { actorId: null, action: 'demo.remove', entityType: 'demo', after: c } });
      return c;
    },
    { timeout: 120_000, maxWait: 20_000 },
  );

  if (opts.quiet) return;
  console.log('Demo data removed:');
  for (const [k, v] of Object.entries(counts)) if (v) console.log(`  ${k.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${v}`);
  console.log('Everything else is as it was.');
}

// ───────────────────────────── Run ─────────────────────────────

async function main() {
  loadEnv();
  const cmd = (process.argv[2] ?? '').toLowerCase();
  if (!['add', 'remove', 'metar'].includes(cmd)) {
    console.log('Usage:  npx tsx prisma/demo-data.ts add | metar | remove');
    process.exitCode = 1;
    return;
  }
  const db = new PrismaClient();
  try {
    if (cmd === 'add') await add(db);
    else if (cmd === 'remove') await remove(db);
    else await metar(db);
  } finally {
    await db.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Failed:', err instanceof Error ? err.message : err);
    console.error('Nothing was changed (every step runs as one unit).');
    process.exitCode = 1;
  });
}
