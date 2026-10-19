import type { WeatherReport } from '@prisma/client';
import { localTime, zuluTime } from '@/lib/time';
import { parseWeather } from '@/lib/weather/metar';
import { describeChangeGroups, describeConditions } from '@/lib/weather/plain';
import { expiresAt } from '@/lib/weather/validity';
import { WeatherValidity } from './weather-validity';

type Cloud = { cover: string; baseFt: number | null; type?: string };

export function WeatherTiles({ metar }: { metar: WeatherReport | null }) {
  if (!metar) return <p className="text-ink-muted">No METAR entered yet.</p>;
  const clouds = (metar.clouds as unknown as Cloud[]) ?? [];
  const tiles = [
    { label: 'Wind', value: metar.windSpeedKt == null ? '—' : `${metar.windDir == null ? 'VRB' : `${String(metar.windDir).padStart(3, '0')}°`} / ${metar.windSpeedKt} kt${metar.gustKt ? ` G${metar.gustKt}` : ''}` },
    { label: 'Visibility', value: metar.visibilityM == null ? '—' : metar.visibilityM >= 10_000 ? '10 km +' : `${metar.visibilityM.toLocaleString('en-GB')} m` },
    { label: 'Cloud', value: clouds.length ? clouds.map((c) => `${c.cover} ${c.baseFt != null ? c.baseFt.toLocaleString('en-GB') : '///'}${c.type ?? ''}`).join(', ') : 'Nil / CAVOK' },
    { label: 'Temp / dew point', value: metar.temperatureC == null ? '—' : `${metar.temperatureC}° / ${metar.dewpointC ?? '—'}°C` },
    { label: 'QNH', value: metar.qnhHpa ? `${metar.qnhHpa} hPa` : '—' },
    { label: 'Observed', value: metar.observedAt ? `${zuluTime(metar.observedAt)} (${localTime(metar.observedAt)} L)` : '—' },
  ];
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-lg bg-ground px-3 py-2.5">
          <div className="text-[12px] text-ink-muted">{t.label}</div>
          <div className="text-[17px] font-bold">{t.value}</div>
        </div>
      ))}
    </div>
  );
}

export function RawReport({ label, text }: { label: string; text?: string | null }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[13px] font-semibold">{label}</div>
      <code className="block rounded-lg bg-navy px-3 py-2.5 font-mono text-[12px] leading-relaxed text-navy-text">{text ?? 'None entered'}</code>
    </div>
  );
}

/** Plain-English reading of a stored METAR or TAF (re-read from its code). */
export function PlainWeather({ report, compact = false }: { report: Pick<WeatherReport, 'kind' | 'rawText' | 'createdAt' | 'station'> | null; compact?: boolean }) {
  if (!report) return null;
  const p = parseWeather(report.rawText, report.kind as 'METAR' | 'TAF', report.createdAt);
  const lines = describeConditions(p);
  const changes = report.kind === 'TAF' ? describeChangeGroups(p.changeGroups) : [];
  const when =
    report.kind === 'METAR'
      ? p.observedAt
        ? `Observed at ${p.station ?? report.station} at ${zuluTime(p.observedAt)} (${localTime(p.observedAt)} local)`
        : null
      : p.validFrom && p.validTo
        ? `Forecast for ${p.station ?? report.station}, valid ${zuluTime(p.validFrom)} to ${zuluTime(p.validTo)} (${localTime(p.validFrom)}–${localTime(p.validTo)} local)`
        : null;
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-white px-3.5 py-3">
      <div className="text-[13px] font-semibold">{report.kind === 'METAR' ? 'Current weather in plain English' : 'Forecast (TAF) in plain English'}</div>
      {when && <div className="text-[13px] text-ink-muted">{when}</div>}
      <ul className={`ml-5 list-disc ${compact ? 'text-[13px]' : 'text-[14px]'} leading-relaxed`}>
        {lines.map((l, i) => (
          <li key={i}>{l}.</li>
        ))}
      </ul>
      {changes.length > 0 && (
        <>
          <div className="mt-1 text-[13px] font-semibold">Changes expected</div>
          <ul className={`ml-5 list-disc ${compact ? 'text-[13px]' : 'text-[14px]'} leading-relaxed`}>
            {changes.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Wraps a METAR or TAF with its validity: a live countdown, and the report greyed out once expired. */
export function ValidReport({ report, children }: { report: Pick<WeatherReport, 'kind' | 'observedAt' | 'validFrom' | 'validTo' | 'createdAt'> | null; children: React.ReactNode }) {
  if (!report) return <>{children}</>;
  return (
    <WeatherValidity kind={report.kind as 'METAR' | 'TAF'} expiresAt={expiresAt(report).toISOString()}>
      {children}
    </WeatherValidity>
  );
}
