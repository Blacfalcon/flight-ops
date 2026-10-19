import { db } from '@/lib/db';
import { conflict, route } from '@/lib/api';
import { newTotpSecret, sealSecret, totpQrDataUrl } from '@/lib/auth/totp';

// Starts two-step sign-in setup: returns a QR code for an authenticator app. Not active until confirmed.
export const POST = route({}, async ({ auth }) => {
  if (auth.user.totpEnabled) throw conflict('Two-step sign-in is already on.');
  const secret = newTotpSecret();
  await db.user.update({ where: { id: auth.user.id }, data: { totpSecretEnc: sealSecret(secret) } });
  return { qr: await totpQrDataUrl(auth.user.email, secret), secret };
});
