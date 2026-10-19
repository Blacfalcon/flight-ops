import { forbidden, invalid, route } from '@/lib/api';
import { commandDashboard, engineeringDashboard, opsDashboard, pilotDashboard, safetyDashboard } from '@/lib/dashboards';

export const GET = route({}, async ({ auth, params }) => {
  switch (params.kind) {
    case 'command':
      if (!auth.perms.has('dashboard.command')) throw forbidden();
      return commandDashboard();
    case 'engineering':
      if (!auth.perms.has('dashboard.engineering')) throw forbidden();
      return engineeringDashboard();
    case 'ops':
      if (!auth.perms.has('dashboard.ops')) throw forbidden();
      return opsDashboard();
    case 'safety':
      if (!auth.perms.has('dashboard.safety')) throw forbidden();
      return safetyDashboard();
    case 'pilot':
      if (!auth.perms.has('dashboard.pilot')) throw forbidden();
      return pilotDashboard(auth.user.id);
    default:
      throw invalid('Unknown dashboard.');
  }
});
