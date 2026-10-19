'use client';

import { useEffect, useState, type ReactNode } from 'react';

// Shows how long a METAR or TAF is still valid, counting down live, and greys out the report once
// it has expired. Worked out on the device, so a page saved for offline use still shows the truth.

function zulu(d: Date) {
  return `${d.toISOString().slice(11, 16)}Z`;
}
function local(d: Date) {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' });
}
function left(ms: number) {
  const m = Math.max(0, Math.round(ms / 60_000));
  if (m < 60) return `${m} min left`;
  const h = Math.floor(m / 60);
  return `${h} h ${String(m % 60).padStart(2, '0')} min left`;
}

function useNow(stepMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), stepMs);
    return () => window.clearInterval(id);
  }, [stepMs]);
  return now;
}

export function WeatherValidity({ kind, expiresAt, children }: { kind: 'METAR' | 'TAF'; expiresAt: string; children?: ReactNode }) {
  const now = useNow();
  const exp = new Date(expiresAt);
  const remaining = exp.getTime() - now;
  const expired = remaining <= 0;
  const soon = !expired && remaining < (kind === 'METAR' ? 15 : 60) * 60_000;
  return (
    <div className="flex flex-col gap-2">
      <div role="status" className={expired ? 'alert-bad' : soon ? 'alert-warn' : 'alert-good'}>
        {expired ? (
          <>
            <span className="font-semibold">{kind} expired</span> at {zulu(exp)} ({local(exp)} local). Do not use it for planning; a current {kind} is needed.
          </>
        ) : (
          <>
            <span className="font-semibold">{kind} valid</span> until {zulu(exp)} ({local(exp)} local) · {left(remaining)}
          </>
        )}
      </div>
      {children && <div className={expired ? 'pointer-events-none select-none opacity-40 grayscale' : ''} aria-hidden={expired || undefined}>{children}</div>}
    </div>
  );
}
