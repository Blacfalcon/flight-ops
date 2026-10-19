import { db } from '@/lib/db';
import { ApiError, conflict, route } from '@/lib/api';
import { codeSchema } from '@/lib/validators';
import { checkTotp, openSecret } from '@/lib/auth/totp';
import { audit } from '@/lib/audit';

export const POST = route({ schema: codeSchema }, async ({ auth, body }) => {
  const user = await db.user.findUnique({ where: { id: auth.user.id } });
  if (!user?.totpSecretEnc) throw conflict('Start the setup first.');
  if (user.totpEnabled) throw conflict('Two-step sign-in is already on.');
  if (!checkTotp(body.code, openSecret(user.totpSecretEnc))) throw new ApiError(400, 'bad_code', 'That code is not right. Try the newest code.', { code: 'Not right.' });
  await db.user.update({ where: { id: user.id }, data: { totpEnabled: true } });
  await audit(user.id, 'auth.mfaEnabled', 'user', user.id);
  return { ok: true };
});
