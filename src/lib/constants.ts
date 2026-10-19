// Shared labels and option lists. Safe to import from client components (no server imports).
// The values match the Prisma enums exactly.

export const RANKS = [
  'PILOT_OFFICER',
  'FLYING_OFFICER',
  'FLIGHT_LIEUTENANT',
  'SQUADRON_LEADER',
  'WING_COMMANDER',
  'GROUP_CAPTAIN',
  'AIR_COMMODORE',
  'AIR_VICE_MARSHAL',
] as const;
export type RankValue = (typeof RANKS)[number];

export const RANK_LABEL: Record<RankValue, string> = {
  PILOT_OFFICER: 'Pilot Officer',
  FLYING_OFFICER: 'Flying Officer',
  FLIGHT_LIEUTENANT: 'Flight Lieutenant',
  SQUADRON_LEADER: 'Squadron Leader',
  WING_COMMANDER: 'Wing Commander',
  GROUP_CAPTAIN: 'Group Captain',
  AIR_COMMODORE: 'Air Commodore',
  AIR_VICE_MARSHAL: 'Air Vice Marshal',
};

export const RANK_SHORT: Record<RankValue, string> = {
  PILOT_OFFICER: 'Plt Offr',
  FLYING_OFFICER: 'Fg Offr',
  FLIGHT_LIEUTENANT: 'Flt Lt',
  SQUADRON_LEADER: 'Sqn Ldr',
  WING_COMMANDER: 'Wg Cdr',
  GROUP_CAPTAIN: 'Gp Capt',
  AIR_COMMODORE: 'Air Cdre',
  AIR_VICE_MARSHAL: 'AVM',
};

export const APPOINTMENTS = [
  'COMMANDER',
  'GOO',
  'CO_FLYING_WING',
  'CO_ENGINEERING',
  'OPERATIONS_OFFICER',
  'TRAINING_OFFICER',
  'SAFETY_OFFICER',
  'SQUADRON_PILOT',
  'ADMIN',
] as const;
export type AppointmentValue = (typeof APPOINTMENTS)[number];

export const APPOINTMENT_LABEL: Record<AppointmentValue, string> = {
  COMMANDER: 'Commander',
  GOO: 'GOO',
  CO_FLYING_WING: 'CO Flying Wing',
  CO_ENGINEERING: 'CO Engineering',
  OPERATIONS_OFFICER: 'Operations Officer',
  TRAINING_OFFICER: 'Training Officer',
  SAFETY_OFFICER: 'Safety Officer',
  SQUADRON_PILOT: 'Squadron Pilot',
  ADMIN: 'Admin',
};

export const FLIGHT_STATUSES = ['CAPTAIN', 'CO_PILOT', 'NONE'] as const;
export type FlightStatusValue = (typeof FLIGHT_STATUSES)[number];
export const FLIGHT_STATUS_LABEL: Record<FlightStatusValue, string> = {
  CAPTAIN: 'Captain',
  CO_PILOT: 'Co-Pilot',
  NONE: 'Not a pilot',
};

export const PILOT_CATEGORIES = ['INSTRUCTOR', 'TRAINEE', 'NIL'] as const;
export type PilotCategoryValue = (typeof PILOT_CATEGORIES)[number];
export const PILOT_CATEGORY_LABEL: Record<PilotCategoryValue, string> = {
  INSTRUCTOR: 'Instructor Pilot',
  TRAINEE: 'Trainee Pilot',
  NIL: 'Nil',
};

export const AIRCRAFT_STATUSES = ['SERVICEABLE', 'UNSERVICEABLE', 'UNDER_MAINTENANCE', 'INSPECTION_DUE'] as const;
export type AircraftStatusValue = (typeof AIRCRAFT_STATUSES)[number];
export const AIRCRAFT_STATUS_LABEL: Record<AircraftStatusValue, string> = {
  SERVICEABLE: 'Serviceable',
  UNSERVICEABLE: 'Unserviceable',
  UNDER_MAINTENANCE: 'Under Maintenance',
  INSPECTION_DUE: 'Inspection Due',
};

export const MISSION_CATEGORIES = ['TRAINING', 'OPERATIONAL'] as const;
export type MissionCategoryValue = (typeof MISSION_CATEGORIES)[number];
export const MISSION_CATEGORY_LABEL: Record<MissionCategoryValue, string> = { TRAINING: 'Training', OPERATIONAL: 'Operational' };
export const MISSION_CATEGORY_PREFIX: Record<MissionCategoryValue, string> = { TRAINING: 'TRG', OPERATIONAL: 'OPS' };

// Mission types under each category. The code is stored on the mission; the label is shown.
export const MISSION_TYPES: Record<MissionCategoryValue, ReadonlyArray<{ code: string; label: string }>> = {
  TRAINING: [
    { code: 'LOCAL_FAMILIARISATION', label: 'Local Familiarisation' },
    { code: 'CIRCUITS_LANDINGS', label: 'Circuits & Landings' },
    { code: 'INSTRUMENT_HOOD', label: 'Instrument / Hood Flying' },
    { code: 'NAVIGATION_EXERCISE', label: 'Navigation Exercise' },
    { code: 'FORMATION', label: 'Formation Flying' },
    { code: 'NIGHT_FLYING', label: 'Night Flying' },
    { code: 'CONFINED_AREA_PINNACLE', label: 'Confined Area / Pinnacle Landing' },
    { code: 'EMERGENCY_PROCEDURES', label: 'Emergency Procedures Training' },
    { code: 'CONVERSION', label: 'Conversion Training' },
    { code: 'CHECK_RIDE', label: 'Check Ride / Proficiency Check' },
    { code: 'WINCHING_SLING_LOAD', label: 'Winching / Sling Load Training' },
  ],
  OPERATIONAL: [
    { code: 'AIR_MOBILITY', label: 'Air Mobility / Troop Transport' },
    { code: 'CASEVAC', label: 'Casualty Evacuation' },
    { code: 'RECCE_SURVEILLANCE', label: 'Reconnaissance / Surveillance' },
    { code: 'LOGISTICS_RESUPPLY', label: 'Logistics / Resupply' },
    { code: 'SEARCH_AND_RESCUE', label: 'Search and Rescue' },
    { code: 'STAFF_VIP_TRANSPORT', label: 'Staff / VIP Transport' },
    { code: 'GROUND_FORCE_SUPPORT', label: 'Ground Force Support' },
    { code: 'AIR_TEST', label: 'Air Test (Post-Maintenance)' },
    { code: 'FERRY', label: 'Ferry Flight' },
  ],
};

const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  Object.values(MISSION_TYPES).flatMap((list) => list.map((t) => [t.code, t.label])),
);

/** Label for a stored mission type code; unknown codes are shown as stored. */
export function missionTypeLabel(code: string): string {
  return TYPE_LABELS[code] ?? code.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
}

export function isMissionType(category: MissionCategoryValue, code: string): boolean {
  return MISSION_TYPES[category].some((t) => t.code === code);
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Awaiting approval',
  APPROVED: 'Approved',
  REJECTED: 'Returned',
};

export const MISSION_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  AWAITING_ENGINEERING: 'Awaiting engineering',
  PUBLISHED: 'Published',
  CREW_READY: 'Crew ready',
  RISK_SUBMITTED: 'Awaiting approval',
  CLEARED: 'Cleared to fly',
  COMPLETED: 'Completed',
  ABORTED: 'Aborted',
  CANCELLED: 'Cancelled',
};

export const SEATS = ['INSTRUCTOR', 'TRAINEE', 'CAPTAIN', 'CO_PILOT'] as const;
export type SeatValue = (typeof SEATS)[number];
export const SEAT_LABEL: Record<SeatValue, string> = {
  INSTRUCTOR: 'Instructor Pilot',
  TRAINEE: 'Trainee Pilot',
  CAPTAIN: 'Captain',
  CO_PILOT: 'Co-Pilot',
};
export const SEAT_SHORT: Record<SeatValue, string> = {
  INSTRUCTOR: 'IP',
  TRAINEE: 'TP',
  CAPTAIN: 'C',
  CO_PILOT: 'CP',
};

export const READINESS_LABEL: Record<string, string> = {
  PENDING: 'Awaiting reply',
  READY: 'Ready',
  NOT_AVAILABLE: 'Not available',
  NO_RESPONSE: 'No response',
};

export const RISK_CATEGORIES = [
  { key: 'weather', label: 'Weather', group: 'Environment', low: 'Well above minima, stable forecast', high: 'At or below minima, deteriorating forecast' },
  { key: 'aircraftCondition', label: 'Aircraft condition', group: 'Aircraft', low: 'Serviceable, no open snags', high: 'Deferred defects affect the task' },
  { key: 'crewReadiness', label: 'Crew readiness', group: 'Pilot', low: 'Current, rested, familiar with task', high: 'Not current on the task or aircraft type' },
  { key: 'missionComplexity', label: 'Mission complexity', group: 'External pressures', low: 'Routine local sortie', high: 'Night, formation or new task with time pressure' },
  { key: 'fuelStatus', label: 'Fuel status', group: 'Aircraft', low: 'Full reserves plus alternate', high: 'Minimum fuel, no alternate margin' },
  { key: 'terrain', label: 'Terrain', group: 'Environment', low: 'Familiar, open terrain', high: 'Unfamiliar, confined or mountainous area' },
  { key: 'fatigue', label: 'Fatigue', group: 'Pilot', low: 'Full rest, early in duty day', high: 'Near the end of duty limits' },
  { key: 'operationalThreats', label: 'Operational threats', group: 'External pressures', low: 'No known threat', high: 'Known hostile activity on the route' },
] as const;
export type RiskCategoryKey = (typeof RISK_CATEGORIES)[number]['key'];

export const IMSAFE_ITEMS = [
  { key: 'illness', label: 'Illness', hard: true },
  { key: 'medication', label: 'Medication', hard: true },
  { key: 'stress', label: 'Stress', hard: false },
  { key: 'alcohol', label: 'Alcohol', hard: true },
  { key: 'fatigue', label: 'Fatigue', hard: false },
  { key: 'eating', label: 'Eating', hard: false },
] as const;
export type ImsafeKey = (typeof IMSAFE_ITEMS)[number]['key'];

export const APPROVER_ROLE_LABEL: Record<string, string> = {
  COMMANDER: 'Commander',
  CO_FLYING_WING: 'CO Flying Wing',
  CO_ENGINEERING: 'CO Engineering',
  OPERATIONS_OFFICER: 'Operations Officer',
};

export const DECISION_LABEL: Record<string, string> = {
  APPROVE: 'Approved',
  APPROVE_WITH_REMARKS: 'Approved with remarks',
  REJECT: 'Rejected',
};

export const PRIORITY_LABEL: Record<string, string> = {
  ROUTINE: 'Routine',
  PRIORITY: 'Priority',
  IMMEDIATE: 'Immediate',
};

export function personName(u: { rank: string; fullName: string }): string {
  const short = RANK_SHORT[u.rank as RankValue] ?? u.rank;
  return `${short} ${u.fullName}`;
}
