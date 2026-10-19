'use client';

import { useState } from 'react';
import { api } from '@/lib/client/api';
import { APPOINTMENTS, APPOINTMENT_LABEL, FLIGHT_STATUSES, FLIGHT_STATUS_LABEL, PILOT_CATEGORIES, PILOT_CATEGORY_LABEL, RANKS, RANK_LABEL } from '@/lib/constants';
import { Field, FormError, FormNotice, useSubmit } from './form';

export function ContactForm({ phone }: { phone: string }) {
  const s = useSubmit();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        if (await s.run(() => api('me', { method: 'PATCH', body: { phone: f.get('phone') } }))) s.setNotice('Saved.');
      }}
    >
      <FormError error={s.error} />
      <FormNotice notice={s.notice} />
      <Field id="phone" label="Phone" error={s.fields.phone}>
        <input id="phone" name="phone" type="tel" className="input" defaultValue={phone} required />
      </Field>
      <button className="btn-secondary self-start" disabled={s.busy}>
        Save
      </button>
    </form>
  );
}

const ALERT_OPTIONS = [
  { value: 'URGENT', label: 'Only items that need my action', hint: 'Readiness calls, approvals waiting for you, missions assigned, changed or cancelled.' },
  { value: 'ALL', label: 'Everything', hint: 'Urgent items straight away; other updates in one email at most every hour.' },
  { value: 'NONE', label: 'No emails', hint: 'Check notifications in the app. Password-reset emails still come.' },
] as const;

export function EmailAlertsForm({ current }: { current: string }) {
  const s = useSubmit();
  const [value, setValue] = useState(current);
  return (
    <div className="flex flex-col gap-3">
      <FormError error={s.error} />
      <FormNotice notice={s.notice} />
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Email notifications</legend>
        {ALERT_OPTIONS.map((o) => (
          <label key={o.value} className="flex items-start gap-2.5">
            <input type="radio" name="emailAlerts" className="mt-1" checked={value === o.value} onChange={() => setValue(o.value)} />
            <span>
              <span className="font-medium">{o.label}</span>
              <span className="block text-[13px] text-ink-muted">{o.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <button
        className="btn-secondary self-start"
        disabled={s.busy || value === current}
        onClick={async () => {
          if (await s.run(() => api('me', { method: 'PATCH', body: { emailAlerts: value } }))) s.setNotice('Saved.');
        }}
      >
        Save
      </button>
    </div>
  );
}

const OPTIONS: Record<string, { values: readonly string[]; labels: Record<string, string>; title: string }> = {
  rank: { values: RANKS, labels: RANK_LABEL, title: 'Rank' },
  appointment: { values: APPOINTMENTS, labels: APPOINTMENT_LABEL, title: 'Appointment' },
  flightStatus: { values: FLIGHT_STATUSES, labels: FLIGHT_STATUS_LABEL, title: 'Flight status' },
  pilotCategory: { values: PILOT_CATEGORIES, labels: PILOT_CATEGORY_LABEL, title: 'Pilot category' },
};

export function ChangeRequest({ current }: { current: Record<string, string> }) {
  const s = useSubmit();
  const [field, setField] = useState('appointment');
  const opt = OPTIONS[field];
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const res = await s.run(() => api('me', { method: 'PATCH', body: { requestChange: { field, value: f.get('value'), reason: f.get('reason') || undefined } } }));
        if (res) window.location.reload();
      }}
    >
      <p className="text-[13px] text-ink-muted">Rank, appointment, flight status and pilot category change only after Admin approves.</p>
      <FormError error={s.error} />
      <Field id="field" label="What to change">
        <select id="field" className="input" value={field} onChange={(e) => setField(e.target.value)}>
          {Object.entries(OPTIONS).map(([k, o]) => (
            <option key={k} value={k}>
              {o.title}
            </option>
          ))}
        </select>
      </Field>
      <Field id="value" label={`New ${opt.title.toLowerCase()}`}>
        <select id="value" name="value" key={field} className="input" defaultValue={current[field]}>
          {opt.values.map((v) => (
            <option key={v} value={v}>
              {opt.labels[v]}
            </option>
          ))}
        </select>
      </Field>
      <Field id="reason" label="Reason (optional)">
        <input id="reason" name="reason" className="input" />
      </Field>
      <button className="btn-secondary self-start" disabled={s.busy}>
        Send request
      </button>
    </form>
  );
}

export function ChangePassword() {
  const s = useSubmit();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        if (f.get('next') !== f.get('confirm')) {
          s.setError('The new passwords do not match.');
          return;
        }
        if (await s.run(() => api('me/password', { body: { current: f.get('current'), next: f.get('next') } }))) {
          form.reset();
          s.setNotice('Password changed. Other devices have been signed out.');
        }
      }}
    >
      <FormError error={s.error} />
      <FormNotice notice={s.notice} />
      <Field id="current" label="Current password" error={s.fields.current}>
        <input id="current" name="current" type="password" autoComplete="current-password" className="input" required />
      </Field>
      <Field id="next" label="New password" error={s.fields.next} hint="At least 10 characters, with letters and a number.">
        <input id="next" name="next" type="password" autoComplete="new-password" className="input" required />
      </Field>
      <Field id="confirm" label="Confirm new password">
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" className="input" required />
      </Field>
      <button className="btn-secondary self-start" disabled={s.busy}>
        Change password
      </button>
    </form>
  );
}
