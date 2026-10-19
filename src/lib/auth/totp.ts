import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { decrypt, encrypt } from '../crypto';
import { getSettings } from '../settings';

authenticator.options = { window: 1 }; // accept one 30-second step either side

export function newTotpSecret(): string {
  return authenticator.generateSecret();
}

export async function totpQrDataUrl(email: string, secret: string): Promise<string> {
  const uri = authenticator.keyuri(email, `${(await getSettings()).unit.short} Ops`, secret);
  return QRCode.toDataURL(uri);
}

export function checkTotp(code: string, secret: string): boolean {
  return authenticator.check(code.replace(/\s/g, ''), secret);
}

export function sealSecret(secret: string): string {
  return encrypt(secret);
}

export function openSecret(sealed: string): string {
  return decrypt(sealed);
}
