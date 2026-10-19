'use client';

import { useState, type ReactNode } from 'react';
import { ApiClientError } from '@/lib/client/api';

/** Tracks busy state, a top-level error and field errors for a form submission. */
export function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    setError(null);
    setFields({});
    setNotice(null);
    try {
      return await fn();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
        setFields(err.fields);
      } else {
        setError('Could not reach the server. Check your connection and try again.');
      }
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, fields, notice, setNotice, setError, run };
}

export function Field({ id, label, error, hint, children }: { id: string; label: ReactNode; error?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
      {error ? (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      ) : hint ? (
        <p className="hint">{hint}</p>
      ) : null}
    </div>
  );
}

export function FormError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div role="alert" className="alert-bad font-medium">
      {error}
    </div>
  );
}

export function FormNotice({ notice }: { notice: string | null }) {
  if (!notice) return null;
  return (
    <div role="status" className="alert-good font-medium">
      {notice}
    </div>
  );
}
