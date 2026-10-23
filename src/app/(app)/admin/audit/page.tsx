import type { Prisma } from '@prisma/client';
import { requirePage } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { nameOnly } from '@/lib/selects';
import { personName } from '@/lib/constants';
import { formatDateTime } from '@/lib/time';
import { Card, Empty, PageHeader } from '@/components/ui';

export const metadata = { title: 'Audit Log' };

const PAGE = 100;

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePage('audit.view');
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const where: Prisma.AuditLogWhereInput = {};
  if (sp.action) where.action = { contains: sp.action };
  if (sp.entity) where.entityType = sp.entity;
  const [items, total] = await Promise.all([
    db.auditLog.findMany({ where, include: { actor: { select: nameOnly } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * PAGE, take: PAGE }),
    db.auditLog.count({ where }),
  ]);
  const qs = (p: number) => `/admin/audit?${new URLSearchParams({ ...(sp.action ? { action: sp.action } : {}), ...(sp.entity ? { entity: sp.entity } : {}), page: String(p) })}`;

  return (
    <>
      <PageHeader title="Audit Log" sub={`${total.toLocaleString('en-GB')} entries. The log cannot be edited or deleted.`} />
      <form className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="action" className="label">
            Action contains
          </label>
          <input id="action" name="action" className="input" defaultValue={sp.action} placeholder="e.g. risk, mission.publish, auth.login" />
        </div>
        <div>
          <label htmlFor="entity" className="label">
            Record type
          </label>
          <select id="entity" name="entity" className="input" defaultValue={sp.entity ?? ''}>
            <option value="">All</option>
            {['mission', 'risk_assessment', 'aircraft', 'user', 'flight_plan', 'mission_order', 'snag', 'settings', 'delegation', 'weather_report', 'summary_report'].map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-secondary">Filter</button>
      </form>
      <Card bodyClass="">
        {items.length === 0 ? (
          <Empty>No entries.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table min-w-[860px]">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>Action</th>
                  <th>Record</th>
                  <th>From</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap">{formatDateTime(a.createdAt)}</td>
                    <td>{a.actor ? personName(a.actor) : 'System'}</td>
                    <td className="font-mono text-[12px]">{a.action}</td>
                    <td className="text-[12px]">
                      {a.entityType}
                      {a.entityId ? <span className="block font-mono text-ink-muted">{a.entityId.slice(0, 8)}</span> : null}
                    </td>
                    <td className="text-[12px] text-ink-muted">{a.ip ?? '—'}</td>
                    <td>
                      {(a.before || a.after) && (
                        <details>
                          <summary className="cursor-pointer text-[12px] font-semibold text-brand">View</summary>
                          <pre className="mt-2 max-h-64 max-w-[420px] overflow-auto rounded bg-ground p-2 text-[11px]">{JSON.stringify({ before: a.before, after: a.after }, null, 2)}</pre>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <div className="flex gap-2">
        {page > 1 && (
          <a href={qs(page - 1)} className="btn-secondary btn-sm">
            ← Newer
          </a>
        )}
        {page * PAGE < total && (
          <a href={qs(page + 1)} className="btn-secondary btn-sm">
            Older →
          </a>
        )}
      </div>
    </>
  );
}
