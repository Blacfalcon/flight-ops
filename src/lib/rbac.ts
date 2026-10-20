// Role-based access control. Permissions come from the person's appointment;
// anyone with a flight status also gets PILOT; a GOO with an active delegation also gets COMMANDER.
// This file is pure (no database) so it can be shared by server code and the UI.

export type Role =
  | 'COMMANDER'
  | 'CO_FLYING_WING'
  | 'CO_ENGINEERING'
  | 'ENGINEERING_OFFICER'
  | 'OPERATIONS_OFFICER'
  | 'TRAINING_OFFICER'
  | 'SAFETY_OFFICER'
  | 'ADMIN'
  | 'PILOT';

export const PERMISSIONS = [
  'dashboard.command',
  'dashboard.engineering',
  'dashboard.ops',
  'dashboard.safety',
  'dashboard.pilot',
  'aircraft.view',
  'aircraft.create',
  'aircraft.update',
  'serviceability.view',
  'serviceability.confirm',
  'schedule.viewAll',
  'mission.createTraining',
  'mission.createOperational',
  'mission.publish',
  'mission.cancel',
  'order.view',
  'order.manage',
  'order.approve',
  'weather.view',
  'weather.update',
  'readiness.view',
  'readiness.respond',
  'risk.view',
  'risk.submit',
  'risk.approve',
  'risk.comment',
  'flightplan.viewAll',
  'flightplan.create',
  'flightplan.approve',
  'report.view',
  'report.submit',
  'snag.view',
  'snag.raise',
  'snag.close',
  'safety.view',
  'safety.raise',
  'safety.manage',
  'summary.view',
  'summary.export',
  'summary.exportSafety',
  'personnel.view',
  'personnel.manage',
  'changeRequest.decide',
  'delegation.manage',
  'settings.manage',
  'audit.view',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const COMMAND_VIEW: Permission[] = [
  'dashboard.command',
  'aircraft.view',
  'serviceability.view',
  'schedule.viewAll',
  'order.view',
  'weather.view',
  'readiness.view',
  'risk.view',
  'risk.comment',
  'flightplan.viewAll',
  'report.view',
  'snag.view',
  'safety.view',
  'safety.raise',
  'summary.view',
  'personnel.view',
];

const ROLE_PERMS: Record<Role, Permission[]> = {
  COMMANDER: [...COMMAND_VIEW, 'risk.approve', 'order.approve', 'summary.export', 'delegation.manage'],
  CO_FLYING_WING: [...COMMAND_VIEW, 'risk.approve', 'order.approve', 'summary.export'],
  CO_ENGINEERING: [
    'dashboard.engineering',
    'aircraft.view',
    'aircraft.update',
    'serviceability.view',
    'serviceability.confirm',
    'schedule.viewAll',
    'order.view',
    'weather.view',
    'risk.view',
    'risk.comment',
    'report.view',
    'snag.view',
    'snag.close',
    'safety.view',
    'safety.raise',
    'summary.view',
  ],
  // Engineering Officers do the day-to-day engineering work; only CO Engineering confirms daily serviceability
  ENGINEERING_OFFICER: [
    'dashboard.engineering',
    'aircraft.view',
    'aircraft.update',
    'serviceability.view',
    'schedule.viewAll',
    'order.view',
    'weather.view',
    'risk.view',
    'risk.comment',
    'report.view',
    'snag.view',
    'snag.close',
    'safety.view',
    'safety.raise',
    'summary.view',
  ],
  OPERATIONS_OFFICER: [
    'dashboard.ops',
    'aircraft.view',
    'serviceability.view',
    'schedule.viewAll',
    'mission.createTraining',
    'mission.createOperational',
    'mission.publish',
    'mission.cancel',
    'order.view',
    'order.manage',
    'weather.view',
    'weather.update',
    'readiness.view',
    'risk.view',
    'risk.comment',
    'flightplan.viewAll',
    'flightplan.approve',
    'report.view',
    'snag.view',
    'safety.view',
    'safety.raise',
    'summary.view',
    'summary.export',
    'personnel.view',
  ],
  TRAINING_OFFICER: [
    'dashboard.ops',
    'aircraft.view',
    'serviceability.view',
    'schedule.viewAll',
    'mission.createTraining',
    'order.view',
    'order.manage',
    'weather.view',
    'readiness.view',
    'flightplan.viewAll',
    'report.view',
    'snag.view',
    'safety.view',
    'safety.raise',
    'summary.view',
    'personnel.view',
  ],
  SAFETY_OFFICER: [
    'dashboard.safety',
    'aircraft.view',
    'serviceability.view',
    'schedule.viewAll',
    'order.view',
    'weather.view',
    'risk.view',
    'risk.comment',
    'report.view',
    'snag.view',
    'safety.view',
    'safety.raise',
    'safety.manage',
    'summary.view',
    'summary.exportSafety',
  ],
  ADMIN: [
    'aircraft.view',
    'aircraft.create',
    'aircraft.update',
    'serviceability.view',
    'schedule.viewAll',
    'order.view',
    'weather.view',
    'readiness.view',
    'risk.view',
    'flightplan.viewAll',
    'report.view',
    'snag.view',
    'safety.view',
    'summary.view',
    'personnel.view',
    'personnel.manage',
    'changeRequest.decide',
    'delegation.manage',
    'settings.manage',
    'audit.view',
  ],
  PILOT: [
    'dashboard.pilot',
    'aircraft.view',
    'weather.view',
    'readiness.respond',
    'risk.submit',
    'flightplan.create',
    'report.submit',
    'snag.raise',
    'safety.raise',
  ],
};

const APPOINTMENT_ROLE: Record<string, Role | null> = {
  COMMANDER: 'COMMANDER',
  GOO: null, // a pilot unless acting as Commander
  CO_FLYING_WING: 'CO_FLYING_WING',
  CO_ENGINEERING: 'CO_ENGINEERING',
  ENGINEERING_OFFICER: 'ENGINEERING_OFFICER',
  OPERATIONS_OFFICER: 'OPERATIONS_OFFICER',
  TRAINING_OFFICER: 'TRAINING_OFFICER',
  SAFETY_OFFICER: 'SAFETY_OFFICER',
  SQUADRON_PILOT: null,
  ADMIN: 'ADMIN',
};

export function rolesFor(
  user: { appointment: string; flightStatus: string },
  opts: { actingCommander: boolean },
): Role[] {
  const roles = new Set<Role>();
  const r = APPOINTMENT_ROLE[user.appointment];
  if (r) roles.add(r);
  if (user.flightStatus !== 'NONE') roles.add('PILOT');
  if (user.appointment === 'GOO' && opts.actingCommander) roles.add('COMMANDER');
  return [...roles];
}

export function permissionsFor(roles: Role[]): Set<Permission> {
  const out = new Set<Permission>();
  for (const role of roles) for (const p of ROLE_PERMS[role]) out.add(p);
  return out;
}

export function hasPermission(perms: Set<Permission> | Permission[], p: Permission): boolean {
  return Array.isArray(perms) ? perms.includes(p) : perms.has(p);
}

/** The approval slots a person may decide, given their roles */
// The type keeps all four slot names because older risk assessments in the database may still
// carry CO Engineering or Operations Officer slots; only Commander and CO Flying Wing are given out now.
export type ApproverSlot = 'COMMANDER' | 'CO_FLYING_WING' | 'CO_ENGINEERING' | 'OPERATIONS_OFFICER';

export function approverRolesFor(roles: Role[]): ApproverSlot[] {
  const out: ApproverSlot[] = [];
  if (roles.includes('COMMANDER')) out.push('COMMANDER');
  if (roles.includes('CO_FLYING_WING')) out.push('CO_FLYING_WING');
  return out;
}

/** Which dashboard a person lands on */
export function homeDashboard(perms: Set<Permission>): 'command' | 'engineering' | 'ops' | 'safety' | 'pilot' | 'admin' {
  if (perms.has('dashboard.command')) return 'command';
  if (perms.has('dashboard.engineering')) return 'engineering';
  if (perms.has('dashboard.ops')) return 'ops';
  if (perms.has('dashboard.safety')) return 'safety';
  if (perms.has('dashboard.pilot')) return 'pilot';
  return 'admin';
}
