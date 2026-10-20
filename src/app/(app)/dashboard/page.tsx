import { requirePage } from '@/lib/auth/guard';
import { homeDashboard } from '@/lib/rbac';
import { db } from '@/lib/db';
import { personName } from '@/lib/constants';
import { CommandDashboard } from '@/components/dashboards/command';
import { EngineeringDashboard } from '@/components/dashboards/engineering';
import { OpsDashboard } from '@/components/dashboards/ops';
import { PilotDashboard } from '@/components/dashboards/pilot';
import { SafetyDashboard } from '@/components/dashboards/safety';
import { Card, Kpi } from '@/components/ui';

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const auth = await requirePage();
  const home = homeDashboard(auth.perms);
  const alsoPilot = home !== 'pilot' && auth.perms.has('dashboard.pilot');

  let main: React.ReactNode;
  switch (home) {
    case 'command':
      main = <CommandDashboard title={auth.actingCommander ? 'Commander’s dashboard (acting)' : auth.user.appointment === 'CO_FLYING_WING' ? 'CO Flying Wing' : 'Commander’s dashboard'} />;
      break;
    case 'engineering':
      main = <EngineeringDashboard canConfirm={auth.perms.has('serviceability.confirm')} />;
      break;
    case 'ops':
      main = <OpsDashboard canWeather={auth.perms.has('weather.update')} />;
      break;
    case 'safety':
      main = <SafetyDashboard />;
      break;
    case 'pilot':
      main = <PilotDashboard userId={auth.user.id} name={personName(auth.user)} />;
      break;
    default: {
      const [pending, requests, users] = await Promise.all([
        db.user.count({ where: { accountStatus: 'PENDING_ACTIVATION' } }),
        db.profileChangeRequest.count({ where: { status: 'PENDING' } }),
        db.user.count({ where: { accountStatus: 'ACTIVE' } }),
      ]);
      main = (
        <>
          <h1>Administration</h1>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
            <a href="/admin/users?status=PENDING_ACTIVATION" className="no-underline">
              <Kpi label="Accounts awaiting activation" value={pending} tone={pending ? 'warn' : undefined} />
            </a>
            <a href="/admin/requests" className="no-underline">
              <Kpi label="Change requests" value={requests} tone={requests ? 'warn' : undefined} />
            </a>
            <a href="/admin/users" className="no-underline">
              <Kpi label="Active users" value={users} />
            </a>
          </div>
          <Card title="Shortcuts">
            <div className="flex flex-wrap gap-2.5">
              <a href="/aircraft/new" className="btn-secondary">
                Add aircraft
              </a>
              <a href="/admin/delegations" className="btn-secondary">
                Acting Commander
              </a>
              <a href="/admin/settings" className="btn-secondary">
                Settings
              </a>
              <a href="/admin/audit" className="btn-secondary">
                Audit log
              </a>
            </div>
          </Card>
        </>
      );
    }
  }

  return (
    <>
      {main}
      {alsoPilot && (
        <section aria-label="My flying" className="flex flex-col gap-6 border-t border-line pt-6">
          <h2 className="text-xl font-bold">My flying</h2>
          <PilotDashboard userId={auth.user.id} name={personName(auth.user)} compact />
        </section>
      )}
    </>
  );
}
