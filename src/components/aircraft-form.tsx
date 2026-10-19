'use client';

import { api } from '@/lib/client/api';
import { AIRCRAFT_STATUSES, AIRCRAFT_STATUS_LABEL } from '@/lib/constants';
import { useState } from 'react';
import { HOURS_PATTERN, parseHours } from '@/lib/hours';
import { Field, FormError, FormNotice, useSubmit } from './form';

export type AircraftValues = {
  id?: string;
  registration: string;
  type: string;
  status: string;
  flyingHours: string;
  hoursToNextInspection: string;
  inspectionIntervalHours: string;
  inspectionIntervalDays: string;
  lastInspectionDate: string;
  nextInspectionDue: string;
  maintenanceRemarks: string;
  active?: boolean;
};

export function AircraftForm({ initial, canRetire }: { initial: AircraftValues; canRetire: boolean }) {
  const s = useSubmit();
  const isNew = !initial.id;
  const [bad, setBad] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const hours: Record<string, number> = {};
    const wrong: Record<string, string> = {};
    for (const k of ['flyingHours', 'hoursToNextInspection', 'inspectionIntervalHours']) {
      const v = parseHours(f[k] ?? '');
      if (v === null) wrong[k] = 'Enter hours as HH:MM, for example 1234:30.';
      else hours[k] = v;
    }
    setBad(wrong);
    if (Object.keys(wrong).length) return;
    const body = {
      registration: f.registration,
      type: f.type,
      status: f.status,
      flyingHours: hours.flyingHours,
      hoursToNextInspection: hours.hoursToNextInspection,
      inspectionIntervalHours: hours.inspectionIntervalHours,
      inspectionIntervalDays: f.inspectionIntervalDays ? Number(f.inspectionIntervalDays) : null,
      lastInspectionDate: f.lastInspectionDate || null,
      nextInspectionDue: f.nextInspectionDue || null,
      maintenanceRemarks: f.maintenanceRemarks || null,
      ...(canRetire && !isNew ? { active: f.active === 'on' } : {}),
    };
    const res = await s.run(() => (isNew ? api<{ id: string }>('aircraft', { body }) : api<{ id: string }>(`aircraft/${initial.id}`, { method: 'PATCH', body })));
    if (res) {
      if (isNew) window.location.href = `/aircraft/${res.id}`;
      else s.setNotice('Saved.');
    }
  }

  const err = { ...s.fields, ...bad };
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormError error={s.error} />
      <FormNotice notice={s.notice} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="registration" label="Registration" error={err.registration}>
          <input id="registration" name="registration" className="input font-mono uppercase" defaultValue={initial.registration} required />
        </Field>
        <Field id="type" label="Aircraft type" error={err.type}>
          <input id="type" name="type" className="input" defaultValue={initial.type} required />
        </Field>
        <Field id="status" label="Serviceability status" error={err.status}>
          <select id="status" name="status" className="input" defaultValue={initial.status}>
            {AIRCRAFT_STATUSES.map((st) => (
              <option key={st} value={st}>
                {AIRCRAFT_STATUS_LABEL[st]}
              </option>
            ))}
          </select>
        </Field>
        <Field id="flyingHours" label="Flying hours (HH:MM)" error={err.flyingHours}>
          <input id="flyingHours" name="flyingHours" inputMode="text" pattern={HOURS_PATTERN} placeholder="e.g. 1234:30" autoComplete="off" className="input font-mono" defaultValue={initial.flyingHours} required />
        </Field>
        <Field id="hoursToNextInspection" label="Hours to next inspection (HH:MM)" error={err.hoursToNextInspection}>
          <input id="hoursToNextInspection" name="hoursToNextInspection" inputMode="text" pattern={HOURS_PATTERN} placeholder="e.g. 1234:30" autoComplete="off" className="input" defaultValue={initial.hoursToNextInspection} required />
        </Field>
        <Field id="inspectionIntervalHours" label="Inspection interval (HH:MM)" error={err.inspectionIntervalHours}>
          <input id="inspectionIntervalHours" name="inspectionIntervalHours" inputMode="text" pattern={HOURS_PATTERN} placeholder="e.g. 1234:30" autoComplete="off" className="input" defaultValue={initial.inspectionIntervalHours} required />
        </Field>
        <Field id="inspectionIntervalDays" label="Inspection interval (days)" error={err.inspectionIntervalDays} hint="Leave empty if only hours apply.">
          <input id="inspectionIntervalDays" name="inspectionIntervalDays" type="number" min={1} className="input" defaultValue={initial.inspectionIntervalDays} />
        </Field>
        <Field id="lastInspectionDate" label="Last inspection" error={err.lastInspectionDate}>
          <input id="lastInspectionDate" name="lastInspectionDate" type="date" className="input" defaultValue={initial.lastInspectionDate} />
        </Field>
        <Field id="nextInspectionDue" label="Next inspection due" error={err.nextInspectionDue}>
          <input id="nextInspectionDue" name="nextInspectionDue" type="date" className="input" defaultValue={initial.nextInspectionDue} />
        </Field>
      </div>
      <Field id="maintenanceRemarks" label="Maintenance remarks" error={err.maintenanceRemarks}>
        <textarea id="maintenanceRemarks" name="maintenanceRemarks" rows={2} className="textarea" defaultValue={initial.maintenanceRemarks} />
      </Field>
      {canRetire && !isNew && (
        <label className="flex items-center gap-2">
          <input type="checkbox" name="active" defaultChecked={initial.active} /> In the active register (untick to retire)
        </label>
      )}
      <button className="btn-primary self-start" disabled={s.busy}>
        {s.busy ? 'Saving…' : isNew ? 'Add aircraft' : 'Save changes'}
      </button>
    </form>
  );
}
