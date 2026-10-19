import type { Prisma } from '@prisma/client';
import { requirePage } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { publicUser } from '@/lib/selects';
import { Avatar } from '@/components/avatar';
import { APPOINTMENTS, APPOINTMENT_LABEL, FLIGHT_STATUS_LABEL, PILOT_CATEGORY_LABEL, personName, type AppointmentValue, type FlightStatusValue, type PilotCategoryValue } from '@/lib/constants';
import { Card, Empty, PageHeader } from '@/components/ui';

export const metadata = { title: 'Personnel' };

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING_VERIFICATION: { label: 'Email not confirmed', cls: 'pill-none' },
  PENDING_ACTIVATION: { label: 'Awaiting activation', cls: 'pill-warn' },
  ACTIVE: { label: 'Active', cls: 'pill-good' },
  SUSPENDED: { label: 'Suspended', cls: 'pill-bad' },
};

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const auth = await requirePage('personnel.view');
  const sp = await searchParams;
  const where: Prisma.UserWhereInput = {};
  if (sp.q) where.OR = [{ fullName: { contains: sp.q, mode: 'insensitive' } }, { nafNumber: { contains: sp.q, mode: 'insensitive' } }, { email: { contains: sp.q, mode: 'insensitive' } }];
  if (sp.status && STATUS[sp.status]) where.accountStatus = sp.status as never;
  if (sp.appointment && (APPOINTMENTS as readonly string[]).includes(sp.appointment)) where.appointment = sp.appointment as never;
  const users = await db.user.findMany({ where, select: publicUser, orderBy: [{ accountStatus: 'asc' }, { appointment: 'asc' }, { fullName: 'asc' }], take: 500 });
  const manage = auth.perms.has('personnel.manage');

  return (
    <>
      <PageHeader title="Personnel" sub={`${users.length} ${users.length === 1 ? 'person' : 'people'}`} />
      <form className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="q" className="label">
            Search
          </label>
          <input id="q" name="q" className="input" defaultValue={sp.q} placeholder="Name, Service number or email" />
        </div>
        <div>
          <label htmlFor="appointment" className="label">
            Appointment
          </label>
          <select id="appointment" name="appointment" className="input" defaultValue={sp.appointment ?? ''}>
            <option value="">All</option>
            {APPOINTMENTS.map((a) => (
              <option key={a} value={a}>
                {APPOINTMENT_LABEL[a]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="status" className="label">
            Account
          </label>
          <select id="status" name="status" className="input" defaultValue={sp.status ?? ''}>
            <option value="">All</option>
            {Object.entries(STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-secondary">Filter</button>
      </form>
      <Card bodyClass="">
        {users.length === 0 ? (
          <Empty>No one matches.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table min-w-[860px]">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Service number</th>
                  <th>Appointment</th>
                  <th>Flight status</th>
                  <th>Category</th>
                  <th>Contact</th>
                  <th>Account</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <span className="flex items-center gap-2.5">
                        <Avatar user={u} size={32} />
                        {manage ? <a href={`/admin/users/${u.id}`} className="font-semibold no-underline">{personName(u)}</a> : <span className="font-semibold">{personName(u)}</span>}
                      </span>
                    </td>
                    <td className="mono">{u.nafNumber}</td>
                    <td>{APPOINTMENT_LABEL[u.appointment as AppointmentValue]}</td>
                    <td>{FLIGHT_STATUS_LABEL[u.flightStatus as FlightStatusValue]}</td>
                    <td>{PILOT_CATEGORY_LABEL[u.pilotCategory as PilotCategoryValue]}</td>
                    <td>
                      <div>{u.phone}</div>
                      <div className="text-ink-muted">{u.email}</div>
                    </td>
                    <td>
                      <span className={STATUS[u.accountStatus].cls}>{STATUS[u.accountStatus].label}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
