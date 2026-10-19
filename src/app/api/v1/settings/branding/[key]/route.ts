import { z } from 'zod';
import { db } from '@/lib/db';
import { notFound, route } from '@/lib/api';
import { decodeImage } from '@/lib/images';
import { audit } from '@/lib/audit';

const KEYS = new Set(['logo', 'watermark']);
const schema = z.object({ dataUrl: z.string().max(3_000_000) });

// Admin uploads the unit logo or the page watermark (sent already resized by the browser).
export const PUT = route({ perm: 'settings.manage', schema }, async ({ auth, params, body }) => {
  if (!KEYS.has(params.key)) throw notFound('Image');
  const { mime, data } = decodeImage(body.dataUrl, 1_500_000);
  const asset = await db.asset.upsert({ where: { key: params.key }, create: { key: params.key, mime, data: new Uint8Array(data) }, update: { mime, data: new Uint8Array(data) } });
  await audit(auth.user.id, `branding.${params.key}`, 'asset', params.key, { after: { mime, bytes: data.length } });
  return { key: asset.key, updatedAt: asset.updatedAt };
});

// Back to the built-in image
export const DELETE = route({ perm: 'settings.manage' }, async ({ auth, params }) => {
  if (!KEYS.has(params.key)) throw notFound('Image');
  await db.asset.deleteMany({ where: { key: params.key } });
  await audit(auth.user.id, `branding.${params.key}.reset`, 'asset', params.key, {});
  return { ok: true };
});
