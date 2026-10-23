import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { approverRolesFor } from '@/lib/rbac';
import { APPOINTMENT_LABEL, personName, type AppointmentValue } from '@/lib/constants';
import { Shell, type NavItem } from '@/components/shell';
import { getBranding } from '@/lib/branding';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuth();
  if (!auth) redirect('/login');
  const path = (await headers()).get('x-pathname') ?? '';
  if (auth.mfaSetupRequired && !path.startsWith('/me/security')) redirect('/me/security?setup=required');

  const p = auth.perms;
  const myRoles = approverRolesFor(auth.roles);
  const [unread, awaitingMe, pendingRequests, ordersToApprove, branding] = await Promise.all([
    db.notification.count({ where: { userId: auth.user.id, readAt: null } }),
    p.has('risk.approve')
      ? db.riskApproval.count({ where: { decision: null, approverRole: { in: myRoles }, riskAssessment: { status: 'SUBMITTED' } } })
      : Promise.resolve(0),
    p.has('changeRequest.decide') ? db.profileChangeRequest.count({ where: { status: 'PENDING' } }) : Promise.resolve(0),
    p.has('order.approve') ? db.missionOrder.count({ where: { status: 'SUBMITTED' } }) : Promise.resolve(0),
    getBranding(),
  ]);

  const nav: NavItem[] = [
    { href: '/dashboard', label: 'Dashboard', show: true },
    { href: '/schedule', label: 'Schedule & Missions', show: p.has('schedule.viewAll') },
    { href: '/missions', label: 'My Missions', show: p.has('dashboard.pilot') },
    { href: '/risk', label: 'Risk Approvals', show: p.has('risk.view'), badge: awaitingMe },
    { href: '/aircraft', label: 'Aircraft', show: p.has('aircraft.view') },
    { href: '/engineering/serviceability', label: 'Daily Confirmation', show: p.has('serviceability.confirm') },
    { href: '/engineering/snags', label: 'Snags', show: p.has('snag.view') },
    { href: '/flight-plans', label: 'Flight Plans', show: p.has('flightplan.viewAll') || p.has('flightplan.create') },
    { href: '/mission-orders', label: 'Mission Orders', show: p.has('order.view') || p.has('dashboard.pilot'), badge: ordersToApprove },
    { href: '/weather', label: 'Weather', show: p.has('weather.view') },
    { href: '/safety', label: 'Safety', show: p.has('safety.view') || p.has('safety.raise') },
    { href: '/reports', label: 'Reports', show: p.has('summary.view') },
    { href: '/admin/users', label: 'Personnel', show: p.has('personnel.view') },
    { href: '/admin/requests', label: 'Change Requests', show: p.has('changeRequest.decide'), badge: pendingRequests },
    { href: '/admin/delegations', label: 'Acting Commander', show: p.has('delegation.manage') },
    { href: '/admin/settings', label: 'Settings', show: p.has('settings.manage') },
    { href: '/admin/audit', label: 'Audit Log', show: p.has('audit.view') },
  ];

  const roleLabel = auth.actingCommander ? 'GOO · acting Commander' : APPOINTMENT_LABEL[auth.user.appointment as AppointmentValue];
  return (
    <Shell
      nav={nav.filter((n) => n.show)}
      user={{ id: auth.user.id, name: personName(auth.user), fullName: auth.user.fullName, role: roleLabel, photoUpdatedAt: auth.user.photoUpdatedAt?.toISOString() ?? null }}
      unit={{ short: branding.unit.short, location: branding.unit.location }}
      logoVersion={branding.logoVersion}
      unread={unread}
      isPilot={p.has('dashboard.pilot')}
    >
      {children}
    </Shell>
  );
}
