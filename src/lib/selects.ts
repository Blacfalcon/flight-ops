// Safe field selections: never return password hashes or secrets to the browser.

export const publicUser = {
  id: true,
  rank: true,
  fullName: true,
  firstName: true,
  middleName: true,
  surname: true,
  nafNumber: true,
  email: true,
  phone: true,
  appointment: true,
  flightStatus: true,
  pilotCategory: true,
  accountStatus: true,
  totpEnabled: true,
  lastLoginAt: true,
  photoUpdatedAt: true, // the photo itself is served by /api/v1/users/:id/photo
  createdAt: true,
} as const;

export const nameOnly = { id: true, rank: true, fullName: true, appointment: true, flightStatus: true, pilotCategory: true, photoUpdatedAt: true } as const;
