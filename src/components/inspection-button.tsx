'use client';

import { formatHours } from '@/lib/hours';
import { useState } from 'react';
import { api } from '@/lib/client/api';
import { FormError, useSubmit } from './form';

export function InspectionButton({ aircraftId, intervalHours, intervalDays }: { aircraftId: string; intervalHours: number; intervalDays: number | null }) {
  const s = useSubmit();
  const [open, setOpen] = useState(false);
  const [remarks, setRemarks] = useState('');
  if (!open)
    return (
      <button className="btn-outline btn-sm" onClick={() => setOpen(true)}>
        Inspection completed
      </button>
    );
  return (
    <div className="flex w-full flex-col gap-2 rounded-lg border border-brand bg-white p-3 sm:w-[360px]">
      <FormError error={s.error} />
      <p className="text-[13px]">
        Resets hours to inspection to {formatHours(intervalHours)}{intervalDays ? ` and the due date to ${intervalDays} days from today` : ''}, and marks the aircraft Serviceable.
      </p>
      <label htmlFor="insp-remarks" className="label mb-0">
        Remarks
      </label>
      <input id="insp-remarks" className="input" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. 100 h inspection completed" />
      <div className="flex gap-2">
        <button
          className="btn-primary btn-sm flex-1"
          disabled={s.busy}
          onClick={async () => {
            if (await s.run(() => api(`aircraft/${aircraftId}/inspection-complete`, { body: { remarks: remarks || undefined } }))) window.location.reload();
          }}
        >
          Confirm
        </button>
        <button className="btn-secondary btn-sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
