import { requirePage } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { nameOnly } from '@/lib/selects';
import { personName } from '@/lib/constants';
import { formatShortDate } from '@/lib/time';
import { Card, Empty, PageHeader } from '@/components/ui';
import { CloseSnag, RaiseSnag } from '@/components/snag-actions';

export const metadata = { title: 'Snags' };

export default async function SnagsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const auth = await requirePage('snag.view');
  const sp = await searchParams;
  const status = sp.status === 'CLOSED' ? 'CLOSED' : 'OPEN';
  const [snags, aircraft] = await Promise.all([
    db.snag.findMany({
      where: { status, aircraftId: sp.aircraftId || undefined },
      include: {
        aircraft: { select: { registration: true } },
        raisedBy: { select: nameOnly },
        closedBy: { select: nameOnly },
        missionReport: { select: { mission: { select: { id: true, missionNo: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    }),
    db.aircraft.findMany({ where: { active: true }, select: { id: true, registration: true }, orderBy: { registration: 'asc' } }),
  ]);
  const canClose = auth.perms.has('snag.close');

  return (
    <>
      <PageHeader title="Snags" sub="Defects raised by crews after flight or by engineering." />
      <nav aria-label="Filter" className="flex gap-2">
        {(['OPEN', 'CLOSED'] as const).map((st) => (
          <a key={st} href={`/engineering/snags?status=${st}`} aria-current={status === st ? 'page' : undefined} className={`rounded-full px-4 py-2 text-[13px] font-semibold no-underline ${status === st ? 'bg-navy text-white' : 'bg-white text-ink'}`}>
            {st === 'OPEN' ? 'Open' : 'Closed'}
          </a>
        ))}
      </nav>
      {(auth.perms.has('snag.raise') || canClose) && (
        <Card title="Raise a Snag">
          <RaiseSnag aircraft={aircraft} />
        </Card>
      )}
      <Card title={`${snags.length} ${status === 'OPEN' ? 'open' : 'closed'}`} bodyClass="">
        {snags.length === 0 ? (
          <Empty>None.</Empty>
        ) : (
          snags.map((s) => (
            <div key={s.id} className="flex flex-wrap items-start justify-between gap-3 border-t border-[#EEF1F5] px-5 py-3.5 first:border-0">
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  <span className="mono">{s.aircraft.registration}</span> · {s.description}
                </div>
                <div className="text-[12px] text-ink-muted">
                  Raised by {personName(s.raisedBy)} · {formatShortDate(s.createdAt)}
                  {s.missionReport?.mission && (
                    <>
                      {' · '}
                      <a href={`/missions/${s.missionReport.mission.id}`}>{s.missionReport.mission.missionNo}</a>
                    </>
                  )}
                </div>
                {s.status === 'CLOSED' && (
                  <div className="mt-1 text-[13px]">
                    Closed by {s.closedBy ? personName(s.closedBy) : '—'} {s.closedAt ? formatShortDate(s.closedAt) : ''}: {s.actionTaken}
                  </div>
                )}
              </div>
              {s.status === 'OPEN' && canClose && <CloseSnag snagId={s.id} />}
            </div>
          ))
        )}
      </Card>
    </>
  );
}
