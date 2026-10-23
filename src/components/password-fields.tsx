'use client';

import { useState } from 'react';

// New-password and confirm boxes with a live checklist, so people see the rules being met as they type.
// The server checks the same rules (src/lib/auth/password.ts).

export const PASSWORD_RULES: Array<{ label: string; test: (p: string) => boolean }> = [
  { label: 'At least 10 characters', test: (p) => p.length >= 10 },
  { label: 'Contains a letter', test: (p) => /[A-Za-z]/.test(p) },
  { label: 'Contains a number', test: (p) => /[0-9]/.test(p) },
];

export function passwordMeetsRules(p: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(p));
}

function Tick({ ok }: { ok: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${ok ? 'bg-good-solid text-white' : 'border border-[#7D8CA3] text-transparent'}`}
    >
      ✓
    </span>
  );
}

export function PasswordFields({
  name = 'password',
  label = 'Password',
  confirmLabel = 'Confirm password',
  error,
  inputClass = 'input',
}: {
  name?: string;
  label?: string;
  confirmLabel?: string;
  error?: string;
  inputClass?: string;
}) {
  const [value, setValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [confirmTouched, setConfirmTouched] = useState(false);
  const mismatch = confirm.length > 0 && confirm !== value && (confirmTouched || confirm.length >= value.length || !value.startsWith(confirm));
  const matches = confirm.length > 0 && confirm === value;

  return (
    <>
      <div className="flex flex-col">
        <label htmlFor={name} className="label">
          {label}
        </label>
        <input
          id={name}
          name={name}
          type="password"
          autoComplete="new-password"
          className={`${inputClass} ${error ? 'input-error' : ''}`}
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-describedby={`${name}-rules${error ? ` ${name}-error` : ''}`}
        />
        {error && (
          <p className="field-error" id={`${name}-error`}>
            {error}
          </p>
        )}
        <ul id={`${name}-rules`} className="mt-2 flex flex-col gap-1 text-[13px]" aria-label="Password rules">
          {PASSWORD_RULES.map((r) => {
            const ok = r.test(value);
            return (
              <li key={r.label} className={`flex items-center gap-2 ${ok ? 'text-good-fg' : 'text-ink-muted'}`}>
                <Tick ok={ok} />
                {r.label}
                <span className="sr-only">{ok ? ' (met)' : ' (not met)'}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex flex-col">
        <label htmlFor={`${name}-confirm`} className="label">
          {confirmLabel}
        </label>
        <input
          id={`${name}-confirm`}
          name="confirm"
          type="password"
          autoComplete="new-password"
          className={`${inputClass} ${mismatch ? 'input-error' : ''}`}
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onBlur={() => setConfirmTouched(true)}
          aria-invalid={mismatch || undefined}
          aria-describedby={`${name}-confirm-status`}
        />
        <p id={`${name}-confirm-status`} aria-live="polite" className={`mt-1 text-[13px] font-medium ${mismatch ? 'text-bad-fg' : 'text-good-fg'}`}>
          {mismatch ? 'The passwords do not match.' : matches ? '✓ Passwords match.' : ''}
        </p>
      </div>
    </>
  );
}
