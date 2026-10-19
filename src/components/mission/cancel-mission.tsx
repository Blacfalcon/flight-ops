'use client';

import { useState } from 'react';
import { api } from '@/lib/client/api';
import { FormError, useSubmit } from '../form';

export function CancelMission({ missionId }: { missionId: string }) {
  const s = useSubmit();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  if (!open)
    return (
      <button className="btn-danger btn-sm" onClick={() => setOpen(true)}>
        Cancel mission
      </button>
    );

  return (
    <div className="flex w-full flex-col gap-2 rounded-lg border border-bad-solid bg-white p-3 sm:w-[340px]">
      <FormError error={s.error} />
      <label htmlFor="cancel-reason" className="label">
        Reason for cancelling
      </label>
      <textarea id="cancel-reason" className="textarea" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="flex gap-2">
        <button
          className="btn-danger btn-sm flex-1"
          disabled={!reason.trim() || s.busy}
          onClick={async () => {
            if (await s.run(() => api(`missions/${missionId}/cancel`, { body: { reason } }))) window.location.reload();
          }}
        >
          Confirm cancel
        </button>
        <button className="btn-secondary btn-sm" onClick={() => setOpen(false)}>
          Keep
        </button>
      </div>
    </div>
  );
}
