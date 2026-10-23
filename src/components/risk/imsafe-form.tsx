'use client';

import { useState } from 'react';
import { api } from '@/lib/client/api';
import { submitOrQueue } from '@/lib/client/outbox';
import type { Imsafe } from '@/lib/rules/risk';
import { FormError, useSubmit } from '../form';
import { ImsafeToggles, NO_IMSAFE } from './imsafe-toggles';

export function ImsafeForm({ riskId, missionNo }: { riskId: string; missionNo: string }) {
  const s = useSubmit();
  const [value, setValue] = useState<Imsafe>(NO_IMSAFE);
  const [notes, setNotes] = useState('');
  const [state, setState] = useState<'form' | 'sent' | 'queued'>('form');

  async function submit() {
    const body = { ...value, notes: notes || undefined };
    const res = await s.run(() => submitOrQueue('imsafe', riskId, body, `${missionNo}: IMSAFE check`, () => api(`risk-assessments/${riskId}/imsafe`, { method: 'PUT', body })));
    if (res) setState(res.queued ? 'queued' : 'sent');
  }

  if (state !== 'form')
    return (
      <div role="status" className={state === 'queued' ? 'alert-warn' : 'alert-good'}>
        {state === 'queued' ? 'Saved on this device; it will be sent when you are back online.' : 'Your IMSAFE check is in. The approvers can now decide.'}
      </div>
    );

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <FormError error={s.error} />
      <section className="card flex flex-col gap-3 p-4">
        <h2>Your IMSAFE Check</h2>
        <p className="text-[13px] text-ink-muted">Is any of these affecting you today? A yes may raise the mission’s risk level.</p>
        <ImsafeToggles value={value} onChange={setValue} />
        <label htmlFor="notes" className="label mt-2">
          Notes (optional)
        </label>
        <textarea id="notes" rows={2} className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </section>
      <button className="btn-primary h-12" disabled={s.busy} onClick={submit}>
        Submit IMSAFE
      </button>
    </div>
  );
}
