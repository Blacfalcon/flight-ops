'use client';

import { api } from '@/lib/client/api';
import { Field, FormError, useSubmit } from './form';

export function DelegationForm({ commanders, goos, today }: { commanders: Array<{ id: string; name: string }>; goos: Array<{ id: string; name: string }>; today: string }) {
  const s = useSubmit();
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const body = Object.fromEntries(new FormData(e.currentTarget));
        if (await s.run(() => api('delegations', { body }))) window.location.reload();
      }}
    >
      <FormError error={s.error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="fromUserId" label="Commander" error={s.fields.fromUserId}>
          <select id="fromUserId" name="fromUserId" className="input">
            {commanders.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="toUserId" label="GOO (acting Commander)" error={s.fields.toUserId}>
          <select id="toUserId" name="toUserId" className="input">
            {goos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field id="startDate" label="From date">
          <input id="startDate" name="startDate" type="date" className="input" defaultValue={today} required />
        </Field>
        <Field id="startTime" label="Time">
          <input id="startTime" name="startTime" type="time" className="input" defaultValue="06:00" required />
        </Field>
        <Field id="endDate" label="To date" error={s.fields.endDate}>
          <input id="endDate" name="endDate" type="date" className="input" defaultValue={today} required />
        </Field>
        <Field id="endTime" label="Time">
          <input id="endTime" name="endTime" type="time" className="input" defaultValue="23:59" required />
        </Field>
      </div>
      <button className="btn-primary self-start" disabled={s.busy}>
        Appoint
      </button>
    </form>
  );
}

export function CancelDelegation({ id }: { id: string }) {
  const s = useSubmit();
  return (
    <button
      className="btn-danger btn-sm"
      disabled={s.busy}
      onClick={async () => {
        if (await s.run(() => api(`delegations/${id}/cancel`, { body: {} }))) window.location.reload();
      }}
    >
      End now
    </button>
  );
}
