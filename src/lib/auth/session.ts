import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import type { User } from '@prisma/client';
import { db } from '../db';
import { env } from '../env';
import { hashToken, randomToken } from '../crypto';
import { ACCESS_COOKIE, MFA_DAY_COOKIE, REFRESH_COOKIE, signAccessToken, signMfaDay, verifyAccessToken } from './jwt';
import { localDate, localDayBounds } from '../time';
import { permissionsFor, rolesFor, type Permission, type Role } from '../rbac';

export type AuthContext = {
  user: Omit<User, 'photo'>; // the photo bytes are served separately
  sessionId: string;
  roles: Role[];
  perms: Set<Permission>;
  actingCommander: boolean;
  mfaSetupRequired: boolean;
};

const MFA_APPOINTMENTS = new Set(['COMMANDER', 'GOO', 'ADMIN']);

export async function isActingCommander(userId: string, appointment: string, at: Date = new Date()): Promise<boolean> {
  if (appointment !== 'GOO') return false;
  const d = await db.delegation.findFirst({
    where: { toUserId: userId, cancelledAt: null, startsAt: { lte: at }, endsAt: { gt: at } },
    select: { id: true },
  });
  return !!d;
}

export async function buildContext(user: Omit<User, 'photo'>, sessionId: string): Promise<AuthContext> {
  const actingCommander = await isActingCommander(user.id, user.appointment);
  const roles = rolesFor(user, { actingCommander });
  return {
    user,
    sessionId,
    roles,
    perms: permissionsFor(roles),
    actingCommander,
    mfaSetupRequired: MFA_APPOINTMENTS.has(user.appointment) && !user.totpEnabled,
  };
}

/** The signed-in person for this request, or null. Cached per request. */
export const getAuth = cache(async (): Promise<AuthContext | null> => {
  const jar = await cookies();
  const claims = await verifyAccessToken(jar.get(ACCESS_COOKIE)?.value);
  if (!claims) return null;
  const session = await db.session.findUnique({ where: { id: claims.sid }, include: { user: { omit: { photo: true } } } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  if (session.userId !== claims.sub || session.user.accountStatus !== 'ACTIVE') return null;
  return buildContext(session.user, session.id);
});

type CookieWriter = { set: (name: string, value: string, opts: Record<string, unknown>) => unknown };

function cookieOpts(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export function writeAuthCookies(target: CookieWriter, accessToken: string, refreshToken: string) {
  target.set(ACCESS_COOKIE, accessToken, cookieOpts(env.accessTokenMinutes * 60));
  target.set(REFRESH_COOKIE, refreshToken, cookieOpts(env.refreshTokenDays * 86_400));
}

/** Remember a passed two-step check on this device until local midnight. */
export async function writeMfaDayCookie(target: CookieWriter, userId: string) {
  const day = localDate();
  const end = localDayBounds(day).end;
  const token = await signMfaDay(userId, day, end);
  target.set(MFA_DAY_COOKIE, token, cookieOpts(Math.max(60, Math.floor((end.getTime() - Date.now()) / 1000))));
}

export function clearAuthCookies(target: CookieWriter) {
  target.set(ACCESS_COOKIE, '', cookieOpts(0));
  target.set(REFRESH_COOKIE, '', cookieOpts(0));
}

async function requestMeta() {
  const h = await headers();
  return {
    ip: h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    device: h.get('user-agent')?.slice(0, 200) ?? null,
  };
}

export async function createSession(userId: string): Promise<{ accessToken: string; refreshToken: string; sessionId: string }> {
  const refreshToken = randomToken();
  const meta = await requestMeta();
  const session = await db.session.create({
    data: {
      userId,
      refreshTokenHash: hashToken(refreshToken),
      ip: meta.ip,
      device: meta.device,
      expiresAt: new Date(Date.now() + env.refreshTokenDays * 86_400_000),
    },
  });
  const accessToken = await signAccessToken({ sub: userId, sid: session.id }, env.accessTokenMinutes);
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date(), failedLogins: 0, lockedUntil: null } });
  return { accessToken, refreshToken, sessionId: session.id };
}

/** Rotates the refresh token. Returns null if the session is gone, revoked, expired or idle too long. */
export async function refreshSession(refreshToken: string | undefined) {
  if (!refreshToken) return null;
  const session = await db.session.findUnique({ where: { refreshTokenHash: hashToken(refreshToken) }, include: { user: { omit: { photo: true } } } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  if (session.user.accountStatus !== 'ACTIVE') return null;
  const idleMs = env.idleTimeoutMinutes * 60_000;
  if (Date.now() - session.lastSeenAt.getTime() > idleMs + env.accessTokenMinutes * 60_000) {
    await db.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    return null;
  }
  const next = randomToken();
  await db.session.update({
    where: { id: session.id },
    data: { refreshTokenHash: hashToken(next), lastSeenAt: new Date() },
  });
  const accessToken = await signAccessToken({ sub: session.userId, sid: session.id }, env.accessTokenMinutes);
  return { accessToken, refreshToken: next, userId: session.userId };
}

export async function revokeSession(sessionId: string) {
  await db.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function revokeAllSessions(userId: string) {
  await db.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}
