'use client';

import { useState } from 'react';
import { api } from '@/lib/client/api';
import { submitOrQueue } from '@/lib/client/outbox';
import { Field, FormError, useSubmit } from './form';

export type PlanValues = {
  id?: string;
  missionId: string;
  departure: string;
  destination: string;
  route: string;
  alternate: string;
  eetHours: string;
  eetMinutes: string;
  fuelRequired: string;
  fuelUnit: 'kg' | 'l';
  crewNotes: string;
};

export function FlightPlanForm({ initial, missions }: { initial: PlanValues; missions: Array<{ id: string; label: string }> }) {
  const s = useSubmit();
  const [queued, setQueued] = useState(false);

  async function save(e: React.FormEvent<HTMLFormElement>, submit: boolean) {
    e.preventDefault();
    const form = (e.currentTarget as HTMLFormElement) ?? null;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const body = {
      missionId: f.missionId || null,
      departure: f.departure,
      destination: f.destination,
      route: f.route,
      alternate: f.alternate,
      estFlightTimeMin: Number(f.eetHours || 0) * 60 + Number(f.eetMinutes || 0),
      fuelRequired: Number(f.fuelRequired || 0),
      fuelUnit: f.fuelUnit,
      crewNotes: f.crewNotes || undefined,
      submit,
    };
    const send = () => (initial.id ? api<{ id: string }>(`flight-plans/${initial.id}`, { method: 'PATCH', body }) : api<{ id: string }>('flight-plans', { body }));
    const res = await s.run(() => submitOrQueue('flightplan.save', initial.id, body, `Flight plan ${body.departure} → ${body.destination}`, send));
    if (!res) return;
    if (res.queued) setQueued(true);
    else window.location.href = `/flight-plans/${(res.result as { id: string }).id}`;
  }

  if (queued)
    return (
      <div role="status" className="alert-warn">
        Saved on this device. It will be sent when you are back online.
      </div>
    );

  const err = s.fields;
  return (
    <form
      onSubmit={(e) => {
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        save(e, submitter?.value === 'submit');
      }}
      className="flex flex-col gap-4"
    >
      <FormError error={s.error} />
      <Field id="missionId" label="Mission" hint="Optional. Link the plan to one of your missions.">
        <select id="missionId" name="missionId" className="input" defaultValue={initial.missionId}>
          <option value="">— Not linked —</option>
          {missions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="departure" label="Departure" error={err.departure}>
          <input id="departure" name="departure" className="input uppercase" defaultValue={initial.departure} required />
        </Field>
        <Field id="destination" label="Destination" error={err.destination}>
          <input id="destination" name="destination" className="input uppercase" defaultValue={initial.destination} required />
        </Field>
        <Field id="alternate" label="Alternate aerodrome" error={err.alternate}>
          <input id="alternate" name="alternate" className="input uppercase" defaultValue={initial.alternate} required />
        </Field>
      </div>
      <Field id="route" label="Route" error={err.route}>
        <textarea id="route" name="route" rows={2} className="textarea" defaultValue={initial.route} required />
      </Field>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field id="eetHours" label="Est. flight time (h)" error={err.estFlightTimeMin}>
          <input id="eetHours" name="eetHours" type="number" min={0} max={24} className="input" defaultValue={initial.eetHours} />
        </Field>
        <Field id="eetMinutes" label="(min)">
          <input id="eetMinutes" name="eetMinutes" type="number" min={0} max={59} className="input" defaultValue={initial.eetMinutes} />
        </Field>
        <Field id="fuelRequired" label="Fuel required" error={err.fuelRequired}>
          <input id="fuelRequired" name="fuelRequired" type="number" step="0.1" min={0} className="input" defaultValue={initial.fuelRequired} required />
        </Field>
        <Field id="fuelUnit" label="Unit">
          <select id="fuelUnit" name="fuelUnit" className="input" defaultValue={initial.fuelUnit}>
            <option value="kg">kg</option>
            <option value="l">litres</option>
          </select>
        </Field>
      </div>
      <Field id="crewNotes" label="Crew details and notes">
        <textarea id="crewNotes" name="crewNotes" rows={2} className="textarea" defaultValue={initial.crewNotes} />
      </Field>
      <div className="flex flex-wrap gap-2.5">
        <button className="btn-primary" name="action" value="submit" disabled={s.busy}>
          Submit to Ops
        </button>
        <button className="btn-secondary" name="action" value="draft" disabled={s.busy}>
          Save draft
        </button>
      </div>
    </form>
  );
}
