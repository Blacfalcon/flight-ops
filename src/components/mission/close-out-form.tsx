'use client';

import { useState } from 'react';
import { api } from '@/lib/client/api';
import { submitOrQueue } from '@/lib/client/outbox';
import { Field, FormError, useSubmit } from '../form';

export function CloseOutForm({ missionId, missionNo, canComplete }: { missionId: string; missionNo: string; canComplete: boolean }) {
  const s = useSubmit();
  const [outcome, setOutcome] = useState<'COMPLETED' | 'ABORTED' | null>(null);
  const [snags, setSnags] = useState<string[]>(['']);
  const [queued, setQueued] = useState(false);

  if (queued)
    return (
      <div role="status" className="alert-warn">
        Saved on this device. It will be sent when you are back online.
      </div>
    );

  if (!outcome)
    return (
      <div className="flex flex-col gap-3 sm:flex-row">
        <button className="btn-primary flex-1" disabled={!canComplete} onClick={() => setOutcome('COMPLETED')}>
          Mission Completed
        </button>
        <button className="btn-danger flex-1" onClick={() => setOutcome('ABORTED')}>
          Mission Aborted
        </button>
        {!canComplete && <p className="text-[13px] text-ink-muted sm:self-center">Completed is available once the mission is cleared to fly.</p>}
      </div>
    );

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const hours = Number(f.get('hours') || 0);
    const minutes = Number(f.get('minutes') || 0);
    const body = {
      outcome,
      flightTimeMin: hours * 60 + minutes,
      fuelUsed: Number(f.get('fuelUsed') || 0),
      fuelUnit: f.get('fuelUnit'),
      snags: snags.map((x) => x.trim()).filter(Boolean),
      remarks: String(f.get('remarks') ?? ''),
      missionOutcome: outcome === 'COMPLETED' ? String(f.get('missionOutcome') ?? '') : undefined,
      abortReason: outcome === 'ABORTED' ? String(f.get('abortReason') ?? '') : undefined,
    };
    const res = await s.run(() =>
      submitOrQueue('report.submit', missionId, body, `${missionNo}: mission ${outcome === 'COMPLETED' ? 'completed' : 'aborted'} report`, () => api(`missions/${missionId}/report`, { body })),
    );
    if (!res) return;
    if (res.queued) setQueued(true);
    else window.location.reload();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className={outcome === 'COMPLETED' ? 'pill-good' : 'pill-bad'}>{outcome === 'COMPLETED' ? 'Mission Completed' : 'Mission Aborted'}</span>
        <button type="button" className="text-[13px] font-semibold text-brand" onClick={() => setOutcome(null)}>
          Change
        </button>
      </div>
      <FormError error={s.error} />
      {outcome === 'ABORTED' && (
        <Field id="abortReason" label="Abort reason" error={s.fields.abortReason}>
          <textarea id="abortReason" name="abortReason" rows={2} className="textarea" required />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field id="hours" label="Flight time (h)" error={s.fields.flightTimeMin}>
          <input id="hours" name="hours" type="number" min={0} max={24} inputMode="numeric" className="input" defaultValue={0} />
        </Field>
        <Field id="minutes" label="(min)">
          <input id="minutes" name="minutes" type="number" min={0} max={59} inputMode="numeric" className="input" defaultValue={0} />
        </Field>
        <Field id="fuelUsed" label="Fuel used" error={s.fields.fuelUsed}>
          <input id="fuelUsed" name="fuelUsed" type="number" min={0} step="0.1" inputMode="decimal" className="input" required />
        </Field>
        <Field id="fuelUnit" label="Unit">
          <select id="fuelUnit" name="fuelUnit" className="input" defaultValue="kg">
            <option value="kg">kg</option>
            <option value="l">litres</option>
          </select>
        </Field>
      </div>
      <div className="flex flex-col gap-2">
        <span className="label mb-0">Snags (one per line; leave empty if none)</span>
        {snags.map((sn, i) => (
          <input
            key={i}
            aria-label={`Snag ${i + 1}`}
            className="input"
            value={sn}
            onChange={(e) => setSnags((list) => list.map((x, j) => (j === i ? e.target.value : x)))}
            placeholder="Describe the defect"
          />
        ))}
        <button type="button" className="self-start text-[13px] font-semibold text-brand" onClick={() => setSnags((l) => [...l, ''])}>
          + Add another snag
        </button>
      </div>
      {outcome === 'COMPLETED' && (
        <Field id="missionOutcome" label="Mission outcome" error={s.fields.missionOutcome}>
          <textarea id="missionOutcome" name="missionOutcome" rows={2} className="textarea" required />
        </Field>
      )}
      <Field id="remarks" label={outcome === 'COMPLETED' ? 'Pilot remarks' : 'Remarks'} error={s.fields.remarks}>
        <textarea id="remarks" name="remarks" rows={2} className="textarea" required />
      </Field>
      <button className="btn-primary" disabled={s.busy}>
        {s.busy ? 'Submitting…' : 'Submit report'}
      </button>
    </form>
  );
}
