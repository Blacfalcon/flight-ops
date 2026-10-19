import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db';
import { invalid, notFound, route } from '@/lib/api';
import { putObject } from '@/lib/storage';
import { audit } from '@/lib/audit';

const MAX_BYTES = 20 * 1024 * 1024;

// Upload a PDF to a mission order (multipart form field "file").
export const POST = route({ perm: 'order.manage' }, async ({ auth, params, req }) => {
  const order = await db.missionOrder.findUnique({ where: { id: params.id } });
  if (!order) throw notFound('Mission order');
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw invalid('Choose a PDF file.', { file: 'Required.' });
  if (file.size > MAX_BYTES) throw invalid('The file is larger than 20 MB.', { file: 'Too large.' });
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') throw invalid('Only PDF files can be attached.', { file: 'Not a PDF.' });

  const key = `mission-orders/${order.id}/${randomUUID()}.pdf`;
  await putObject(key, bytes, 'application/pdf');
  const att = await db.attachment.create({
    data: {
      entityType: 'mission_order',
      entityId: order.id,
      fileName: file.name.replace(/[^\w.\- ]/g, '_').slice(0, 150) || 'order.pdf',
      mimeType: 'application/pdf',
      sizeBytes: file.size,
      storageKey: key,
      uploadedById: auth.user.id,
    },
  });
  await audit(auth.user.id, 'attachment.upload', 'attachment', att.id, { after: { fileName: att.fileName, sizeBytes: att.sizeBytes } });
  return att;
});
