'use client';

import { useState } from 'react';
import { api } from '@/lib/client/api';
import { APPOINTMENTS, APPOINTMENT_LABEL, FLIGHT_STATUSES, FLIGHT_STATUS_LABEL, PILOT_CATEGORIES, PILOT_CATEGORY_LABEL, RANKS, RANK_LABEL } from '@/lib/constants';
import { Field, FormError, FormNotice, useSubmit } from './form';

type U = {
  id: string;
  rank: string;
  fullName: string;
  nafNumber: string;
  email: string;
  phone: string;
  appointment: string;
  flightStatus: string;
  pilotCategory: string;
  accountStatus: string;
  totpEnabled: boolean;
};

export function UserAdminForm({ user }: { user: U }) {
  const s = useSubmit();
  const [flightStatus, setFlightStatus] = useState(user.flightStatus);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const body = { ...f, pilotCategory: f.flightStatus === 'NONE' ? 'NIL' : f.pilotCategory };
    if (await s.run(() => api(`users/${user.id}`, { method: 'PATCH', body }))) s.setNotice('Saved.');
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormError error={s.error} />
        <FormNotice notice={s.notice} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="rank" label="Rank" error={s.fields.rank}>
            <select id="rank" name="rank" className="input" defaultValue={user.rank}>
              {RANKS.map((r) => (
                <option key={r} value={r}>
                  {RANK_LABEL[r]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="fullName" label="Full name" error={s.fields.fullName}>
            <input id="fullName" name="fullName" className="input" defaultValue={user.fullName} required />
          </Field>
          <Field id="nafNumber" label="Service number" error={s.fields.nafNumber}>
            <input id="nafNumber" name="nafNumber" className="input font-mono" defaultValue={user.nafNumber} required />
          </Field>
          <Field id="email" label="Email" error={s.fields.email}>
            <input id="email" name="email" type="email" className="input" defaultValue={user.email} required />
          </Field>
          <Field id="phone" label="Phone" error={s.fields.phone}>
            <input id="phone" name="phone" className="input" defaultValue={user.phone} required />
          </Field>
          <Field id="appointment" label="Appointment" error={s.fields.appointment}>
            <select id="appointment" name="appointment" className="input" defaultValue={user.appointment}>
              {APPOINTMENTS.map((a) => (
                <option key={a} value={a}>
                  {APPOINTMENT_LABEL[a]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="flightStatus" label="Flight status">
            <select id="flightStatus" name="flightStatus" className="input" value={flightStatus} onChange={(e) => setFlightStatus(e.target.value)}>
              {FLIGHT_STATUSES.map((v) => (
                <option key={v} value={v}>
                  {FLIGHT_STATUS_LABEL[v]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="pilotCategory" label="Pilot category">
            <select id="pilotCategory" name="pilotCategory" className="input" defaultValue={user.pilotCategory} disabled={flightStatus === 'NONE'}>
              {PILOT_CATEGORIES.map((v) => (
                <option key={v} value={v}>
                  {PILOT_CATEGORY_LABEL[v]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="accountStatus" label="Account">
            <select id="accountStatus" name="accountStatus" className="input" defaultValue={user.accountStatus === 'PENDING_VERIFICATION' ? 'PENDING_ACTIVATION' : user.accountStatus}>
              <option value="PENDING_ACTIVATION">Awaiting activation</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </Field>
        </div>
        {user.accountStatus === 'PENDING_VERIFICATION' && <p className="hint">This person has not confirmed their email yet. Activating them anyway is allowed if you have checked their identity.</p>}
        <button className="btn-primary self-start" disabled={s.busy}>
          Save
        </button>
      </form>
      {user.totpEnabled && (
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <span>Two-step sign-in is on.</span>
          <button
            className="btn-danger btn-sm"
            onClick={async () => {
              if (await s.run(() => api(`users/${user.id}/reset-mfa`, { body: {} }))) s.setNotice('Two-step sign-in reset. They will set it up again at next sign-in.');
            }}
          >
            Reset two-step sign-in
          </button>
        </div>
      )}
    </div>
  );
}
