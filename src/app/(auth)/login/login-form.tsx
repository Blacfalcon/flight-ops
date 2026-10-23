'use client';

import { useState } from 'react';
import { api } from '@/lib/client/api';
import { Field, FormError, useSubmit } from '@/components/form';

export function LoginForm({ next }: { next: string }) {
  const s = useSubmit();
  const [challenge, setChallenge] = useState<string | null>(null);

  async function onPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const res = await s.run(() =>
      api<{ ok?: boolean; mfa?: boolean; challenge?: string; mfaSetupRequired?: boolean }>('auth/login', {
        body: { identifier: f.get('identifier'), password: f.get('password') },
      }),
    );
    if (!res) return;
    if (res.mfa && res.challenge) setChallenge(res.challenge);
    else window.location.href = res.mfaSetupRequired ? '/me/security?setup=required' : next;
  }

  async function onCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const res = await s.run(() => api('auth/login/totp', { body: { challenge, code: String(f.get('code') ?? '').replace(/\s/g, '') } }));
    if (res) window.location.href = next;
  }

  if (challenge) {
    return (
      <form onSubmit={onCode} className="flex flex-col gap-5">
        <h1 className="text-xl">Two-Step Sign-In</h1>
        <p className="text-ink-muted">Open your authenticator app and enter the 6-digit code for this app.</p>
        <FormError error={s.error} />
        <Field id="code" label="Code" error={s.fields.code}>
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} className="input text-center font-mono text-lg tracking-[0.3em]" autoFocus required />
        </Field>
        <button className="btn-primary h-12" disabled={s.busy}>
          {s.busy ? 'Checking…' : 'Sign in'}
        </button>
        <button type="button" className="text-[14px] font-semibold text-brand" onClick={() => setChallenge(null)}>
          Start again
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={onPassword} className="flex flex-col gap-5">
      <h1 className="text-xl">Sign In</h1>
      <FormError error={s.error} />
      <Field id="identifier" label="Service number or email">
        <input id="identifier" name="identifier" autoComplete="username" className="input h-12" required />
      </Field>
      <Field id="password" label="Password">
        <input id="password" name="password" type="password" autoComplete="current-password" className="input h-12" required />
      </Field>
      <button className="btn-primary h-12" disabled={s.busy}>
        {s.busy ? 'Signing in…' : 'Sign in'}
      </button>
      <a href="/forgot-password" className="self-center text-[14px] font-semibold">
        Forgot password?
      </a>
      <div className="h-px bg-line" />
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="text-[14px] text-ink-muted">New to the system?</div>
        <a href="/register" className="btn-outline h-12 w-full">
          Create an account
        </a>
        <p className="text-[13px] text-ink-muted">You confirm your email, then Admin activates your account.</p>
      </div>
      <div className="flex justify-center gap-4 text-[13px]">
        <a href="/privacy">Privacy policy</a>
        <a href="/terms">Conditions of use</a>
        <a href="/delete-account">Delete your account</a>
      </div>
    </form>
  );
}
