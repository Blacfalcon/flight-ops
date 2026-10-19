import { db } from '@/lib/db';
import { notFound, route } from '@/lib/api';
import { revokeAllSessions } from '@/lib/auth/session';
import { audit } from '@/lib/audit';

// For a person who lost their phone: turns two-step sign-in off so they can set it up again.
export const POST = route({ perm: 'personnel.manage' }, async ({ auth, params }) => {
  const u = await db.user.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!u) throw notFound('Person');
  await db.user.update({ where: { id: params.id }, data: { totpEnabled: false, totpSecretEnc: null } });
  await revokeAllSessions(params.id);
  await audit(auth.user.id, 'user.mfaReset', 'user', params.id);
  return { ok: true };
});
