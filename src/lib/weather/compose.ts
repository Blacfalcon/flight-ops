// Builds METAR / TAF code from the simple weather form, so whoever enters the weather does not
// need to write the code by hand. The code is what gets stored; the parser reads it back.

export type CloudRow = { cover: '' | 'FEW' | 'SCT' | 'BKN' | 'OVC' | 'VV'; baseFt: string; type: '' | 'CB' | 'TCU' };

export type WxForm = {
  station: string;
  day: string; // 2 digits, UTC day of month
  time: string; // HHMM UTC
  // TAF validity
  fromDay: string;
  fromHour: string;
  toDay: string;
  toHour: string;
  windCalm: boolean;
  windVrb: boolean;
  windDir: string;
  windSpeed: string;
  gust: string;
  cavok: boolean;
  visibilityM: string;
  weather: string[]; // codes such as "-RA", "TSRA", "BR"
  clouds: CloudRow[];
  nsc: boolean;
  temp: string;
  dew: string;
  qnh: string;
  changeGroups: string;
};

export const WEATHER_OPTIONS = ['-RA', 'RA', '+RA', '-SHRA', 'SHRA', '+SHRA', 'TS', 'TSRA', '+TSRA', 'VCTS', 'VCSH', '-DZ', 'DZ', 'BR', 'FG', 'BCFG', 'MIFG', 'HZ', 'DU', 'SA', 'FU', 'SQ', 'NSW'];

const pad = (v: string | number, n: number) => String(v).padStart(n, '0');
const int = (v: string) => (/^-?\d+$/.test(v.trim()) ? Number(v.trim()) : NaN);

export function blankForm(station: string, now: Date = new Date()): WxForm {
  const d = new Date(now);
  d.setUTCMinutes(d.getUTCMinutes() < 30 ? 0 : 30, 0, 0);
  const to = new Date(d.getTime() + 24 * 3600_000);
  return {
    station,
    day: pad(d.getUTCDate(), 2),
    time: `${pad(d.getUTCHours(), 2)}${pad(d.getUTCMinutes(), 2)}`,
    fromDay: pad(d.getUTCDate(), 2),
    fromHour: pad(d.getUTCHours(), 2),
    toDay: pad(to.getUTCDate(), 2),
    toHour: pad(to.getUTCHours(), 2),
    windCalm: false,
    windVrb: false,
    windDir: '',
    windSpeed: '',
    gust: '',
    cavok: false,
    visibilityM: '',
    weather: [],
    clouds: [{ cover: '', baseFt: '', type: '' }],
    nsc: false,
    temp: '',
    dew: '',
    qnh: '',
    changeGroups: '',
  };
}

function windGroup(f: WxForm, errors: Record<string, string>): string | null {
  if (f.windCalm) return '00000KT';
  const spd = int(f.windSpeed);
  if (Number.isNaN(spd) || spd < 0 || spd > 199) {
    errors.windSpeed = 'Wind speed in knots.';
    return null;
  }
  let dir = 'VRB';
  if (!f.windVrb) {
    const d = int(f.windDir);
    if (Number.isNaN(d) || d < 0 || d > 360 || d % 10 !== 0) {
      errors.windDir = 'Direction in degrees, to the nearest 10 (e.g. 240).';
      return null;
    }
    dir = pad(d === 0 ? 360 : d, 3);
  }
  let g = '';
  if (f.gust.trim()) {
    const gs = int(f.gust);
    if (Number.isNaN(gs) || gs <= spd) {
      errors.gust = 'Gust must be higher than the wind speed.';
      return null;
    }
    g = `G${pad(gs, 2)}`;
  }
  return `${dir}${pad(spd, 2)}${g}KT`;
}

function visibilityGroup(f: WxForm, errors: Record<string, string>): string | null {
  if (f.cavok) return 'CAVOK';
  const v = int(f.visibilityM);
  if (Number.isNaN(v) || v < 0) {
    errors.visibilityM = 'Visibility in metres (9999 = 10 km or more), or tick CAVOK.';
    return null;
  }
  return v >= 10_000 ? '9999' : pad(v, 4);
}

function cloudGroups(f: WxForm, errors: Record<string, string>): string[] {
  if (f.cavok) return [];
  if (f.nsc) return ['NSC'];
  const out: string[] = [];
  f.clouds.forEach((c, i) => {
    if (!c.cover) return;
    const base = int(c.baseFt);
    if (Number.isNaN(base) || base < 0 || base > 60_000) {
      errors[`cloud${i}`] = 'Cloud base in feet (e.g. 1800).';
      return;
    }
    out.push(`${c.cover}${pad(Math.round(base / 100), 3)}${c.type}`);
  });
  return out;
}

function temp(n: number) {
  return n < 0 ? `M${pad(-n, 2)}` : pad(n, 2);
}

function header(f: WxForm, errors: Record<string, string>): string | null {
  if (!/^[A-Z][A-Z0-9]{3}$/.test(f.station.trim().toUpperCase())) errors.station = 'Four-character ICAO code, e.g. DNAA.';
  if (!/^(0[1-9]|[12]\d|3[01])$/.test(f.day)) errors.day = 'Day of the month (UTC), 01–31.';
  if (!/^([01]\d|2[0-3])[0-5]\d$/.test(f.time)) errors.time = 'Time in UTC as HHMM, e.g. 1400.';
  if (errors.station || errors.day || errors.time) return null;
  return `${f.station.trim().toUpperCase()} ${f.day}${f.time}Z`;
}

export function composeMetar(f: WxForm): { code: string; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const parts: Array<string | null> = [header(f, errors), windGroup(f, errors), visibilityGroup(f, errors)];
  if (!f.cavok) parts.push(...f.weather.filter(Boolean));
  parts.push(...cloudGroups(f, errors));
  const t = int(f.temp);
  const d = int(f.dew);
  if (Number.isNaN(t)) errors.temp = 'Temperature in °C.';
  else if (Number.isNaN(d)) errors.dew = 'Dew point in °C.';
  else if (d > t) errors.dew = 'Dew point cannot be above the temperature.';
  else parts.push(`${temp(t)}/${temp(d)}`);
  const q = int(f.qnh);
  if (Number.isNaN(q) || q < 900 || q > 1100) errors.qnh = 'QNH in hPa, e.g. 1011.';
  else parts.push(`Q${q}`);
  return { code: `METAR ${parts.filter(Boolean).join(' ')}=`, errors };
}

export function composeTaf(f: WxForm): { code: string; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const dd = /^(0[1-9]|[12]\d|3[01])$/;
  const hh = /^([01]\d|2[0-4])$/;
  if (!dd.test(f.fromDay) || !hh.test(f.fromHour) || !dd.test(f.toDay) || !hh.test(f.toHour)) errors.validity = 'Validity as day and hour (UTC), e.g. 19 12 to 20 12.';
  const parts: Array<string | null> = [header(f, errors), errors.validity ? null : `${f.fromDay}${f.fromHour}/${f.toDay}${f.toHour}`, windGroup(f, errors), visibilityGroup(f, errors)];
  if (!f.cavok) parts.push(...f.weather.filter(Boolean));
  parts.push(...cloudGroups(f, errors));
  const change = f.changeGroups.trim().toUpperCase().replace(/\s+/g, ' ');
  if (change) parts.push(change);
  return { code: `TAF ${parts.filter(Boolean).join(' ')}=`, errors };
}
