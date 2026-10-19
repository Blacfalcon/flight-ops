'use client';

import { useState } from 'react';
import { api } from '@/lib/client/api';
import { submitOrQueue } from '@/lib/client/outbox';
import { Field, FormError, FormNotice, useSubmit } from './form';

export function SafetyReportForm({ aircraft }: { aircraft: Array<{ id: string; registration: string }> }) {
  const s = useSubmit();
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const body = { kind: f.kind, description: f.description, location: f.location || undefined, aircraftId: f.aircraftId || null };
    const res = await s.run(() => submitOrQueue('safety.raise', undefined, body, `${f.kind === 'INCIDENT' ? 'Incident' : 'Hazard'} report`, () => api('safety-reports', { body })));
    if (!res) return;
    form.reset();
    if (res.queued) s.setNotice('Saved on this device; it will be sent when you are back online.');
    else window.location.reload();
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormError error={s.error} />
      <FormNotice notice={s.notice} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="kind" label="Type">
          <select id="kind" name="kind" className="input">
            <option value="HAZARD">Hazard</option>
            <option value="INCIDENT">Incident</option>
          </select>
        </Field>
        <Field id="location" label="Location">
          <input id="location" name="location" className="input" />
        </Field>
        <Field id="aircraftId" label="Aircraft (if any)">
          <select id="aircraftId" name="aircraftId" className="input">
            <option value="">—</option>
            {aircraft.map((a) => (
              <option key={a.id} value={a.id}>
                {a.registration}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field id="description" label="What happened or what is the hazard?" error={s.fields.description}>
        <textarea id="description" name="description" rows={3} className="textarea" required />
      </Field>
      <button className="btn-primary self-start" disabled={s.busy}>
        Send report
      </button>
    </form>
  );
}

export function SafetyStatus({ reportId, status }: { reportId: string; status: string }) {
  const [value, setValue] = useState(status);
  const [saving, setSaving] = useState(false);
  return (
    <span className="flex items-center gap-2">
      <label htmlFor={`st-${reportId}`} className="sr-only">
        Status
      </label>
      <select
        id={`st-${reportId}`}
        className="input h-9 w-auto"
        value={value}
        disabled={saving}
        onChange={async (e) => {
          const next = e.target.value;
          setSaving(true);
          try {
            await api(`safety-reports/${reportId}`, { method: 'PATCH', body: { status: next } });
            setValue(next);
          } finally {
            setSaving(false);
          }
        }}
      >
        <option value="OPEN">Open</option>
        <option value="UNDER_REVIEW">Under review</option>
        <option value="CLOSED">Closed</option>
      </select>
    </span>
  );
}
