'use client';

import { useState } from 'react';
import { api } from '@/lib/client/api';
import { Field, FormError, useSubmit } from './form';

export function MfaSetup() {
  const s = useSubmit();
  const [qr, setQr] = useState<{ qr: string; secret: string } | null>(null);

  if (!qr)
    return (
      <div className="flex flex-col gap-3">
        <p>Two-step sign-in asks for a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator or similar) the first time you sign in each day on each phone or computer.</p>
        <FormError error={s.error} />
        <button
          className="btn-primary self-start"
          disabled={s.busy}
          onClick={async () => {
            const res = await s.run(() => api<{ qr: string; secret: string }>('me/mfa/setup', { body: {} }));
            if (res) setQr(res);
          }}
        >
          Set up two-step sign-in
        </button>
      </div>
    );

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const code = String(new FormData(e.currentTarget).get('code') ?? '').replace(/\s/g, '');
        if (await s.run(() => api('me/mfa/enable', { body: { code } }))) window.location.href = '/dashboard';
      }}
    >
      <ol className="ml-5 list-decimal space-y-1">
        <li>Open your authenticator app and add an account.</li>
        <li>Scan this code, or type the key below.</li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr.qr} alt="QR code for your authenticator app" width={200} height={200} className="rounded-lg border border-line" />
      <code className="self-start rounded bg-ground px-2 py-1 font-mono text-[13px]">{qr.secret}</code>
      <FormError error={s.error} />
      <Field id="code" label="Code from the app" error={s.fields.code}>
        <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} className="input w-40 text-center font-mono text-lg tracking-[0.3em]" required />
      </Field>
      <button className="btn-primary self-start" disabled={s.busy}>
        Turn on
      </button>
    </form>
  );
}
