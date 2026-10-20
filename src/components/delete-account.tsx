'use client';

import { useState } from 'react';
import { api } from '@/lib/client/api';
import { Field, FormError, useSubmit } from './form';

/** "Delete my account" on My profile (App Store requirement). */
export function DeleteMyAccount({ pending }: { pending: boolean }) {
  const s = useSubmit();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(pending);

  if (done)
    return (
      <div className="alert-warn">
        Your request to delete this account is with Admin. Once approved, your sign-in and contact details are deleted and you will be signed out.
      </div>
    );

  if (!open)
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[13px] text-ink-muted">
          Deletes your email, phone, photo, password and alert devices, and closes the account. Your rank, name and service number stay on flights and approvals you took part in, as unit records.{' '}
          <a href="/privacy">Privacy policy</a>
        </p>
        <button className="btn-danger self-start" onClick={() => setOpen(true)}>
          Delete my account
        </button>
      </div>
    );

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        if (await s.run(() => api('me/delete', { body: { password: f.get('password'), reason: f.get('reason') || undefined } }))) setDone(true);
      }}
    >
      <p className="font-medium">This cannot be undone once Admin approves it.</p>
      <FormError error={s.error} />
      <Field id="del-password" label="Your password, to confirm" error={s.fields.password}>
        <input id="del-password" name="password" type="password" autoComplete="current-password" className="input" required />
      </Field>
      <Field id="del-reason" label="Reason (optional)">
        <input id="del-reason" name="reason" className="input" />
      </Field>
      <div className="flex gap-2.5">
        <button className="btn-danger" disabled={s.busy}>
          {s.busy ? 'Sending…' : 'Ask to delete my account'}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** The public /delete-account form (Google Play requirement). */
export function PublicDeleteForm() {
  const s = useSubmit();
  const [done, setDone] = useState(false);

  if (done)
    return (
      <div role="status" className="alert-good font-medium">
        Your request has been received. Admin will delete your account data, normally within 7 days. You will not be able to sign in afterwards.
      </div>
    );

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        if (await s.run(() => api('account-deletion', { body: { identifier: f.get('identifier'), password: f.get('password'), reason: f.get('reason') || undefined } }))) setDone(true);
      }}
    >
      <FormError error={s.error} />
      <Field id="identifier" label="Service number or email">
        <input id="identifier" name="identifier" autoComplete="username" className="input h-12" required />
      </Field>
      <Field id="password" label="Password" hint="Proves the account is yours.">
        <input id="password" name="password" type="password" autoComplete="current-password" className="input h-12" required />
      </Field>
      <Field id="reason" label="Reason (optional)">
        <input id="reason" name="reason" className="input h-12" />
      </Field>
      <button className="btn-danger h-12" disabled={s.busy}>
        {s.busy ? 'Sending…' : 'Request account deletion'}
      </button>
    </form>
  );
}
