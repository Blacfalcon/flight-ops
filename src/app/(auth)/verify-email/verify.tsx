'use client';

import { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/client/api';

export function VerifyEmail({ token }: { token: string }) {
  const [state, setState] = useState<'working' | 'done' | 'failed'>('working');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setState('failed');
      setMessage('This link is missing its code.');
      return;
    }
    api('auth/verify-email', { body: { token } })
      .then(() => setState('done'))
      .catch((err) => {
        setState('failed');
        setMessage(err instanceof ApiClientError ? err.message : 'Could not reach the server.');
      });
  }, [token]);

  if (state === 'working') return <p>Confirming your email…</p>;
  if (state === 'failed')
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl">Could Not Confirm</h1>
        <div className="alert-bad">{message}</div>
        <a href="/login" className="btn-secondary self-start">
          Back to sign in
        </a>
      </div>
    );
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl">Email Confirmed</h1>
      <p>Thank you. Admin has been told your account is ready to activate. You will get an email when you can sign in.</p>
      <a href="/login" className="btn-secondary self-start">
        Back to sign in
      </a>
    </div>
  );
}
