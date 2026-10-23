import { requirePage } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { nameOnly } from '@/lib/selects';
import { personName } from '@/lib/constants';
import { formatDateTime, localDate } from '@/lib/time';
import { Card, Empty, PageHeader } from '@/components/ui';
import { CancelDelegation, DelegationForm } from '@/components/delegation-form';

export const metadata = { title: 'Acting Commander' };

export default async function DelegationsPage() {
  const auth = await requirePage('delegation.manage');
  const [commanders, goos, list] = await Promise.all([
    db.user.findMany({ where: { appointment: 'COMMANDER', accountStatus: 'ACTIVE' }, select: nameOnly }),
    db.user.findMany({ where: { appointment: 'GOO', accountStatus: 'ACTIVE' }, select: nameOnly }),
    db.delegation.findMany({
      where: { endsAt: { gt: new Date(Date.now() - 60 * 86_400_000) } },
      include: { fromUser: { select: nameOnly }, toUser: { select: nameOnly }, setBy: { select: nameOnly } },
      orderBy: { startsAt: 'desc' },
    }),
  ]);
  const now = new Date();
  const fromChoices = auth.user.appointment === 'COMMANDER' ? commanders.filter((c) => c.id === auth.user.id) : commanders;
  return (
    <>
      <PageHeader title="Acting Commander" sub="While appointed, the GOO has every Commander right, including risk approvals. Outside the period the GOO has pilot rights only." />
      <Card title="Appoint the GOO as Acting Commander">
        {goos.length === 0 || fromChoices.length === 0 ? (
          <Empty>There must be an active Commander and an active GOO account first.</Empty>
        ) : (
          <DelegationForm commanders={fromChoices.map((c) => ({ id: c.id, name: personName(c) }))} goos={goos.map((g) => ({ id: g.id, name: personName(g) }))} today={localDate()} />
        )}
      </Card>
      <Card title="Periods" bodyClass="">
        {list.length === 0 ? (
          <Empty>None in the last 60 days.</Empty>
        ) : (
          list.map((d) => {
            const live = !d.cancelledAt && d.startsAt <= now && d.endsAt > now;
            const future = !d.cancelledAt && d.startsAt > now;
            return (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EEF1F5] px-5 py-3.5 first:border-0">
                <div>
                  <div className="font-semibold">
                    {personName(d.toUser)} acting for {personName(d.fromUser)}
                  </div>
                  <div className="text-[13px] text-ink-muted">
                    {formatDateTime(d.startsAt)} → {formatDateTime(d.endsAt)} · set by {personName(d.setBy)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={d.cancelledAt ? 'pill-none' : live ? 'pill-good' : future ? 'pill-info' : 'pill-none'}>{d.cancelledAt ? 'Ended early' : live ? 'In effect' : future ? 'Scheduled' : 'Finished'}</span>
                  {(live || future) && <CancelDelegation id={d.id} />}
                </div>
              </div>
            );
          })
        )}
      </Card>
    </>
  );
}
