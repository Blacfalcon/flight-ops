import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { nameOnly } from '@/lib/selects';
import { AIRCRAFT_STATUS_LABEL, personName, type AircraftStatusValue } from '@/lib/constants';
import { dateOnlyToString, formatDateTime, formatShortDate } from '@/lib/time';
import { AircraftForm } from '@/components/aircraft-form';
import { InspectionButton } from '@/components/inspection-button';
import { AircraftStatusPill, Card, DefinitionGrid, Empty, PageHeader } from '@/components/ui';
import { formatHours } from '@/lib/hours';

export default async function AircraftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePage('aircraft.view');
  const { id } = await params;
  const a = await db.aircraft.findUnique({
    where: { id },
    include: {
      history: { orderBy: { createdAt: 'desc' }, take: 50, include: { changedBy: { select: nameOnly } } },
      snags: { orderBy: { createdAt: 'desc' }, take: 50, include: { raisedBy: { select: nameOnly } } },
    },
  });
  if (!a) notFound();
  const canEdit = auth.perms.has('aircraft.update');

  return (
    <>
      <PageHeader
        back={{ href: '/aircraft', label: 'Aircraft' }}
        title={a.registration}
        sub={a.type}
        actions={
          <>
            <AircraftStatusPill status={a.status} />
            {canEdit && <InspectionButton aircraftId={a.id} intervalHours={Number(a.inspectionIntervalHours)} intervalDays={a.inspectionIntervalDays} />}
          </>
        }
      />
      {canEdit ? (
        <Card title="Record">
          <AircraftForm
            canRetire={auth.perms.has('aircraft.create')}
            initial={{
              id: a.id,
              registration: a.registration,
              type: a.type,
              status: a.status,
              flyingHours: formatHours(Number(a.flyingHours)),
              hoursToNextInspection: formatHours(Number(a.hoursToNextInspection)),
              inspectionIntervalHours: formatHours(Number(a.inspectionIntervalHours)),
              inspectionIntervalDays: a.inspectionIntervalDays?.toString() ?? '',
              lastInspectionDate: a.lastInspectionDate ? dateOnlyToString(a.lastInspectionDate) : '',
              nextInspectionDue: a.nextInspectionDue ? dateOnlyToString(a.nextInspectionDue) : '',
              maintenanceRemarks: a.maintenanceRemarks ?? '',
              active: a.active,
            }}
          />
        </Card>
      ) : (
        <Card title="Record">
          <DefinitionGrid
            items={[
              { label: 'Flying hours', value: formatHours(a.flyingHours) },
              { label: 'Hours to next inspection', value: formatHours(a.hoursToNextInspection) },
              { label: 'Last inspection', value: a.lastInspectionDate ? formatShortDate(a.lastInspectionDate) : '—' },
              { label: 'Next inspection due', value: a.nextInspectionDue ? formatShortDate(a.nextInspectionDue) : '—' },
              { label: 'Remarks', value: a.maintenanceRemarks ?? '—' },
            ]}
          />
        </Card>
      )}
      <div className="flex flex-wrap items-start gap-6">
        <Card className="min-w-0 flex-[1_1_420px]" title="Status history" bodyClass="">
          {a.history.length === 0 ? (
            <Empty>No history yet.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Status</th>
                    <th>Hours / to insp.</th>
                    <th>By · remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {a.history.map((h) => (
                    <tr key={h.id}>
                      <td>{formatDateTime(h.createdAt)}</td>
                      <td>{AIRCRAFT_STATUS_LABEL[h.status as AircraftStatusValue]}</td>
                      <td className="mono">
                        {formatHours(h.flyingHours)} / {formatHours(h.hoursToNextInspection)}
                      </td>
                      <td>
                        {h.changedBy ? personName(h.changedBy) : 'System'}
                        {h.remarks ? ` · ${h.remarks}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card className="min-w-0 flex-[1_1_320px]" title="Snags" actions={<a href={`/engineering/snags?aircraftId=${a.id}`} className="text-[13px] font-semibold">Manage</a>} bodyClass="">
          {a.snags.length === 0 ? (
            <Empty>No snags recorded.</Empty>
          ) : (
            a.snags.map((s) => (
              <div key={s.id} className="flex items-start justify-between gap-3 border-t border-[#EEF1F5] px-5 py-3 first:border-0">
                <div>
                  <div className="font-medium">{s.description}</div>
                  <div className="text-[12px] text-ink-muted">
                    {personName(s.raisedBy)} · {formatShortDate(s.createdAt)}
                  </div>
                </div>
                <span className={s.status === 'OPEN' ? 'pill-warn' : 'pill-good'}>{s.status === 'OPEN' ? 'Open' : 'Closed'}</span>
              </div>
            ))
          )}
        </Card>
      </div>
    </>
  );
}
