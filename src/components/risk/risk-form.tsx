'use client';

import { useMemo, useState } from 'react';
import { api } from '@/lib/client/api';
import { submitOrQueue } from '@/lib/client/outbox';
import { RISK_CATEGORIES, type RiskCategoryKey } from '@/lib/constants';
import { computeRisk, type Imsafe, type Ratings, type Thresholds } from '@/lib/rules/risk';
import { FormError, useSubmit } from '../form';
import { ImsafeToggles, NO_IMSAFE } from './imsafe-toggles';

const BOX = {
  LOW: 'border-[#A6D9BC] bg-good-bg text-[#0B4F2B]',
  MEDIUM: 'border-[#F2C98A] bg-warn-bg text-[#6B3A04]',
  HIGH: 'border-[#F0B2AD] bg-bad-bg text-[#7A1A14]',
};

export function RiskForm({
  missionId,
  missionNo,
  thresholds,
  weather,
  crewCount,
}: {
  missionId: string;
  missionNo: string;
  thresholds: Thresholds;
  weather: { rating: number; note: string; metar: string | null };
  crewCount: number;
}) {
  const s = useSubmit();
  const [ratings, setRatings] = useState<Ratings>({
    weather: weather.rating,
    aircraftCondition: 0,
    crewReadiness: 0,
    missionComplexity: 0,
    fuelStatus: 0,
    terrain: 0,
    fatigue: 0,
    operationalThreats: 0,
  });
  const [imsafe, setImsafe] = useState<Imsafe>(NO_IMSAFE);
  const [mitigations, setMitigations] = useState('');
  const [lowerReason, setLowerReason] = useState('');
  const [queued, setQueued] = useState(false);

  const complete = Object.values(ratings).every((v) => v >= 1);
  const result = useMemo(() => (complete ? computeRisk(ratings, [imsafe], thresholds) : null), [complete, ratings, imsafe, thresholds]);
  const weatherLowered = ratings.weather < weather.rating;

  async function submit() {
    const body = { ratings, imsafe, mitigations: mitigations || undefined, weatherLoweredReason: weatherLowered ? lowerReason : undefined };
    const res = await s.run(() => submitOrQueue('risk.submit', missionId, body, `${missionNo}: risk assessment`, () => api(`missions/${missionId}/risk-assessments`, { body })));
    if (!res) return;
    if (res.queued) setQueued(true);
    else window.location.href = `/missions/${missionId}`;
  }

  if (queued)
    return (
      <div role="status" className="alert-warn">
        Saved on this device. It will be sent to the approvers when you are back online.
      </div>
    );

  const rate = (key: RiskCategoryKey, n: number) => setRatings((r) => ({ ...r, [key]: n }));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="sticky top-[68px] z-10 bg-ground py-2 lg:top-0">
        <div className={`flex items-center justify-between rounded-xl border px-4 py-3 ${result ? BOX[result.level] : 'border-line bg-white text-ink'}`}>
          <div>
            <div className="text-[12px] font-semibold tracking-wide">RISK LEVEL</div>
            <div className="text-2xl font-bold">{result ? result.level : '—'}</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[22px] font-medium">{result ? result.score : '—'} / 40</div>
            <div className="text-[12px]">{result ? result.reason : 'Rate every category'}</div>
          </div>
        </div>
      </div>

      <FormError error={s.error} />

      <section aria-label="Risk categories" className="card px-4 pb-2 pt-1">
        {RISK_CATEGORIES.map((c) => {
          const v = ratings[c.key];
          return (
            <div key={c.key} className="flex flex-col gap-2 border-b border-[#EEF1F5] py-3 last:border-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">{c.label}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{c.group}</span>
              </div>
              <div role="group" aria-label={`${c.label} rating`} className="grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => {
                  const on = v === n;
                  const colour = n >= 4 ? 'bg-bad-solid' : n === 3 ? 'bg-warn-solid' : 'bg-brand';
                  return (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={on}
                      onClick={() => rate(c.key, n)}
                      className={`h-11 rounded-lg font-bold ${on ? `${colour} text-white` : 'border border-[#C9D3E0] bg-white text-ink'}`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
              <div className="text-[13px] text-ink-muted">
                1 = {c.low.toLowerCase()} · 5 = {c.high.toLowerCase()}
                {c.key === 'weather' && <span className="block">Suggested {weather.rating} from METAR: {weather.note}.</span>}
              </div>
              {c.key === 'weather' && weatherLowered && (
                <div>
                  <label htmlFor="lowerReason" className="label">
                    Why is weather rated lower than the METAR suggests?
                  </label>
                  <input id="lowerReason" className="input" value={lowerReason} onChange={(e) => setLowerReason(e.target.value)} />
                  {s.fields.weatherLoweredReason && <p className="field-error">{s.fields.weatherLoweredReason}</p>}
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section aria-label="IMSAFE" className="card flex flex-col gap-3 p-4">
        <div className="flex items-baseline justify-between">
          <h2>IMSAFE · you</h2>
          {crewCount > 1 && <span className="text-[13px] text-ink-muted">Other crew add theirs after you submit</span>}
        </div>
        <p className="text-[13px] text-ink-muted">Is any of these affecting you today?</p>
        <ImsafeToggles value={imsafe} onChange={setImsafe} />
      </section>

      <section aria-label="Mitigation" className="card flex flex-col gap-2 p-4">
        <label htmlFor="mitigations" className="font-semibold">
          Mitigation{' '}
          <span className={`text-[13px] font-medium ${result?.mitigationRequired ? 'text-bad-fg' : 'text-ink-muted'}`}>
            {result?.mitigationRequired ? '· required for categories rated 4 or 5, or a High level' : '· optional'}
          </span>
        </label>
        <textarea id="mitigations" rows={3} className="textarea" placeholder="What you will do to reduce the risk" value={mitigations} onChange={(e) => setMitigations(e.target.value)} />
        {s.fields.mitigations && <p className="field-error">{s.fields.mitigations}</p>}
      </section>

      <button
        className="btn-primary h-14 text-[17px]"
        disabled={!complete || s.busy || (result?.mitigationRequired && !mitigations.trim()) || (weatherLowered && !lowerReason.trim())}
        onClick={submit}
      >
        {s.busy ? 'Submitting…' : 'Submit for approval'}
      </button>
      <p className="text-center text-[13px] text-ink-muted">Goes to every required approver at once. The Safety Officer can see it.</p>
    </div>
  );
}
