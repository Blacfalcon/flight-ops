import type { ReactNode } from 'react';
import { AIRCRAFT_STATUS_LABEL, MISSION_STATUS_LABEL, READINESS_LABEL, type AircraftStatusValue } from '@/lib/constants';

// Small presentational pieces shared by server and client components.

export function PageHeader({ title, sub, actions, back }: { title: string; sub?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        {back && (
          <a href={back.href} className="text-[13px] font-semibold no-underline">
            ← {back.label}
          </a>
        )}
        <h1>{title}</h1>
        {sub && <div className="text-ink-muted">{sub}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className = '', bodyClass = 'card-body', id }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string; id?: string }) {
  return (
    <section id={id} className={`card overflow-hidden ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          {typeof title === 'string' ? <h2>{title}</h2> : title}
          {actions}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-5 py-6 text-center text-ink-muted">{children}</p>;
}

const MISSION_TONE: Record<string, string> = {
  DRAFT: 'pill-none',
  AWAITING_ENGINEERING: 'pill-warn',
  PUBLISHED: 'pill-none',
  CREW_READY: 'pill-info',
  RISK_SUBMITTED: 'pill-warn',
  CLEARED: 'pill-good',
  COMPLETED: 'pill-good',
  ABORTED: 'pill-bad',
  CANCELLED: 'pill-none',
};

export function MissionStatusPill({ status, takeoffAt, landingAt }: { status: string; takeoffAt?: Date | string; landingAt?: Date | string }) {
  const now = Date.now();
  if (status === 'CLEARED' && takeoffAt && landingAt && new Date(takeoffAt).getTime() <= now) {
    return <span className="pill-info">{new Date(landingAt).getTime() > now ? 'Airborne' : 'Awaiting report'}</span>;
  }
  return <span className={MISSION_TONE[status] ?? 'pill-none'}>{MISSION_STATUS_LABEL[status] ?? status}</span>;
}

export function ReadinessPill({ value }: { value: string }) {
  const tone = value === 'READY' ? 'pill-good' : value === 'PENDING' ? 'pill-none' : 'pill-bad';
  return <span className={tone}>{READINESS_LABEL[value] ?? value}</span>;
}

export function RiskPill({ level, score }: { level?: string | null; score?: number | null }) {
  if (!level) return <span className="pill-none">Not submitted</span>;
  const tone = level === 'LOW' ? 'pill-good' : level === 'MEDIUM' ? 'pill-warn' : 'pill-bad';
  return (
    <span className={tone}>
      {level.charAt(0) + level.slice(1).toLowerCase()}
      {score != null ? ` ${score}` : ''}
    </span>
  );
}

export function AircraftStatusPill({ status }: { status: string }) {
  const tone = status === 'SERVICEABLE' ? 'pill-good' : status === 'UNSERVICEABLE' ? 'pill-bad' : 'pill-warn';
  return <span className={tone}>{AIRCRAFT_STATUS_LABEL[status as AircraftStatusValue] ?? status}</span>;
}

export function Kpi({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'warn' }) {
  return (
    <div className={`kpi ${tone === 'warn' ? 'border-2 border-warn-edge' : ''}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

export function DefinitionGrid({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
      {items.map((i) => (
        <div key={i.label}>
          <dt className="text-[12px] text-ink-muted">{i.label}</dt>
          <dd className="font-semibold">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
