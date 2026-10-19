import type { RiskDetail } from '@/lib/services/risk-queries';
import { APPROVER_ROLE_LABEL, DECISION_LABEL, RISK_CATEGORIES, personName, SEAT_SHORT, type SeatValue } from '@/lib/constants';
import { localTime } from '@/lib/time';
import { RiskPill } from './ui';

type RiskLike = Pick<RiskDetail, 'id' | 'level' | 'totalScore' | 'levelReason' | 'mitigations' | 'approvals' | 'imsafe' | 'mission'> & Record<string, unknown>;

export function RatingBars({ ra }: { ra: Record<string, unknown> }) {
  return (
    <div className="flex flex-col gap-1.5">
      {RISK_CATEGORIES.map((c) => {
        const r = Number(ra[c.key]);
        const colour = r >= 4 ? 'bg-bad-solid' : r === 3 ? 'bg-warn-solid' : 'bg-brand';
        return (
          <div key={c.key} className="flex items-center gap-2.5 text-[13px]">
            <span className="flex-1">{c.label}</span>
            <span className="inline-flex gap-[3px]" aria-label={`${c.label} rated ${r} of 5`}>
              {[1, 2, 3, 4, 5].map((i) => (
                <span key={i} className={`h-2 w-3.5 rounded-sm ${i <= r ? colour : 'bg-[#E1E7EF]'}`} />
              ))}
            </span>
            <span className="w-3.5 text-right font-mono">{r}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Compact summary of a risk assessment used on dashboards and the approval queue */
export function ApprovalSummary({ ra }: { ra: RiskLike }) {
  const m = ra.mission;
  const missing = m.crew.filter((c) => !ra.imsafe.some((i) => i.userId === c.userId));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <a href={`/risk/${ra.id}`} className="mono text-[15px] no-underline">
            {m.missionNo}
          </a>
          <div className="text-[13px] text-ink-muted">
            {m.name} · {m.aircraft.registration} · T/O {localTime(m.takeoffAt)}
          </div>
          <div className="text-[13px] text-ink-muted">{m.crew.map((c) => `${personName(c.user)} (${SEAT_SHORT[c.seat as SeatValue]})`).join(' · ')}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <RiskPill level={ra.level} />
          <span className="font-mono text-[13px]">{ra.totalScore} / 40</span>
        </div>
      </div>
      <RatingBars ra={ra} />
      <div className="flex flex-col gap-1 rounded-lg bg-[#F7F9FC] px-3 py-2.5 text-[13px]">
        <div>
          <span className="font-semibold">Why this level:</span> {ra.levelReason}
        </div>
        <div>
          <span className="font-semibold">IMSAFE:</span>{' '}
          {missing.length ? `waiting for ${missing.map((c) => personName(c.user)).join(', ')}` : ra.imsafe.some((i) => i.illness || i.medication || i.alcohol || i.stress || i.fatigue || i.eating) ? 'concerns reported — see detail' : 'all crew clear'}
        </div>
        {ra.mitigations && (
          <div>
            <span className="font-semibold">Mitigation:</span> {ra.mitigations}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5 text-[13px]">
        {ra.approvals.map((a) => (
          <div key={a.id} className="flex justify-between gap-3">
            <span>{APPROVER_ROLE_LABEL[a.approverRole]}</span>
            <span className={`font-semibold ${a.decision === 'REJECT' ? 'text-bad-fg' : a.decision ? 'text-good-fg' : 'text-warn-fg'}`}>
              {a.decision ? `${DECISION_LABEL[a.decision]}${a.decidedAt ? ` ${localTime(a.decidedAt)}` : ''}${a.actingFor ? ' (acting)' : ''}` : 'Waiting'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
