import { describe, expect, it } from 'vitest';
import { orderNeedsSelfAuth, riskSlotNeedsSelfAuth, selfAuthWarning, type ApproverHolder } from '../src/lib/rules/approvals';
import { permissionsFor, rolesFor } from '../src/lib/rbac';

const cmd: ApproverHolder = { id: 'cmd', name: 'Gp Capt A', roles: ['COMMANDER'] };
const cofw: ApproverHolder = { id: 'cofw', name: 'Wg Cdr B', roles: ['CO_FLYING_WING'] };
const goo: ApproverHolder = { id: 'goo', name: 'Wg Cdr G', roles: ['COMMANDER'] };
const both = ['CO_FLYING_WING', 'COMMANDER'] as const;

describe('self-authorisation', () => {
  it('is not needed when no approver is crewed', () => {
    expect(orderNeedsSelfAuth([cmd, cofw], ['p1', 'p2'])).toBe(false);
    expect(selfAuthWarning([cmd, cofw], ['p1', 'p2'], [...both])).toBeNull();
  });
  it('lets the other approver sign the order when one is crewed', () => {
    expect(orderNeedsSelfAuth([cmd, cofw], ['cmd', 'p2'])).toBe(false);
    expect(riskSlotNeedsSelfAuth([cmd, cofw], ['cmd', 'p2'], 'COMMANDER')).toBe(true);
    expect(riskSlotNeedsSelfAuth([cmd, cofw], ['cmd', 'p2'], 'CO_FLYING_WING')).toBe(false);
  });
  it('is needed for everything when Commander and CO Flying Wing fly together', () => {
    expect(orderNeedsSelfAuth([cmd, cofw], ['cmd', 'cofw'])).toBe(true);
    expect(selfAuthWarning([cmd, cofw], ['cmd', 'cofw'], [...both])).toMatch(/mission order/);
  });
  it('uses an acting GOO who is not crewed instead', () => {
    expect(orderNeedsSelfAuth([cmd, cofw, goo], ['cmd', 'cofw'])).toBe(false);
    expect(riskSlotNeedsSelfAuth([cmd, cofw, goo], ['cmd', 'cofw'], 'COMMANDER')).toBe(false);
    expect(riskSlotNeedsSelfAuth([cmd, cofw, goo], ['cmd', 'cofw'], 'CO_FLYING_WING')).toBe(true);
  });
});

describe('Engineering Officer', () => {
  it('can update aircraft and snags but not confirm daily serviceability', () => {
    const eo = permissionsFor(rolesFor({ appointment: 'ENGINEERING_OFFICER', flightStatus: 'NONE' }, { actingCommander: false }));
    expect(eo.has('aircraft.update')).toBe(true);
    expect(eo.has('snag.close')).toBe(true);
    expect(eo.has('serviceability.confirm')).toBe(false);
    const co = permissionsFor(rolesFor({ appointment: 'CO_ENGINEERING', flightStatus: 'NONE' }, { actingCommander: false }));
    expect(co.has('serviceability.confirm')).toBe(true);
  });
});
