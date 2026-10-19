'use client';

import { useState } from 'react';
import { api } from '@/lib/client/api';
import { Field, FormError, useSubmit } from './form';

/** CO Flying Wing or the Commander approves or returns a mission order. */
export function OrderDecision({ orderId }: { orderId: string }) {
  const s = useSubmit();
  const [remarks, setRemarks] = useState('');

  async function decide(decision: 'APPROVE' | 'REJECT') {
    if (await s.run(() => api(`mission-orders/${orderId}/decision`, { body: { decision, remarks: remarks.trim() || undefined } }))) window.location.reload();
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border-2 border-brand p-4">
      <FormError error={s.error} />
      <Field id="order-remarks" label="Remarks" error={s.fields.remarks} hint="Required if you return the order.">
        <textarea id="order-remarks" rows={2} className="textarea" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={s.busy} onClick={() => decide('APPROVE')}>
          Approve order
        </button>
        <button className="btn-danger" disabled={s.busy} onClick={() => decide('REJECT')}>
          Return for changes
        </button>
      </div>
    </div>
  );
}

/** The Operations Officer publishes a single sortie from its page. */
export function PublishOne({ missionId }: { missionId: string }) {
  const s = useSubmit();
  return (
    <div className="flex flex-col gap-2">
      <FormError error={s.error} />
      {Object.values(s.fields).map((v, i) => (
        <p key={i} className="field-error">
          {v}
        </p>
      ))}
      <button
        className="btn-primary self-start"
        disabled={s.busy}
        onClick={async () => {
          if (await s.run(() => api('missions/publish', { body: { ids: [missionId] } }))) window.location.reload();
        }}
      >
        {s.busy ? 'Publishing…' : 'Publish to crew'}
      </button>
    </div>
  );
}

export function UploadPdf({ orderId }: { orderId: string }) {
  const s = useSubmit();
  const [file, setFile] = useState<File | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <FormError error={s.error} />
      <label htmlFor="pdf" className="label mb-0">
        Attach a PDF (up to 20 MB)
      </label>
      <input id="pdf" type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <button
        className="btn-secondary self-start"
        disabled={!file || s.busy}
        onClick={async () => {
          const form = new FormData();
          form.append('file', file!);
          if (await s.run(() => api(`mission-orders/${orderId}/attachments`, { form }))) window.location.reload();
        }}
      >
        {s.busy ? 'Uploading…' : 'Upload'}
      </button>
    </div>
  );
}
