import { db } from '@/lib/db';
import { forbidden, notFound, route } from '@/lib/api';
import { photoSchema } from '@/lib/validators';
import { decodeImage } from '@/lib/images';
import { audit } from '@/lib/audit';

// Personnel photos. Any signed-in user can see them (crew lists); a person changes their own,
// Admin can change anyone's.

export const GET = route({}, async ({ params }) => {
  const u = await db.user.findUnique({ where: { id: params.id }, select: { photo: true, photoMime: true } });
  if (!u?.photo || !u.photoMime) throw notFound('Photo');
  return new Response(Buffer.from(u.photo), {
    headers: { 'Content-Type': u.photoMime, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' },
  });
});

export const PUT = route({ schema: photoSchema }, async ({ auth, params, body }) => {
  if (params.id !== auth.user.id && !auth.perms.has('personnel.manage')) throw forbidden();
  const { mime, data } = decodeImage(body.dataUrl, 250_000, 'photo');
  const u = await db.user.update({ where: { id: params.id }, data: { photo: new Uint8Array(data), photoMime: mime, photoUpdatedAt: new Date() }, select: { id: true, photoUpdatedAt: true } });
  await audit(auth.user.id, 'user.photo', 'user', params.id, { after: { bytes: data.length } });
  return u;
});

export const DELETE = route({}, async ({ auth, params }) => {
  if (params.id !== auth.user.id && !auth.perms.has('personnel.manage')) throw forbidden();
  await db.user.update({ where: { id: params.id }, data: { photo: null, photoMime: null, photoUpdatedAt: null }, select: { id: true } });
  await audit(auth.user.id, 'user.photo.remove', 'user', params.id);
  return { ok: true };
});
