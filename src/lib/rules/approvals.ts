// Self-authorisation. Pure, shared by the server (decisions) and the schedule builder (warnings).
//
// Nobody approves a mission order or a risk assessment for a sortie they are crewed on, unless no one
// else who could approve it is free. Then a crewed approver may self-authorise: a remark is required,
// the decision is marked "Self-authorised", and the Safety Officer is told.

export type ApproverRoleKey = 'COMMANDER' | 'CO_FLYING_WING';

/** Someone who can approve now: the Commander, CO Flying Wing, or the GOO while acting Commander. */
export type ApproverHolder = { id: string; name: string; roles: ApproverRoleKey[] };

const ROLE_NAME: Record<ApproverRoleKey, string> = { COMMANDER: 'Commander', CO_FLYING_WING: 'CO Flying Wing' };

/** True when people hold this role, every one of them is crewed, and at least one is crewed. */
function onlyCrewedHold(holders: ApproverHolder[], crewIds: string[], roles: ApproverRoleKey[]): boolean {
  const relevant = holders.filter((h) => h.roles.some((r) => roles.includes(r)));
  return relevant.length > 0 && relevant.every((h) => crewIds.includes(h.id));
}

/** A crewed person may self-authorise the mission order (either role can approve an order). */
export function orderNeedsSelfAuth(holders: ApproverHolder[], crewIds: string[]): boolean {
  return onlyCrewedHold(holders, crewIds, ['COMMANDER', 'CO_FLYING_WING']);
}

/** A crewed person may self-authorise this risk-assessment slot. */
export function riskSlotNeedsSelfAuth(holders: ApproverHolder[], crewIds: string[], role: ApproverRoleKey): boolean {
  return onlyCrewedHold(holders, crewIds, [role]);
}

/** Plain-language warning for the schedule builder and the mission page, or null if nothing is needed. */
export function selfAuthWarning(holders: ApproverHolder[], crewIds: string[], requiredRiskRoles: ApproverRoleKey[]): string | null {
  const crewedApprovers = holders.filter((h) => crewIds.includes(h.id));
  if (!crewedApprovers.length) return null;
  const order = orderNeedsSelfAuth(holders, crewIds);
  const riskRoles = requiredRiskRoles.filter((r) => riskSlotNeedsSelfAuth(holders, crewIds, r));
  if (!order && !riskRoles.length) return null;
  const who = crewedApprovers.map((h) => h.name).join(' and ');
  const parts: string[] = [];
  if (order) parts.push('the mission order');
  if (riskRoles.length) parts.push(`the ${riskRoles.map((r) => ROLE_NAME[r]).join(' and ')} decision on the risk assessment`);
  const fix = riskRoles.includes('COMMANDER') || order ? 'change the crew, or ask the Commander to set a GOO delegation for the sortie' : 'change the crew';
  return `${who} ${crewedApprovers.length > 1 ? 'are' : 'is'} crewed and nobody else can decide for them, so ${parts.join(' and ')} will have to be self-authorised. To avoid this, ${fix}.`;
}
