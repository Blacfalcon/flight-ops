import type { Prisma } from '@prisma/client';
import { db } from '../db';
import { nameOnly } from '../selects';
import { localDayBounds, localToUtc } from '../time';
import type { MissionInput } from './missions';
import type { z } from 'zod';
import type { missionSchema } from '../validators';

export const missionListInclude = {
  aircraft: { select: { id: true, registration: true, type: true, status: true } },
  crew: { include: { user: { select: nameOnly } }, orderBy: { seat: 'asc' } },
  riskAssessments: { orderBy: { version: 'desc' }, take: 1, include: { approvals: true } },
  report: { select: { outcome: true, flightTimeMin: true } },
  flightPlans: { select: { id: true, status: true }, orderBy: { createdAt: 'desc' }, take: 1 },
  order: { select: { id: true, orderNo: true, status: true } },
} satisfies Prisma.MissionInclude;

export type MissionListItem = Prisma.MissionGetPayload<{ include: typeof missionListInclude }>;

export async function listMissions(opts: { date?: string; from?: string; to?: string; userId?: string; includeDrafts: boolean }) {
  const where: Prisma.MissionWhereInput = {};
  if (opts.date) {
    const { start, end } = localDayBounds(opts.date);
    where.takeoffAt = { gte: start, lt: end };
  } else if (opts.from || opts.to) {
    where.takeoffAt = {
      ...(opts.from ? { gte: localDayBounds(opts.from).start } : {}),
      ...(opts.to ? { lt: localDayBounds(opts.to).end } : {}),
    };
  }
  if (opts.userId) where.crew = { some: { userId: opts.userId } };
  if (!opts.includeDrafts) where.status = { notIn: ['DRAFT', 'AWAITING_ENGINEERING'] };
  return db.mission.findMany({ where, include: missionListInclude, orderBy: { takeoffAt: 'asc' }, take: 500 });
}

export async function loadMissionDetail(id: string) {
  return db.mission.findUnique({
    where: { id },
    include: {
      aircraft: true,
      crew: { include: { user: { select: nameOnly } } },
      riskAssessments: {
        orderBy: { version: 'desc' },
        include: {
          approvals: { include: { approver: { select: nameOnly } } },
          imsafe: { include: { user: { select: nameOnly } } },
          submittedBy: { select: nameOnly },
        },
      },
      flightPlans: { orderBy: { createdAt: 'desc' }, include: { submittedBy: { select: nameOnly }, approvedBy: { select: nameOnly } } },
      order: { include: { decidedBy: { select: nameOnly }, createdBy: { select: nameOnly } } },
      report: { include: { snags: true, submittedBy: { select: nameOnly } } },
      createdBy: { select: nameOnly },
    },
  });
}
export type MissionDetail = NonNullable<Awaited<ReturnType<typeof loadMissionDetail>>>;

export function toMissionInput(body: z.infer<typeof missionSchema>): MissionInput {
  return {
    date: body.date,
    name: body.name,
    category: body.category,
    type: body.type,
    aircraftId: body.aircraftId,
    briefingAt: localToUtc(body.date, body.briefingTime),
    takeoffAt: localToUtc(body.date, body.takeoffTime),
    landingAt: localToUtc(body.date, body.landingTime),
    crew: body.crew,
    order: { ...body.order, operationalRemarks: body.order.operationalRemarks || null },
  };
}
