'use client';

import { useState } from 'react';
import { api } from '@/lib/client/api';
import { submitOrQueue } from '@/lib/client/outbox';
import { FormError, FormNotice, useSubmit } from './form';

export function CloseSnag({ snagId }: { snagId: string }) {
  const s = useSubmit();
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState('');
  if (!open)
    return (
      <button className="btn-secondary btn-sm" onClick={() => setOpen(true)}>
        Close snag
      </button>
    );
  return (
    <div className="flex w-full flex-col gap-2 sm:w-[320px]">
      <FormError error={s.error} />
      <label htmlFor={`act-${snagId}`} className="label mb-0">
        Action taken
      </label>
      <input id={`act-${snagId}`} className="input" value={action} onChange={(e) => setAction(e.target.value)} />
      <div className="flex gap-2">
        <button
          className="btn-primary btn-sm flex-1"
          disabled={!action.trim() || s.busy}
          onClick={async () => {
            if (await s.run(() => api(`snags/${snagId}/close`, { body: { actionTaken: action } }))) window.location.reload();
          }}
        >
          Close
        </button>
        <button className="btn-secondary btn-sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function RaiseSnag({ aircraft }: { aircraft: Array<{ id: string; registration: string }> }) {
  const s = useSubmit();
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const body = { aircraftId: String(f.get('aircraftId')), description: String(f.get('description')) };
    const reg = aircraft.find((a) => a.id === body.aircraftId)?.registration ?? '';
    const res = await s.run(() => submitOrQueue('snag.raise', undefined, body, `Snag on ${reg}`, () => api('snags', { body })));
    if (res) {
      form.reset();
      if (res.queued) s.setNotice('Saved on this device; it will be sent when you are back online.');
      else window.location.reload();
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <FormError error={s.error} />
      <FormNotice notice={s.notice} />
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="sm:w-48">
        <label htmlFor="snag-ac" className="label">
          Aircraft
        </label>
        <select id="snag-ac" name="aircraftId" className="input" required>
          {aircraft.map((a) => (
            <option key={a.id} value={a.id}>
              {a.registration}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1">
        <label htmlFor="snag-desc" className="label">
          Defect
        </label>
        <input id="snag-desc" name="description" className="input" required maxLength={500} />
      </div>
      <button className="btn-primary" disabled={s.busy}>
        Raise
      </button>
    </form>
    </div>
  );
}
