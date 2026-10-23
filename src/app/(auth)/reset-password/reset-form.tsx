'use client';

import { useState } from 'react';
import { api } from '@/lib/client/api';
import { FormError, useSubmit } from '@/components/form';
import { PasswordFields, passwordMeetsRules } from '@/components/password-fields';

export function ResetForm({ token }: { token: string }) {
  const s = useSubmit();
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (!passwordMeetsRules(String(f.get('password')))) {
      s.setError('The new password does not meet all the rules yet.');
      return;
    }
    if (f.get('password') !== f.get('confirm')) {
      s.setError('The two passwords do not match.');
      return;
    }
    if (await s.run(() => api('auth/reset-password', { body: { token, password: f.get('password') } }))) setDone(true);
  }

  if (done)
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl">Password Changed</h1>
        <p>You have been signed out on every device. Sign in with your new password.</p>
        <a href="/login" className="btn-primary self-start">
          Sign in
        </a>
      </div>
    );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <h1 className="text-xl">Choose a New Password</h1>
      <FormError error={s.error} />
      <PasswordFields name="password" label="New password" confirmLabel="Confirm new password" error={s.fields.password} inputClass="input h-12" />
      <button className="btn-primary h-12" disabled={s.busy || !token}>
        Save password
      </button>
    </form>
  );
}
