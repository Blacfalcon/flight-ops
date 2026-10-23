'use client';

import { useState } from 'react';
import { api } from '@/lib/client/api';
import { Field, FormError, useSubmit } from '@/components/form';

export default function ForgotPasswordPage() {
  const s = useSubmit();
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = new FormData(e.currentTarget).get('email');
    if (await s.run(() => api('auth/forgot-password', { body: { email } }))) setSent(true);
  }

  if (sent)
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl">Check Your Email</h1>
        <p>If that address belongs to an active account, a reset link is on its way. It works for 1 hour.</p>
        <a href="/login" className="btn-secondary self-start">
          Back to sign in
        </a>
      </div>
    );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <h1 className="text-xl">Reset Your Password</h1>
      <FormError error={s.error} />
      <Field id="email" label="Your email">
        <input id="email" name="email" type="email" autoComplete="email" className="input h-12" required />
      </Field>
      <button className="btn-primary h-12" disabled={s.busy}>
        Send reset link
      </button>
      <a href="/login" className="self-center text-[14px] font-semibold">
        Back to sign in
      </a>
    </form>
  );
}
