import { z } from 'zod';
import { db } from '@/lib/db';
import { invalid, route } from '@/lib/api';
import { verifyPassword } from '@/lib/auth/password';
import { requestDeletion } from '@/lib/services/account-deletion';

const schema = z.object({ password: z.string().min(1).max(200), reason: z.string().trim().max(500).optional() });

// A signed-in person asks for their own account to be deleted (required by the App Store).
export const POST = route({ schema }, async ({ auth, body }) => {
  const user = await db.user.findUnique({ where: { id: auth.user.id }, select: { passwordHash: true } });
  if (!user || !(await verifyPassword(user.passwordHash, body.password))) throw invalid('That password is not right.', { password: 'Check your password.' });
  await requestDeletion(auth.user.id, body.reason, 'app');
  return { ok: true };
});
