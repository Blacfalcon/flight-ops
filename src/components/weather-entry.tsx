'use client';

import { useMemo, useState } from 'react';
import { api } from '@/lib/client/api';
import { parseWeather } from '@/lib/weather/metar';
import { describeChangeGroups, describeConditions, describePhenomenon } from '@/lib/weather/plain';
import { WEATHER_OPTIONS, blankForm, composeMetar, composeTaf, type CloudRow, type WxForm } from '@/lib/weather/compose';
import { Field, FormError, useSubmit } from './form';

type Kind = 'METAR' | 'TAF';
type Mode = 'form' | 'paste';

/** Enter a METAR or TAF either with a simple form (the code is written for you) or by pasting the code. */
export function WeatherEntry({ station }: { station: string }) {
  const s = useSubmit();
  const [kind, setKind] = useState<Kind>('METAR');
  const [mode, setMode] = useState<Mode>('form');
  const [raw, setRaw] = useState('');
  const [f, setF] = useState<WxForm>(() => blankForm(station));
  const set = <K extends keyof WxForm>(k: K, v: WxForm[K]) => setF((x) => ({ ...x, [k]: v }));
  const setCloud = (i: number, patch: Partial<CloudRow>) => setF((x) => ({ ...x, clouds: x.clouds.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));

  const composed = useMemo(() => (kind === 'METAR' ? composeMetar(f) : composeTaf(f)), [kind, f]);
  const code = mode === 'form' ? composed.code : raw.trim().toUpperCase();
  const formErrors = mode === 'form' ? composed.errors : {};
  const preview = useMemo(() => {
    if (code.length < 10) return null;
    const p = parseWeather(code, kind);
    return { lines: describeConditions(p), changes: kind === 'TAF' ? describeChangeGroups(p.changeGroups) : [] };
  }, [code, kind]);
  const err = (k: string) => formErrors[k] ?? undefined;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (Object.keys(formErrors).length) {
      s.setError('Some fields need attention.');
      return;
    }
    if (await s.run(() => api('weather', { body: { kind, raw: code } }))) window.location.reload();
  }

  const tab = (active: boolean) => `btn-sm rounded-lg px-4 font-semibold ${active ? 'bg-navy text-white' : 'border border-line bg-white'}`;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <FormError error={s.error} />
      <div className="flex flex-wrap gap-4">
        <div role="group" aria-label="Report kind" className="flex gap-2">
          {(['METAR', 'TAF'] as const).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={tab(kind === k)}>
              {k}
            </button>
          ))}
        </div>
        <div role="group" aria-label="How to enter" className="flex gap-2">
          <button type="button" aria-pressed={mode === 'form'} onClick={() => setMode('form')} className={tab(mode === 'form')}>
            Fill in a form
          </button>
          <button type="button" aria-pressed={mode === 'paste'} onClick={() => setMode('paste')} className={tab(mode === 'paste')}>
            Paste the code
          </button>
        </div>
      </div>

      {mode === 'paste' ? (
        <Field id="raw" label={`Paste the ${kind}`} error={s.fields.raw} hint={kind === 'METAR' ? 'For example: DNAA 191400Z 24008KT 8000 SCT018 27/23 Q1011' : 'For example: DNAA 191100Z 1912/2012 22008KT 9999 SCT020 TEMPO 1915/1920 4000 TSRA BKN012CB'}>
          <textarea id="raw" rows={3} className="textarea font-mono uppercase" value={raw} onChange={(e) => setRaw(e.target.value)} required />
        </Field>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-3">
            <Field id="wx-station" label="Station (ICAO)" error={err('station')}>
              <input id="wx-station" className="input font-mono uppercase" maxLength={4} value={f.station} onChange={(e) => set('station', e.target.value.toUpperCase())} />
            </Field>
            <Field id="wx-day" label={kind === 'METAR' ? 'Day (UTC)' : 'Issued day (UTC)'} error={err('day')}>
              <input id="wx-day" className="input font-mono" inputMode="numeric" maxLength={2} value={f.day} onChange={(e) => set('day', e.target.value.replace(/\D/g, ''))} />
            </Field>
            <Field id="wx-time" label={kind === 'METAR' ? 'Observed (HHMM Z)' : 'Issued (HHMM Z)'} error={err('time')}>
              <input id="wx-time" className="input font-mono" inputMode="numeric" maxLength={4} value={f.time} onChange={(e) => set('time', e.target.value.replace(/\D/g, ''))} />
            </Field>
          </div>

          {kind === 'TAF' && (
            <fieldset className="flex flex-col gap-1.5">
              <legend className="label">Valid from / to (day and hour, UTC)</legend>
              <div className="flex flex-wrap items-center gap-2">
                <input aria-label="From day" className="input w-16 font-mono" maxLength={2} value={f.fromDay} onChange={(e) => set('fromDay', e.target.value.replace(/\D/g, ''))} />
                <input aria-label="From hour" className="input w-16 font-mono" maxLength={2} value={f.fromHour} onChange={(e) => set('fromHour', e.target.value.replace(/\D/g, ''))} />
                <span className="text-ink-muted">to</span>
                <input aria-label="To day" className="input w-16 font-mono" maxLength={2} value={f.toDay} onChange={(e) => set('toDay', e.target.value.replace(/\D/g, ''))} />
                <input aria-label="To hour" className="input w-16 font-mono" maxLength={2} value={f.toHour} onChange={(e) => set('toHour', e.target.value.replace(/\D/g, ''))} />
              </div>
              {err('validity') && <p className="field-error">{err('validity')}</p>}
            </fieldset>
          )}

          <fieldset className="flex flex-col gap-2">
            <legend className="label">Wind</legend>
            <div className="flex flex-wrap gap-4 text-[14px]">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={f.windCalm} onChange={(e) => set('windCalm', e.target.checked)} /> Calm
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={f.windVrb} disabled={f.windCalm} onChange={(e) => set('windVrb', e.target.checked)} /> Variable direction
              </label>
            </div>
            {!f.windCalm && (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
                {!f.windVrb && (
                  <Field id="wx-dir" label="From (°)" error={err('windDir')}>
                    <input id="wx-dir" className="input font-mono" inputMode="numeric" maxLength={3} placeholder="240" value={f.windDir} onChange={(e) => set('windDir', e.target.value.replace(/\D/g, ''))} />
                  </Field>
                )}
                <Field id="wx-speed" label="Speed (kt)" error={err('windSpeed')}>
                  <input id="wx-speed" className="input font-mono" inputMode="numeric" maxLength={3} placeholder="08" value={f.windSpeed} onChange={(e) => set('windSpeed', e.target.value.replace(/\D/g, ''))} />
                </Field>
                <Field id="wx-gust" label="Gusts (kt, optional)" error={err('gust')}>
                  <input id="wx-gust" className="input font-mono" inputMode="numeric" maxLength={3} value={f.gust} onChange={(e) => set('gust', e.target.value.replace(/\D/g, ''))} />
                </Field>
              </div>
            )}
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="label">Visibility and weather</legend>
            <label className="flex items-center gap-2 text-[14px]">
              <input type="checkbox" checked={f.cavok} onChange={(e) => set('cavok', e.target.checked)} /> CAVOK (10 km or more, no cloud below 5,000 ft, no CB/TCU, no significant weather)
            </label>
            {!f.cavok && (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
                <Field id="wx-vis" label="Visibility (m)" error={err('visibilityM')} hint="9999 = 10 km or more">
                  <input id="wx-vis" className="input font-mono" inputMode="numeric" maxLength={5} placeholder="8000" value={f.visibilityM} onChange={(e) => set('visibilityM', e.target.value.replace(/\D/g, ''))} />
                </Field>
                {[0, 1].map((i) => (
                  <Field key={i} id={`wx-w${i}`} label={i === 0 ? 'Weather' : 'More weather'}>
                    <select
                      id={`wx-w${i}`}
                      className="input"
                      value={f.weather[i] ?? ''}
                      onChange={(e) => {
                        const next = [...f.weather];
                        next[i] = e.target.value;
                        set('weather', next.filter((w, j) => w || j < i));
                      }}
                    >
                      <option value="">— none —</option>
                      {WEATHER_OPTIONS.map((w) => (
                        <option key={w} value={w}>
                          {w} · {describePhenomenon(w)}
                        </option>
                      ))}
                    </select>
                  </Field>
                ))}
              </div>
            )}
          </fieldset>

          {!f.cavok && (
            <fieldset className="flex flex-col gap-2">
              <legend className="label">Cloud</legend>
              <label className="flex items-center gap-2 text-[14px]">
                <input type="checkbox" checked={f.nsc} onChange={(e) => set('nsc', e.target.checked)} /> No significant cloud (NSC)
              </label>
              {!f.nsc &&
                f.clouds.map((c, i) => (
                  <div key={i} className="flex flex-wrap items-end gap-2">
                    <Field id={`wx-cc${i}`} label={`Layer ${i + 1}`}>
                      <select id={`wx-cc${i}`} className="input w-44" value={c.cover} onChange={(e) => setCloud(i, { cover: e.target.value as CloudRow['cover'] })}>
                        <option value="">— none —</option>
                        <option value="FEW">FEW · few (1–2 oktas)</option>
                        <option value="SCT">SCT · scattered (3–4)</option>
                        <option value="BKN">BKN · broken (5–7)</option>
                        <option value="OVC">OVC · overcast (8)</option>
                        <option value="VV">VV · sky obscured</option>
                      </select>
                    </Field>
                    <Field id={`wx-cb${i}`} label="Base (ft)" error={err(`cloud${i}`)}>
                      <input id={`wx-cb${i}`} className="input w-28 font-mono" inputMode="numeric" maxLength={5} placeholder="1800" value={c.baseFt} onChange={(e) => setCloud(i, { baseFt: e.target.value.replace(/\D/g, '') })} />
                    </Field>
                    <Field id={`wx-ct${i}`} label="Type">
                      <select id={`wx-ct${i}`} className="input w-36" value={c.type} onChange={(e) => setCloud(i, { type: e.target.value as CloudRow['type'] })}>
                        <option value="">—</option>
                        <option value="CB">CB · cumulonimbus</option>
                        <option value="TCU">TCU · towering cumulus</option>
                      </select>
                    </Field>
                  </div>
                ))}
              {!f.nsc && f.clouds.length < 3 && (
                <button type="button" className="btn-secondary btn-sm self-start" onClick={() => set('clouds', [...f.clouds, { cover: '', baseFt: '', type: '' }])}>
                  Add a cloud layer
                </button>
              )}
            </fieldset>
          )}

          {kind === 'METAR' ? (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
              <Field id="wx-t" label="Temperature (°C)" error={err('temp')}>
                <input id="wx-t" className="input font-mono" inputMode="numeric" maxLength={3} value={f.temp} onChange={(e) => set('temp', e.target.value.replace(/[^\d-]/g, ''))} />
              </Field>
              <Field id="wx-d" label="Dew point (°C)" error={err('dew')}>
                <input id="wx-d" className="input font-mono" inputMode="numeric" maxLength={3} value={f.dew} onChange={(e) => set('dew', e.target.value.replace(/[^\d-]/g, ''))} />
              </Field>
              <Field id="wx-q" label="QNH (hPa)" error={err('qnh')}>
                <input id="wx-q" className="input font-mono" inputMode="numeric" maxLength={4} value={f.qnh} onChange={(e) => set('qnh', e.target.value.replace(/\D/g, ''))} />
              </Field>
            </div>
          ) : (
            <Field id="wx-change" label="Changes (optional)" hint="Type TEMPO, BECMG, FM or PROB groups as in the code, e.g. TEMPO 1915/1920 4000 TSRA BKN012CB. They are explained below.">
              <textarea id="wx-change" rows={2} className="textarea font-mono uppercase" value={f.changeGroups} onChange={(e) => set('changeGroups', e.target.value)} />
            </Field>
          )}
        </div>
      )}

      {preview && (
        <div className="flex flex-col gap-2 rounded-lg bg-ground px-4 py-3">
          <div className="text-[13px] font-semibold">Code</div>
          <code className="block rounded-lg bg-navy px-3 py-2.5 font-mono text-[12px] leading-relaxed text-navy-text">{code}</code>
          <div className="text-[13px] font-semibold">In Plain English</div>
          <ul className="ml-5 list-disc text-[14px] leading-relaxed">
            {preview.lines.map((l, i) => (
              <li key={i}>{l}.</li>
            ))}
            {preview.changes.map((l, i) => (
              <li key={`c${i}`}>{l}</li>
            ))}
          </ul>
        </div>
      )}

      <button className="btn-primary self-start" disabled={s.busy || code.length < 10}>
        {s.busy ? 'Publishing…' : `Publish ${kind}`}
      </button>
    </form>
  );
}
