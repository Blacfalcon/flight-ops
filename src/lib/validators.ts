import { z } from 'zod';
import { AIRCRAFT_STATUSES, APPOINTMENTS, FLIGHT_STATUSES, MISSION_CATEGORIES, PILOT_CATEGORIES, RANKS, SEATS, isMissionType } from './constants';

// Request schemas shared by API routes and (where useful) client forms.

const trimmed = (max = 200) => z.string().trim().min(1, 'Required.').max(max);
const optionalName = z.string().trim().max(60).optional().transform((s) => s || null);
export const localDateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.');
export const localTimeStr = z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM.');
export const uuid = z.string().uuid();

export const registerSchema = z
  .object({
    rank: z.enum(RANKS),
    firstName: trimmed(60),
    middleName: optionalName,
    surname: trimmed(60),
    nafNumber: trimmed(30).transform((s) => s.toUpperCase()),
    email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
    phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, 'Enter a valid phone number.'),
    appointment: z.enum(APPOINTMENTS),
    flightStatus: z.enum(FLIGHT_STATUSES),
    pilotCategory: z.enum(PILOT_CATEGORIES),
    password: z.string().min(10, 'Use at least 10 characters.').max(200),
    photo: z.string().max(400_000).optional(), // optional data URL, resized in the browser
    accept: z.literal(true, { errorMap: () => ({ message: 'You must accept the privacy policy and conditions of use, and be 18 or over.' }) }),
  })
  .refine((v) => v.flightStatus !== 'NONE' || v.pilotCategory === 'NIL', { path: ['pilotCategory'], message: 'Choose Nil if you are not a pilot.' });

export const loginSchema = z.object({ identifier: trimmed(200), password: z.string().min(1).max(200) });
export const totpLoginSchema = z.object({ challenge: z.string().min(10), code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.') });
export const tokenSchema = z.object({ token: z.string().min(10) });
export const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email() });
export const resetSchema = z.object({ token: z.string().min(10), password: z.string().min(10).max(200) });
export const changePasswordSchema = z.object({ current: z.string().min(1), next: z.string().min(10).max(200) });
export const photoSchema = z.object({ dataUrl: z.string().max(400_000) });
export const codeSchema = z.object({ code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.') });

export const meUpdateSchema = z.object({
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/).optional(),
  emailAlerts: z.enum(['URGENT', 'ALL', 'NONE']).optional(),
  requestChange: z
    .object({
      field: z.enum(['rank', 'appointment', 'flightStatus', 'pilotCategory']),
      value: z.string(),
      reason: z.string().trim().max(500).optional(),
    })
    .optional(),
});

export const userAdminUpdateSchema = z.object({
  rank: z.enum(RANKS).optional(),
  firstName: trimmed(60).optional(),
  middleName: optionalName,
  surname: trimmed(60).optional(),
  nafNumber: trimmed(30).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/).optional(),
  appointment: z.enum(APPOINTMENTS).optional(),
  flightStatus: z.enum(FLIGHT_STATUSES).optional(),
  pilotCategory: z.enum(PILOT_CATEGORIES).optional(),
  accountStatus: z.enum(['PENDING_ACTIVATION', 'ACTIVE', 'SUSPENDED']).optional(),
});

export const decideRequestSchema = z.object({ approve: z.boolean() });

export const delegationSchema = z.object({
  toUserId: uuid,
  fromUserId: uuid,
  startDate: localDateStr,
  startTime: localTimeStr,
  endDate: localDateStr,
  endTime: localTimeStr,
});

export const aircraftCreateSchema = z.object({
  registration: trimmed(20),
  type: trimmed(60),
  status: z.enum(AIRCRAFT_STATUSES).default('SERVICEABLE'),
  flyingHours: z.number().min(0).max(100_000),
  hoursToNextInspection: z.number().min(0).max(10_000),
  inspectionIntervalHours: z.number().min(1).max(10_000),
  inspectionIntervalDays: z.number().int().min(1).max(3650).nullable().optional(),
  lastInspectionDate: localDateStr.nullable().optional(),
  nextInspectionDue: localDateStr.nullable().optional(),
  maintenanceRemarks: z.string().trim().max(1000).nullable().optional(),
});

export const aircraftUpdateSchema = aircraftCreateSchema.partial().extend({ active: z.boolean().optional() });

export const serviceabilitySchema = z.object({
  entries: z
    .array(
      z.object({
        aircraftId: uuid,
        status: z.enum(AIRCRAFT_STATUSES),
        remarks: z.string().trim().max(500).optional(),
        hoursToNextInspection: z.number().min(0).max(10_000).optional(),
      }),
    )
    .min(1),
});

export const orderFieldsSchema = z.object({
  taskDescription: trimmed(4000),
  objectives: trimmed(4000),
  priority: z.enum(['ROUTINE', 'PRIORITY', 'IMMEDIATE']),
  operationalRemarks: z.string().trim().max(4000).optional(),
});

// Scheduling a sortie and raising its mission order are one step: every sortie has an order.
export const missionSchema = z
  .object({
    date: localDateStr,
    category: z.enum(MISSION_CATEGORIES),
    type: z.string().trim().min(2).max(40),
    name: trimmed(120),
    aircraftId: uuid,
    briefingTime: localTimeStr,
    takeoffTime: localTimeStr,
    landingTime: localTimeStr,
    crew: z.array(z.object({ seat: z.enum(SEATS), userId: uuid })).max(4),
    order: orderFieldsSchema,
  })
  .refine((v) => isMissionType(v.category, v.type), { path: ['type'], message: 'Choose a mission type from the list for this category.' });

export const publishSchema = z.object({ ids: z.array(uuid).min(1).max(100) });
export const cancelSchema = z.object({ reason: trimmed(500) });
export const readinessSchema = z.object({ ready: z.boolean(), reason: z.string().trim().max(500).optional() });

export const imsafeSchema = z.object({
  illness: z.boolean(),
  medication: z.boolean(),
  stress: z.boolean(),
  alcohol: z.boolean(),
  fatigue: z.boolean(),
  eating: z.boolean(),
  notes: z.string().trim().max(500).optional(),
});

const rating = z.number().int().min(1).max(5);
export const riskSubmitSchema = z.object({
  ratings: z.object({
    weather: rating,
    aircraftCondition: rating,
    crewReadiness: rating,
    missionComplexity: rating,
    fuelStatus: rating,
    terrain: rating,
    fatigue: rating,
    operationalThreats: rating,
  }),
  imsafe: imsafeSchema,
  weatherLoweredReason: z.string().trim().max(500).optional(),
  mitigations: z.string().trim().max(2000).optional(),
});

export const decisionSchema = z.object({
  role: z.enum(['COMMANDER', 'CO_FLYING_WING', 'CO_ENGINEERING', 'OPERATIONS_OFFICER']),
  decision: z.enum(['APPROVE', 'APPROVE_WITH_REMARKS', 'REJECT']),
  remarks: z.string().trim().max(2000).optional(),
});

export const commentSchema = z.object({ body: trimmed(2000) });

export const flightPlanSchema = z.object({
  missionId: uuid.nullable().optional(),
  departure: trimmed(60),
  destination: trimmed(60),
  route: trimmed(1000),
  alternate: trimmed(60),
  estFlightTimeMin: z.number().int().min(1).max(24 * 60),
  fuelRequired: z.number().min(0).max(100_000),
  fuelUnit: z.enum(['kg', 'l']),
  crewNotes: z.string().trim().max(1000).optional(),
  submit: z.boolean().optional(),
});

export const missionReportSchema = z.object({
  outcome: z.enum(['COMPLETED', 'ABORTED']),
  flightTimeMin: z.number().int().min(0).max(24 * 60),
  fuelUsed: z.number().min(0).max(100_000),
  fuelUnit: z.enum(['kg', 'l']),
  snags: z.array(z.string().trim().max(500)).max(20).default([]),
  remarks: trimmed(2000),
  missionOutcome: z.string().trim().max(2000).optional(),
  abortReason: z.string().trim().max(1000).optional(),
});

export const orderDecisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  remarks: z.string().trim().max(2000).optional(),
});

export const weatherSchema = z.object({ kind: z.enum(['METAR', 'TAF']), raw: z.string().trim().min(10).max(2000) });

export const snagSchema = z.object({ aircraftId: uuid, description: trimmed(500) });
export const closeSnagSchema = z.object({ actionTaken: trimmed(1000) });

export const safetyReportSchema = z.object({
  kind: z.enum(['HAZARD', 'INCIDENT']),
  description: trimmed(4000),
  location: z.string().trim().max(200).optional(),
  aircraftId: uuid.nullable().optional(),
  missionId: uuid.nullable().optional(),
});
export const safetyStatusSchema = z.object({ status: z.enum(['OPEN', 'UNDER_REVIEW', 'CLOSED']) });

export const generateReportSchema = z.object({ period: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY']), anchor: localDateStr });

export const syncSchema = z.object({
  ops: z
    .array(
      z.object({
        clientOpId: z.string().min(8).max(100),
        type: z.enum(['readiness', 'risk.submit', 'imsafe', 'flightplan.save', 'report.submit', 'snag.raise', 'safety.raise']),
        target: z.string().optional(), // mission or risk assessment id
        payload: z.unknown(),
        createdAt: z.string(),
      }),
    )
    .max(50),
});
