import { requirePage } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import {
  APPOINTMENT_LABEL,
  FLIGHT_STATUS_LABEL,
  PILOT_CATEGORY_LABEL,
  RANK_LABEL,
  type AppointmentValue,
  type FlightStatusValue,
  type PilotCategoryValue,
  type RankValue,
} from '@/lib/constants';
import { formatDateTime, hm } from '@/lib/time';
import { Card, DefinitionGrid, PageHeader } from '@/components/ui';
import { ChangePassword, ChangeRequest, ContactForm, EmailAlertsForm } from '@/components/me-forms';
import { PhotoUpload } from '@/components/photo-upload';
import { PhonePush } from '@/components/phone-push';
import { DeleteMyAccount } from '@/components/delete-account';

export const metadata = { title: 'My profile' };

const LABELS: Record<string, Record<string, string>> = { rank: RANK_LABEL, appointment: APPOINTMENT_LABEL, flightStatus: FLIGHT_STATUS_LABEL, pilotCategory: PILOT_CATEGORY_LABEL };
const FIELD_TITLE: Record<string, string> = { rank: 'rank', appointment: 'appointment', flightStatus: 'flight status', pilotCategory: 'pilot category' };

export default async function MePage() {
  const auth = await requirePage();
  const u = auth.user;
  const [pending, totals, delegation] = await Promise.all([
    db.profileChangeRequest.findMany({ where: { userId: u.id }, orderBy: { createdAt: 'desc' }, take: 10 }),
    db.missionReport.aggregate({ where: { mission: { crew: { some: { userId: u.id } } } }, _sum: { flightTimeMin: true }, _count: true }),
    db.delegation.findFirst({ where: { toUserId: u.id, cancelledAt: null, endsAt: { gt: new Date() } }, orderBy: { startsAt: 'asc' } }),
  ]);

  return (
    <>
      <PageHeader title="My profile" actions={<a href="/me/security" className="btn-secondary btn-sm">Sign-in security</a>} />
      {delegation && (
        <div className="alert-info">
          You are appointed acting Commander from {formatDateTime(delegation.startsAt)} to {formatDateTime(delegation.endsAt)}.
        </div>
      )}
      <Card title="Photo">
        <PhotoUpload user={{ id: u.id, fullName: u.fullName, photoUpdatedAt: u.photoUpdatedAt?.toISOString() ?? null }} />
      </Card>
      <Card title="Particulars">
        <DefinitionGrid
          items={[
            { label: 'Rank', value: RANK_LABEL[u.rank as RankValue] },
            { label: 'Name', value: u.fullName },
            { label: 'Service number', value: <span className="font-mono">{u.nafNumber}</span> },
            { label: 'Appointment', value: APPOINTMENT_LABEL[u.appointment as AppointmentValue] },
            { label: 'Flight status', value: FLIGHT_STATUS_LABEL[u.flightStatus as FlightStatusValue] },
            { label: 'Pilot category', value: PILOT_CATEGORY_LABEL[u.pilotCategory as PilotCategoryValue] },
            { label: 'Email', value: u.email },
            { label: 'Phone', value: u.phone },
            { label: 'Total flights recorded', value: `${totals._count} · ${hm(totals._sum.flightTimeMin ?? 0)} h` },
          ]}
        />
      </Card>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-6">
        <Card title="Contact details">
          <ContactForm phone={u.phone} />
        </Card>
        <Card title="Phone notifications">
          <PhonePush />
        </Card>
        <Card title="Email notifications">
          <EmailAlertsForm current={u.emailAlerts} />
        </Card>
        <Card title="Request a change">
          <ChangeRequest current={{ rank: u.rank, appointment: u.appointment, flightStatus: u.flightStatus, pilotCategory: u.pilotCategory }} />
          {pending.length > 0 && (
            <div className="mt-4 flex flex-col gap-2 text-[13px]">
              {pending.map((p) => (
                <div key={p.id} className="flex justify-between gap-3 rounded-lg bg-ground px-3 py-2">
                  <span>
                    {p.field === 'accountDeletion' ? 'Delete my account' : `${FIELD_TITLE[p.field] ?? p.field}: ${LABELS[p.field]?.[p.oldValue] ?? p.oldValue} → ${LABELS[p.field]?.[p.newValue] ?? p.newValue}`}
                  </span>
                  <span className={p.status === 'PENDING' ? 'pill-warn' : p.status === 'APPROVED' ? 'pill-good' : 'pill-bad'}>{p.status.charAt(0) + p.status.slice(1).toLowerCase()}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title="Password">
          <ChangePassword />
        </Card>
        <Card title="Delete my account">
          <DeleteMyAccount pending={pending.some((p) => p.field === 'accountDeletion' && p.status === 'PENDING')} />
        </Card>
      </div>
    </>
  );
}
