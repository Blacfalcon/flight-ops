'use client';

import { useState } from 'react';
import { api } from '@/lib/client/api';
import { resizeImage } from '@/lib/client/image';
import { Field, FormError, useSubmit } from '@/components/form';
import { PasswordFields, passwordMeetsRules } from '@/components/password-fields';
import {
  APPOINTMENTS,
  APPOINTMENT_LABEL,
  FLIGHT_STATUSES,
  FLIGHT_STATUS_LABEL,
  PILOT_CATEGORIES,
  PILOT_CATEGORY_LABEL,
  RANKS,
  RANK_LABEL,
} from '@/lib/constants';

export default function RegisterPage() {
  const s = useSubmit();
  const [done, setDone] = useState<string | null>(null);
  const [flightStatus, setFlightStatus] = useState<string>('CAPTAIN');
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  // Checked as soon as the person leaves the box, before they press Create account.
  const [live, setLive] = useState<{ email?: string; phone?: string }>({});
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const PHONE_RE = /^\+?[0-9 ()-]{7,20}$/;
  const checkEmail = (v: string) => setLive((l) => ({ ...l, email: v.trim() && !EMAIL_RE.test(v.trim()) ? 'Enter a valid email address, for example name@example.com.' : undefined }));
  const checkPhone = (v: string) => setLive((l) => ({ ...l, phone: v.trim() && !PHONE_RE.test(v.trim()) ? 'Enter a valid phone number, for example +234 803 000 0000.' : undefined }));

  async function pickPhoto(file: File | undefined) {
    setPhotoError(null);
    if (!file) return;
    try {
      setPhoto(await resizeImage(file, 400, 'image/jpeg', 0.85));
    } catch (e) {
      setPhotoError((e as Error).message);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    if (!EMAIL_RE.test((f.email ?? '').trim())) {
      checkEmail(f.email ?? '');
      s.setError('Check the email address.');
      return;
    }
    if (!passwordMeetsRules(f.password ?? '')) {
      s.setError('The password does not meet all the rules yet.');
      return;
    }
    if (f.password !== f.confirm) {
      s.setError('The two passwords do not match.');
      return;
    }
    const { confirm, accept, ...body } = f;
    void confirm;
    if (accept !== 'on') {
      s.setError('Tick the box to accept the privacy policy and conditions of use.');
      return;
    }
    const res = await s.run(() =>
      api('auth/register', { body: { ...body, pilotCategory: body.flightStatus === 'NONE' ? 'NIL' : body.pilotCategory, accept: true, ...(photo ? { photo } : {}) } }),
    );
    if (res) setDone(String(f.email));
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl">Check Your Email</h1>
        <p>
          We sent a confirmation link to <strong>{done}</strong>. Open it within 24 hours. After that, Admin activates your account and you can sign in.
        </p>
        <a href="/login" className="btn-secondary self-start">
          Back to sign in
        </a>
      </div>
    );
  }

  const err = s.fields;
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <h1 className="text-xl">Create an Account</h1>
      <FormError error={s.error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="rank" label="Rank" error={err.rank}>
          <select id="rank" name="rank" className="input" defaultValue="FLYING_OFFICER" required>
            {RANKS.map((r) => (
              <option key={r} value={r}>
                {RANK_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>
        <Field id="nafNumber" label="Service number" error={err.nafNumber}>
          <input id="nafNumber" name="nafNumber" className="input" required />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="firstName" label="First name" error={err.firstName}>
          <input id="firstName" name="firstName" autoComplete="given-name" className="input" required />
        </Field>
        <Field id="middleName" label="Middle name (optional)" error={err.middleName}>
          <input id="middleName" name="middleName" autoComplete="additional-name" className="input" />
        </Field>
        <Field id="surname" label="Surname" error={err.surname}>
          <input id="surname" name="surname" autoComplete="family-name" className="input" required />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="email" label="Email" error={live.email ?? err.email}>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            className={`input ${live.email ? 'input-error' : ''}`}
            required
            aria-invalid={live.email ? true : undefined}
            aria-describedby={live.email ? 'email-error' : undefined}
            onBlur={(e) => checkEmail(e.target.value)}
            onChange={(e) => live.email && checkEmail(e.target.value)}
          />
        </Field>
        <Field id="phone" label="Phone" error={live.phone ?? err.phone}>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+234…"
            className={`input ${live.phone ? 'input-error' : ''}`}
            required
            aria-invalid={live.phone ? true : undefined}
            aria-describedby={live.phone ? 'phone-error' : undefined}
            onBlur={(e) => checkPhone(e.target.value)}
            onChange={(e) => live.phone && checkPhone(e.target.value)}
          />
        </Field>
      </div>
      <Field id="appointment" label="Appointment" error={err.appointment}>
        <select id="appointment" name="appointment" className="input" defaultValue="SQUADRON_PILOT" required>
          {APPOINTMENTS.map((a) => (
            <option key={a} value={a}>
              {APPOINTMENT_LABEL[a]}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="flightStatus" label="Flight status" error={err.flightStatus}>
          <select id="flightStatus" name="flightStatus" className="input" value={flightStatus} onChange={(e) => setFlightStatus(e.target.value)}>
            {FLIGHT_STATUSES.map((v) => (
              <option key={v} value={v}>
                {FLIGHT_STATUS_LABEL[v]}
              </option>
            ))}
          </select>
        </Field>
        <Field id="pilotCategory" label="Pilot category" error={err.pilotCategory}>
          <select id="pilotCategory" name="pilotCategory" className="input" defaultValue="NIL" disabled={flightStatus === 'NONE'}>
            {PILOT_CATEGORIES.map((v) => (
              <option key={v} value={v}>
                {PILOT_CATEGORY_LABEL[v]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field id="photo" label="Photo (optional)" error={photoError ?? err.photo} hint="You can add or change it later under My profile.">
        <div className="flex items-center gap-3">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" width={56} height={56} className="h-14 w-14 rounded-full border border-line object-cover" />
          ) : (
            <span aria-hidden="true" className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#DCE6F5] text-[12px] text-ink-muted">
              None
            </span>
          )}
          <input id="photo" type="file" accept="image/*" onChange={(e) => pickPhoto(e.target.files?.[0])} />
          {photo && (
            <button type="button" className="text-[13px] font-semibold underline" onClick={() => setPhoto(null)}>
              Remove
            </button>
          )}
        </div>
      </Field>
      <PasswordFields name="password" label="Password" confirmLabel="Confirm password" error={err.password} />
      <div className="flex flex-col gap-1">
        <label htmlFor="accept" className="flex items-start gap-3 text-[14px]">
          <input id="accept" name="accept" type="checkbox" required className="mt-0.5 h-5 w-5 shrink-0" aria-describedby={err.accept ? 'accept-error' : undefined} />
          <span>
            I have read the <a href="/privacy" target="_blank" rel="noopener">privacy policy</a> and <a href="/terms" target="_blank" rel="noopener">conditions of use</a>, and I am 18 or over.
          </span>
        </label>
        {err.accept && (
          <p id="accept-error" className="text-[13px] font-semibold text-bad-fg">
            {err.accept}
          </p>
        )}
      </div>
      <button className="btn-primary h-12" disabled={s.busy}>
        {s.busy ? 'Creating…' : 'Create account'}
      </button>
      <a href="/login" className="self-center text-[14px] font-semibold">
        I already have an account
      </a>
    </form>
  );
}
