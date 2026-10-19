// Crew pairing rules. Pure functions, shared by the API and the schedule builder screen.

export type CrewMember = {
  userId: string;
  seat: 'INSTRUCTOR' | 'TRAINEE' | 'CAPTAIN' | 'CO_PILOT';
  flightStatus: 'CAPTAIN' | 'CO_PILOT' | 'NONE';
  pilotCategory: 'INSTRUCTOR' | 'TRAINEE' | 'NIL';
  name?: string;
};

/** Who may sit in each seat */
export function eligibleForSeat(
  seat: CrewMember['seat'],
  p: { flightStatus: CrewMember['flightStatus']; pilotCategory: CrewMember['pilotCategory'] },
): boolean {
  switch (seat) {
    case 'INSTRUCTOR':
      return p.pilotCategory === 'INSTRUCTOR' && p.flightStatus !== 'NONE';
    case 'TRAINEE':
      return p.pilotCategory === 'TRAINEE' && p.flightStatus !== 'NONE';
    case 'CAPTAIN':
      return p.flightStatus === 'CAPTAIN';
    case 'CO_PILOT':
      return p.flightStatus === 'CO_PILOT' || p.flightStatus === 'CAPTAIN';
  }
}

/** Returns a list of problems; empty means the crew is valid. */
export function validateCrew(crew: CrewMember[]): Array<{ field: string; message: string }> {
  const errors: Array<{ field: string; message: string }> = [];
  const bySeat = new Map(crew.map((c) => [c.seat, c]));

  const seen = new Set<string>();
  for (const c of crew) {
    if (seen.has(c.userId)) errors.push({ field: `crew.${c.seat}`, message: 'The same person cannot fill two seats.' });
    seen.add(c.userId);
    if (!eligibleForSeat(c.seat, c)) {
      errors.push({ field: `crew.${c.seat}`, message: `${c.name ?? 'This person'} cannot fly as ${seatName(c.seat)}.` });
    }
  }

  if (bySeat.has('TRAINEE') && !bySeat.has('INSTRUCTOR')) {
    errors.push({ field: 'crew.INSTRUCTOR', message: 'A Trainee Pilot must fly with an Instructor Pilot.' });
  }
  if (bySeat.has('CO_PILOT') && !bySeat.has('INSTRUCTOR') && !bySeat.has('CAPTAIN')) {
    errors.push({ field: 'crew.CAPTAIN', message: 'A Co-Pilot must fly with an Instructor Pilot or a Captain.' });
  }
  if (crew.length < 2) {
    errors.push({ field: 'crew', message: 'Assign at least two crew members.' });
  }
  return errors;
}

/** The pilot in command: instructor first, then captain. */
export function pilotInCommandSeat(seats: Array<CrewMember['seat']>): CrewMember['seat'] | null {
  if (seats.includes('INSTRUCTOR')) return 'INSTRUCTOR';
  if (seats.includes('CAPTAIN')) return 'CAPTAIN';
  return null;
}

function seatName(seat: CrewMember['seat']): string {
  return { INSTRUCTOR: 'Instructor Pilot', TRAINEE: 'Trainee Pilot', CAPTAIN: 'Captain', CO_PILOT: 'Co-Pilot' }[seat];
}
