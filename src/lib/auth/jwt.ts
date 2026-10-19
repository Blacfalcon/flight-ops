import { SignJWT, jwtVerify } from 'jose';

// Edge-safe: used by middleware as well as route handlers.

export const ACCESS_COOKIE = 'fo_at';
export const REFRESH_COOKIE = 'fo_rt';

export type AccessClaims = { sub: string; sid: string };

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('Missing environment variable JWT_SECRET');
  return new TextEncoder().encode(s);
}

export async function signAccessToken(claims: AccessClaims, minutes: number): Promise<string> {
  return new SignJWT({ sid: claims.sid })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setIssuer('flight-ops')
    .setExpirationTime(`${minutes}m`)
    .sign(secret());
}

/** Short-lived proof that the password step passed, used for the two-step code step */
export async function signMfaChallenge(userId: string): Promise<string> {
  return new SignJWT({ purpose: 'mfa' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setIssuer('flight-ops')
    .setExpirationTime('5m')
    .sign(secret());
}

export async function verifyMfaChallenge(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: 'flight-ops' });
    return payload.purpose === 'mfa' && typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function verifyAccessToken(token: string | undefined): Promise<AccessClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: 'flight-ops' });
    if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') return null;
    return { sub: payload.sub, sid: payload.sid };
  } catch {
    return null;
  }
}

// Two-step sign-in is asked for once per day on each device. After a correct code the device gets
// this signed cookie, valid for that user until local midnight.
export const MFA_DAY_COOKIE = 'fo_mfa_day';

export async function signMfaDay(userId: string, day: string, expiresAt: Date): Promise<string> {
  return new SignJWT({ purpose: 'mfa-day', day })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setIssuer('flight-ops')
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secret());
}

export async function verifyMfaDay(token: string | undefined, userId: string, day: string): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: 'flight-ops' });
    return payload.purpose === 'mfa-day' && payload.sub === userId && payload.day === day;
  } catch {
    return false;
  }
}
