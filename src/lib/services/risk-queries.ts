import type { Prisma } from '@prisma/client';
import { db } from '../db';
import { nameOnly } from '../selects';

export const riskDetailInclude = {
  mission: { include: { aircraft: { select: { registration: true, type: true } }, crew: { include: { user: { select: nameOnly } } } } },
  submittedBy: { select: nameOnly },
  imsafe: { include: { user: { select: nameOnly } } },
  approvals: { include: { approver: { select: nameOnly } } },
} satisfies Prisma.RiskAssessmentInclude;

export async function loadRisk(id: string) {
  const ra = await db.riskAssessment.findUnique({ where: { id }, include: riskDetailInclude });
  if (!ra) return null;
  const comments = await db.comment.findMany({
    where: { entityType: 'risk_assessment', entityId: id },
    include: { author: { select: nameOnly } },
    orderBy: { createdAt: 'asc' },
  });
  return { ...ra, comments };
}
export type RiskDetail = NonNullable<Awaited<ReturnType<typeof loadRisk>>>;

export async function listRisk(status?: string) {
  return db.riskAssessment.findMany({
    where: status ? { status: status as never } : {},
    include: riskDetailInclude,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  });
}
