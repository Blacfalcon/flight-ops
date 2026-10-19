'use client';

import { useState } from 'react';
import { api } from '@/lib/client/api';
import { Field, FormError, useSubmit } from '@/components/form';

export function ResetForm({ token }: { token: string }) {
  const s = useSubmit();
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get('password') !== f.get('confirm')) {
      s.setError('The two passwords do not match.');
      return;
    }
    if (await s.run(() => api('auth/reset-password', { body: { token, password: f.get('password') } }))) setDone(true);
  }

  if (done)
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl">Password changed</h1>
        <p>You have been signed out on every device. Sign in with your new password.</p>
        <a href="/login" className="btn-primary self-start">
          Sign in
        </a>
      </div>
    );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <h1 className="text-xl">Choose a new password</h1>
      <FormError error={s.error} />
      <Field id="password" label="New password" error={s.fields.password} hint="At least 10 characters, with letters and a number.">
        <input id="password" name="password" type="password" autoComplete="new-password" className="input h-12" required />
      </Field>
      <Field id="confirm" label="Confirm new password">
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" className="input h-12" required />
      </Field>
      <button className="btn-primary h-12" disabled={s.busy || !token}>
        Save password
      </button>
    </form>
  );
}
