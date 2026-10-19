'use client';

import { useState } from 'react';
import { api } from '@/lib/client/api';
import type { Settings } from '@/lib/settings';
import { APPROVER_ROLE_LABEL } from '@/lib/constants';
import { NIGERIAN_AERODROMES } from '@/lib/aerodromes';
import { resizeImage } from '@/lib/client/image';
import { Field, FormError, FormNotice, useSubmit } from './form';

const ROLES = ['CO_FLYING_WING', 'COMMANDER'] as const;

export function SettingsForm({ initial }: { initial: Settings }) {
  const s = useSubmit();
  const [v, setV] = useState<Settings>(initial);
  const num = (x: string) => (x === '' ? 0 : Number(x));

  async function save() {
    if (await s.run(() => api('settings', { method: 'PATCH', body: v }))) s.setNotice('Settings saved.');
  }

  return (
    <div className="flex flex-col gap-6">
      <FormError error={s.error} />
      <FormNotice notice={s.notice} />

      <section className="card flex flex-col gap-4 p-5">
        <h2>Unit</h2>
        <p className="hint mt-0">Shown on the sign-in page, the menu, emails, exported reports and the installed app’s name. Each unit runs its own copy of the system.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="unitName" label="Unit name" error={s.fields['unit.name']}>
            <input id="unitName" className="input" value={v.unit.name} onChange={(e) => setV((x) => ({ ...x, unit: { ...x.unit, name: e.target.value } }))} />
          </Field>
          <Field id="unitShort" label="Short name" error={s.fields['unit.short']} hint="For example DHS.">
            <input id="unitShort" className="input" value={v.unit.short} onChange={(e) => setV((x) => ({ ...x, unit: { ...x.unit, short: e.target.value } }))} />
          </Field>
          <Field id="unitLocation" label="Location" error={s.fields['unit.location']}>
            <input id="unitLocation" className="input" value={v.unit.location} onChange={(e) => setV((x) => ({ ...x, unit: { ...x.unit, location: e.target.value } }))} />
          </Field>
        </div>
      </section>

      <HomeAerodrome value={v.homeAerodrome} error={s.fields['homeAerodrome.icao'] ?? s.fields['homeAerodrome.name']} onChange={(homeAerodrome) => setV((x) => ({ ...x, homeAerodrome }))} />

      <BrandingImages />

      <section className="card flex flex-col gap-4 p-5">
        <h2>Risk assessment approvers</h2>
        <p className="hint mt-0">Only CO Flying Wing and the Commander approve risk assessments. Every ticked role must approve before a mission is cleared. A GOO appointed as acting Commander decides in the Commander’s place.</p>
        <div className="flex flex-wrap gap-4">
          {ROLES.map((r) => (
            <label key={r} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={v.requiredApprovers.includes(r)}
                onChange={(e) => setV((x) => ({ ...x, requiredApprovers: e.target.checked ? [...x.requiredApprovers, r] : x.requiredApprovers.filter((y) => y !== r) }))}
              />
              {APPROVER_ROLE_LABEL[r]}
            </label>
          ))}
        </div>
      </section>

      <section className="card flex flex-col gap-4 p-5">
        <h2>Risk scoring</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="lowMax" label="Low up to (score)">
            <input id="lowMax" type="number" className="input" value={v.riskThresholds.lowMax} onChange={(e) => setV((x) => ({ ...x, riskThresholds: { ...x.riskThresholds, lowMax: num(e.target.value) } }))} />
          </Field>
          <Field id="mediumMax" label="Medium up to (score)" hint="Above this is High (maximum 40).">
            <input id="mediumMax" type="number" className="input" value={v.riskThresholds.mediumMax} onChange={(e) => setV((x) => ({ ...x, riskThresholds: { ...x.riskThresholds, mediumMax: num(e.target.value) } }))} />
          </Field>
          <Field id="soft" label="Points per IMSAFE yes (stress, fatigue, eating)">
            <input id="soft" type="number" className="input" value={v.riskThresholds.softImsafePoints} onChange={(e) => setV((x) => ({ ...x, riskThresholds: { ...x.riskThresholds, softImsafePoints: num(e.target.value) } }))} />
          </Field>
        </div>
      </section>

      <section className="card flex flex-col gap-4 p-5">
        <h2>Weather minima (pre-rate the weather category)</h2>
        <p className="hint mt-0">Defaults follow ICAO VFR at a controlled aerodrome. Set the night values to the national night VFR rules.</p>
        <div className="grid gap-4 sm:grid-cols-4">
          {(
            [
              ['visibilityM', 'Day visibility (m)'],
              ['ceilingFt', 'Day ceiling (ft)'],
              ['nightVisibilityM', 'Night visibility (m)'],
              ['nightCeilingFt', 'Night ceiling (ft)'],
            ] as const
          ).map(([k, label]) => (
            <Field key={k} id={k} label={label}>
              <input id={k} type="number" className="input" value={v.vmcMinima[k]} onChange={(e) => setV((x) => ({ ...x, vmcMinima: { ...x.vmcMinima, [k]: num(e.target.value) } }))} />
            </Field>
          ))}
        </div>
      </section>

      <section className="card flex flex-col gap-4 p-5">
        <h2>Reminders, fuel, inspections and reports</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="readinessMinutes" label="Readiness request (minutes before take-off)">
            <input id="readinessMinutes" type="number" className="input" value={v.reminders.readinessMinutes} onChange={(e) => setV((x) => ({ ...x, reminders: { ...x.reminders, readinessMinutes: num(e.target.value) } }))} />
          </Field>
          <Field id="noResponseMinutes" label="Flag no reply (minutes before)">
            <input id="noResponseMinutes" type="number" className="input" value={v.reminders.noResponseMinutes} onChange={(e) => setV((x) => ({ ...x, reminders: { ...x.reminders, noResponseMinutes: num(e.target.value) } }))} />
          </Field>
          <Field id="riskMinutes" label="Risk assessment reminder (minutes before)">
            <input id="riskMinutes" type="number" className="input" value={v.reminders.riskMinutes} onChange={(e) => setV((x) => ({ ...x, reminders: { ...x.reminders, riskMinutes: num(e.target.value) } }))} />
          </Field>
          <Field id="density" label="Fuel density (kg per litre)">
            <input id="density" type="number" step="0.01" className="input" value={v.fuelDensityKgPerL} onChange={(e) => setV((x) => ({ ...x, fuelDensityKgPerL: num(e.target.value) }))} />
          </Field>
          <Field id="warnHours" label="Warn when hours to inspection below">
            <input id="warnHours" type="number" className="input" value={v.inspectionWarning.hours} onChange={(e) => setV((x) => ({ ...x, inspectionWarning: { ...x.inspectionWarning, hours: num(e.target.value) } }))} />
          </Field>
          <Field id="warnDays" label="Warn when inspection due within (days)">
            <input id="warnDays" type="number" className="input" value={v.inspectionWarning.days} onChange={(e) => setV((x) => ({ ...x, inspectionWarning: { ...x.inspectionWarning, days: num(e.target.value) } }))} />
          </Field>
          <Field id="dailyTime" label="Daily summary time (local)">
            <input id="dailyTime" type="time" className="input" value={v.summarySchedule.dailyTime} onChange={(e) => setV((x) => ({ ...x, summarySchedule: { ...x.summarySchedule, dailyTime: e.target.value } }))} />
          </Field>
          <Field id="weeklyDay" label="Weekly summary day">
            <select id="weeklyDay" className="input" value={v.summarySchedule.weeklyDay} onChange={(e) => setV((x) => ({ ...x, summarySchedule: { ...x.summarySchedule, weeklyDay: Number(e.target.value) } }))}>
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <button className="btn-primary self-start" disabled={s.busy} onClick={save}>
        {s.busy ? 'Saving…' : 'Save settings'}
      </button>
    </div>
  );
}

type Home = Settings['homeAerodrome'];

/** Pick the home aerodrome from the Nigerian list, or type a helipad / airstrip that is not listed. */
function HomeAerodrome({ value, error, onChange }: { value: Home; error?: string; onChange: (v: Home) => void }) {
  const listed = NIGERIAN_AERODROMES.find((a) => a.icao === value.icao);
  const [manual, setManual] = useState(!listed);
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const matches = term
    ? NIGERIAN_AERODROMES.filter((a) => `${a.icao} ${a.name} ${a.place}`.toLowerCase().includes(term))
    : NIGERIAN_AERODROMES;

  return (
    <section className="card flex flex-col gap-4 p-5">
      <h2>Home aerodrome</h2>
      <p className="hint mt-0">
        Used as the default departure on flight plans and the default station for weather. Currently: <strong>{value.icao ? `${value.icao} · ` : ''}{value.name}</strong>
      </p>
      {error && <p className="field-error">{error}</p>}
      <div role="group" aria-label="How to choose" className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={!manual} onClick={() => setManual(false)} className={!manual ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}>
          Choose from the list
        </button>
        <button type="button" aria-pressed={manual} onClick={() => setManual(true)} className={manual ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}>
          Not listed (helipad or airstrip)
        </button>
      </div>
      {!manual ? (
        <div className="flex flex-col gap-2">
          <Field id="aeroSearch" label="Search by ICAO code, name or town">
            <input id="aeroSearch" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. DNAA or Abuja" />
          </Field>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-line">
            {matches.map((a) => (
              <button
                type="button"
                key={a.icao}
                onClick={() => onChange({ icao: a.icao, name: a.name })}
                aria-pressed={value.icao === a.icao}
                className={`flex w-full items-center justify-between gap-3 border-t border-[#EEF1F5] px-3 py-2 text-left first:border-0 ${value.icao === a.icao ? 'bg-[#E8F0FC] font-semibold' : 'hover:bg-ground'}`}
              >
                <span>
                  <span className="mono">{a.icao}</span> · {a.name}
                  <span className="block text-[12px] text-ink-muted">{a.place}</span>
                </span>
                <span className="text-[12px] text-ink-muted">{a.kind}</span>
              </button>
            ))}
            {matches.length === 0 && <p className="px-3 py-2 text-ink-muted">No match. Use “Not listed” to type it in.</p>}
          </div>
          <p className="hint">List taken from published ICAO location indicators for Nigeria. Confirm codes against the current NCAA AIP.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
          <Field id="aeroName" label="Name (as registered with NCAA)">
            <input id="aeroName" className="input" value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} />
          </Field>
          <Field id="aeroIcao" label="ICAO code (if it has one)">
            <input
              id="aeroIcao"
              className="input font-mono uppercase"
              maxLength={4}
              value={value.icao ?? ''}
              onChange={(e) => onChange({ ...value, icao: e.target.value.toUpperCase() || null })}
            />
          </Field>
        </div>
      )}
    </section>
  );
}

/** Unit logo and page watermark, uploaded straight away (separately from Save settings). */
function BrandingImages() {
  const s = useSubmit();
  const [stamp, setStamp] = useState(() => Date.now());

  async function upload(key: 'logo' | 'watermark', file: File | undefined) {
    if (!file) return;
    let dataUrl: string;
    try {
      dataUrl = await resizeImage(file, 512, 'image/png');
    } catch (e) {
      s.setError((e as Error).message);
      return;
    }
    if (await s.run(() => api(`settings/branding/${key}`, { method: 'PUT', body: { dataUrl } }))) {
      s.setNotice(key === 'logo' ? 'Logo updated. It appears on the sign-in page and in the menu.' : 'Watermark updated.');
      setStamp(Date.now());
    }
  }
  async function reset(key: 'logo' | 'watermark') {
    if (await s.run(() => api(`settings/branding/${key}`, { method: 'DELETE' }))) {
      s.setNotice('Back to the built-in image.');
      setStamp(Date.now());
    }
  }

  return (
    <section className="card flex flex-col gap-4 p-5">
      <h2>Logo and watermark</h2>
      <p className="hint mt-0">JPG or PNG; PNG with a transparent background looks best. Images are resized to 512 px before upload. The watermark is shown very faintly behind every page.</p>
      <FormError error={s.error} />
      <FormNotice notice={s.notice} />
      <div className="grid gap-6 sm:grid-cols-2">
        {(['logo', 'watermark'] as const).map((key) => (
          <div key={key} className="flex items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/branding/${key}?v=${stamp}`} alt="" width={96} height={96} className="h-24 w-24 rounded-lg border border-line bg-white object-contain p-1" />
            <div className="flex flex-col gap-2">
              <div className="font-semibold">{key === 'logo' ? 'Unit logo' : 'Watermark'}</div>
              <label className="btn-secondary btn-sm cursor-pointer self-start">
                {s.busy ? 'Uploading…' : 'Upload image'}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => upload(key, e.target.files?.[0])} />
              </label>
              <button type="button" className="self-start text-[13px] font-semibold text-ink-muted underline" onClick={() => reset(key)}>
                Use the built-in image
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
