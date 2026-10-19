// Risk scoring. Pure functions, shared by the API (authoritative) and the form (live preview).

export type Ratings = {
  weather: number;
  aircraftCondition: number;
  crewReadiness: number;
  missionComplexity: number;
  fuelStatus: number;
  terrain: number;
  fatigue: number;
  operationalThreats: number;
};

export type Imsafe = {
  illness: boolean;
  medication: boolean;
  stress: boolean;
  alcohol: boolean;
  fatigue: boolean;
  eating: boolean;
};

export type Thresholds = { lowMax: number; mediumMax: number; softImsafePoints: number };

export type RiskResult = {
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  reason: string;
  mitigationRequired: boolean;
  hardImsafe: boolean;
};

const LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;

export function computeRisk(r: Ratings, crewImsafe: Imsafe[], t: Thresholds): RiskResult {
  const values = Object.values(r);
  let score = values.reduce((a, b) => a + b, 0);

  const hardImsafe = crewImsafe.some((i) => i.illness || i.medication || i.alcohol);
  const softCount = crewImsafe.reduce((n, i) => n + (i.stress ? 1 : 0) + (i.fatigue ? 1 : 0) + (i.eating ? 1 : 0), 0);
  score += softCount * t.softImsafePoints;

  let lvl = score <= t.lowMax ? 0 : score <= t.mediumMax ? 1 : 2;
  let reason = lvl === 0 ? `Score ${score} is within Low (up to ${t.lowMax})` : lvl === 1 ? `Score ${score} is within Medium (${t.lowMax + 1}–${t.mediumMax})` : `Score ${score} is within High (over ${t.mediumMax})`;

  const highCount = values.filter((v) => v >= 4).length;
  if (values.includes(5) && lvl < 1) {
    lvl = 1;
    reason = 'A category is rated 5';
  }
  if (highCount >= 3 && lvl < 2) {
    lvl = 2;
    reason = 'Three or more categories are rated 4 or above';
  }
  if (hardImsafe) {
    lvl = 2;
    reason = 'IMSAFE: illness, medication or alcohol reported';
  }
  if (softCount > 0 && !hardImsafe) reason += ` (IMSAFE added ${softCount * t.softImsafePoints})`;

  return { score, level: LEVELS[lvl], reason, mitigationRequired: highCount > 0 || lvl === 2, hardImsafe };
}

export function validRatings(r: Ratings): boolean {
  return Object.values(r).every((v) => Number.isInteger(v) && v >= 1 && v <= 5);
}

export type Minima = { visibilityM: number; ceilingFt: number; nightVisibilityM: number; nightCeilingFt: number };

/**
 * Suggested weather rating from the latest observation against VMC minima.
 * 1–2 comfortably above, 3 within 50% of the minima, 4 at the minima, 5 below.
 */
export function weatherRatingFrom(
  obs: { visibilityM: number | null; ceilingFt: number | null } | null,
  minima: Minima,
  night: boolean,
): { rating: number; note: string } {
  if (!obs) return { rating: 3, note: 'No current METAR; rate the weather yourself.' };
  const visMin = night ? minima.nightVisibilityM : minima.visibilityM;
  const ceilMin = night ? minima.nightCeilingFt : minima.ceilingFt;
  const vis = obs.visibilityM ?? 10_000;
  // 10 km or more (9999 / CAVOK) and no ceiling are treated as unrestricted
  const visRatio = vis >= 10_000 ? Number.POSITIVE_INFINITY : vis / visMin;
  const ceilRatio = obs.ceilingFt == null ? Number.POSITIVE_INFINITY : obs.ceilingFt / ceilMin;
  const ratio = Math.min(visRatio, ceilRatio);
  if (ratio < 1) return { rating: 5, note: 'Below VMC minima' };
  if (ratio < 1.2) return { rating: 4, note: 'At or near VMC minima' };
  if (ratio < 1.5) return { rating: 3, note: 'Within 50% of VMC minima' };
  if (ratio < 2.5) return { rating: 2, note: 'Above VMC minima' };
  return { rating: 1, note: 'Well above VMC minima' };
}
