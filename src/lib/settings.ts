import { z } from 'zod';
import { db } from './db';

// Platform settings, editable by Admin. Each key has a schema and a default.

// Risk assessments are approved by the Commander (or the GOO while acting) and CO Flying Wing only.
const approverRole = z.enum(['COMMANDER', 'CO_FLYING_WING']);

export const settingSchemas = {
  requiredApprovers: z.array(approverRole).min(1),
  riskThresholds: z.object({
    lowMax: z.number().int().min(8).max(40),
    mediumMax: z.number().int().min(8).max(40),
    softImsafePoints: z.number().int().min(0).max(10),
  }),
  reminders: z.object({
    readinessMinutes: z.number().int().min(15).max(240),
    noResponseMinutes: z.number().int().min(5).max(240),
    riskMinutes: z.number().int().min(5).max(240),
  }),
  // Minima used to pre-rate weather on the risk form. Day defaults follow ICAO Annex 2 VFR at a
  // controlled aerodrome (ceiling 1 500 ft, ground visibility 5 km). Night values start equal to
  // day values; Admin should set them to the national night VFR rules in Settings.
  vmcMinima: z.object({
    visibilityM: z.number().int().min(0),
    ceilingFt: z.number().int().min(0),
    nightVisibilityM: z.number().int().min(0),
    nightCeilingFt: z.number().int().min(0),
  }),
  fuelDensityKgPerL: z.number().min(0.6).max(1),
  inspectionWarning: z.object({ hours: z.number().min(0), days: z.number().int().min(0) }),
  summarySchedule: z.object({
    dailyTime: z.string().regex(/^\d{2}:\d{2}$/),
    weeklyDay: z.number().int().min(0).max(6), // 0 = Sunday
  }),
  unit: z.object({
    name: z.string().trim().min(2).max(120), // e.g. Demo Helicopter Squadron
    short: z.string().trim().min(2).max(30), // e.g. DHS
    location: z.string().trim().min(2).max(60), // e.g. Demo Base
  }),
  // Home aerodrome: an ICAO-coded aerodrome, or an NCAA-registered helipad/airstrip without an ICAO code
  homeAerodrome: z.object({
    icao: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{4}$/, 'Use a 4-character ICAO code.')
      .nullable(),
    name: z.string().trim().min(2).max(120),
  }),
} as const;

export type SettingKey = keyof typeof settingSchemas;
export type Settings = { [K in SettingKey]: z.infer<(typeof settingSchemas)[K]> };

export const DEFAULT_SETTINGS: Settings = {
  requiredApprovers: ['CO_FLYING_WING', 'COMMANDER'],
  riskThresholds: { lowMax: 16, mediumMax: 26, softImsafePoints: 2 },
  reminders: { readinessMinutes: 60, noResponseMinutes: 45, riskMinutes: 30 },
  vmcMinima: { visibilityM: 5000, ceilingFt: 1500, nightVisibilityM: 5000, nightCeilingFt: 1500 },
  fuelDensityKgPerL: 0.8,
  inspectionWarning: { hours: 10, days: 7 },
  summarySchedule: { dailyTime: '21:00', weeklyDay: 0 },
  unit: { name: 'Demo Helicopter Squadron', short: 'DHS', location: 'Demo Base' },
  homeAerodrome: { icao: 'DNAA', name: 'Nnamdi Azikiwe International Airport' },
};

export async function getSettings(): Promise<Settings> {
  const rows = await db.setting.findMany();
  const out: Settings = structuredClone(DEFAULT_SETTINGS);
  for (const row of rows) {
    const key = row.key as SettingKey;
    if (!(key in settingSchemas)) continue;
    const parsed = settingSchemas[key].safeParse(row.value);
    if (parsed.success) (out as Record<string, unknown>)[key] = parsed.data;
  }
  return out;
}

export async function setSetting<K extends SettingKey>(key: K, value: Settings[K]) {
  const parsed = settingSchemas[key].parse(value);
  await db.setting.upsert({
    where: { key },
    create: { key, value: parsed as object },
    update: { value: parsed as object },
  });
}
