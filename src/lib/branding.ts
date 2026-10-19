import 'server-only';
import { db } from './db';
import { DEFAULT_SETTINGS, getSettings, type Settings } from './settings';

// Unit name, home aerodrome and images, as set by Admin in Settings. Every unit runs its own copy
// of the system, so nothing about the unit is hard-coded.

export type Branding = {
  unit: Settings['unit'];
  home: Settings['homeAerodrome'];
  /** Cache-busting versions for /api/branding/logo and /api/branding/watermark */
  logoVersion: number;
  watermarkVersion: number;
};

export async function getBranding(): Promise<Branding> {
  try {
    const [s, assets] = await Promise.all([getSettings(), db.asset.findMany({ select: { key: true, updatedAt: true } })]);
    const v = (k: string) => assets.find((a) => a.key === k)?.updatedAt.getTime() ?? 0;
    return { unit: s.unit, home: s.homeAerodrome, logoVersion: v('logo'), watermarkVersion: v('watermark') };
  } catch {
    // Database not reachable (for example during a Docker image build): use the defaults
    return { unit: DEFAULT_SETTINGS.unit, home: DEFAULT_SETTINGS.homeAerodrome, logoVersion: 0, watermarkVersion: 0 };
  }
}

export const logoSrc = (b: Pick<Branding, 'logoVersion'>) => `/api/branding/logo?v=${b.logoVersion}`;
export const watermarkSrc = (b: Pick<Branding, 'watermarkVersion'>) => `/api/branding/watermark?v=${b.watermarkVersion}`;
