// Turns METAR / TAF groups into plain English for crews who are not reading the code every day.
import { ceilingOf, readConditions, type Cloud, type Conditions } from './metar';

const COVER: Record<string, string> = {
  FEW: 'Few clouds',
  SCT: 'Scattered cloud',
  BKN: 'Broken cloud',
  OVC: 'Overcast',
  VV: 'Sky obscured, vertical visibility',
};
const CLOUD_TYPE: Record<string, string> = { CB: 'cumulonimbus (thunderstorm cloud)', TCU: 'towering cumulus' };
const NO_CLOUD: Record<string, string> = {
  NSC: 'No significant cloud',
  NCD: 'No cloud detected',
  SKC: 'Sky clear',
  CLR: 'No cloud below 12,000 ft',
};

const DESCRIPTOR: Record<string, string> = {
  MI: 'shallow',
  PR: 'partial',
  BC: 'patches of',
  DR: 'low drifting',
  BL: 'blowing',
  SH: 'showers of',
  TS: 'thunderstorm with',
  FZ: 'freezing',
};
const PHENOMENON: Record<string, string> = {
  DZ: 'drizzle',
  RA: 'rain',
  SN: 'snow',
  SG: 'snow grains',
  PL: 'ice pellets',
  GR: 'hail',
  GS: 'small hail',
  UP: 'unknown precipitation',
  IC: 'ice crystals',
  BR: 'mist',
  FG: 'fog',
  FU: 'smoke',
  VA: 'volcanic ash',
  DU: 'widespread dust',
  SA: 'sand',
  HZ: 'haze',
  PO: 'dust or sand whirls',
  SQ: 'squalls',
  FC: 'funnel cloud',
  SS: 'sandstorm',
  DS: 'duststorm',
};

/** "-SHRA" → "Light showers of rain". */
export function describePhenomenon(code: string): string {
  if (code === 'NSW') return 'No significant weather';
  if (code === 'VCSH') return 'Showers in the vicinity';
  let c = code;
  let intensity = '';
  let vicinity = false;
  if (c.startsWith('+')) {
    intensity = 'Heavy';
    c = c.slice(1);
  } else if (c.startsWith('-')) {
    intensity = 'Light';
    c = c.slice(1);
  } else if (c.startsWith('VC')) {
    vicinity = true;
    c = c.slice(2);
  }
  if (c === 'TS') return `${intensity ? `${intensity} t` : 'T'}hunderstorm${vicinity ? ' in the vicinity' : ''}`;
  const words: string[] = [];
  const d = c.slice(0, 2);
  if (DESCRIPTOR[d] && c.length > 2) {
    words.push(DESCRIPTOR[d]);
    c = c.slice(2);
  }
  const parts: string[] = [];
  for (let i = 0; i < c.length; i += 2) parts.push(PHENOMENON[c.slice(i, i + 2)] ?? c.slice(i, i + 2));
  words.push(parts.join(' and '));
  let text = words.join(' ');
  if (intensity) text = `${intensity} ${text}`;
  if (vicinity) text += ' in the vicinity';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const ft = (n: number) => `${n.toLocaleString('en-GB')} ft`;

export function describeCloud(c: Cloud): string {
  const base = c.baseFt == null ? 'height not reported' : ft(c.baseFt);
  return `${COVER[c.cover] ?? c.cover} at ${base}${c.type ? `, ${CLOUD_TYPE[c.type] ?? c.type}` : ''}`;
}

function describeVisibility(m: number): string {
  if (m >= 10_000) return 'Visibility 10 km or more';
  if (m >= 5000) return `Visibility ${(m / 1000).toLocaleString('en-GB')} km`;
  return `Visibility ${m.toLocaleString('en-GB')} m`;
}

function describeWind(c: Conditions): string | null {
  if (c.windSpeedKt == null) return null;
  if (c.windSpeedKt === 0) return 'Wind calm';
  const from = c.windVariable ? 'Wind variable in direction' : `Wind from ${String(c.windDir).padStart(3, '0')}°`;
  let s = `${from} at ${c.windSpeedKt} knots`;
  if (c.gustKt) s += `, gusting ${c.gustKt} knots`;
  if (c.windVaryFrom != null && c.windVaryTo != null) s += ` (direction varying ${String(c.windVaryFrom).padStart(3, '0')}°–${String(c.windVaryTo).padStart(3, '0')}°)`;
  return s;
}

/** One short sentence per element, in reading order. */
export function describeConditions(c: Conditions, opts: { includeTemps?: boolean } = {}): string[] {
  const out: string[] = [];
  const wind = describeWind(c);
  if (wind) out.push(wind);
  if (c.cavok) {
    out.push('CAVOK: visibility 10 km or more, no cloud below 5,000 ft or below the highest minimum sector altitude, no cumulonimbus or towering cumulus, and no significant weather');
  } else {
    if (c.visibilityM != null) out.push(describeVisibility(c.visibilityM));
    for (const p of c.phenomena) out.push(describePhenomenon(p));
    if (c.clouds.length) {
      for (const cl of c.clouds) out.push(describeCloud(cl));
      const ceiling = ceilingOf(c.clouds);
      out.push(ceiling == null ? 'No ceiling (no broken or overcast layer)' : `Ceiling ${ft(ceiling)}`);
    } else if (c.noCloud) {
      out.push(NO_CLOUD[c.noCloud] ?? c.noCloud);
    }
  }
  if (opts.includeTemps !== false) {
    if (c.temperatureC != null) out.push(`Temperature ${c.temperatureC}°C${c.dewpointC != null ? `, dew point ${c.dewpointC}°C` : ''}`);
    if (c.qnhHpa != null) out.push(`QNH ${c.qnhHpa} hPa`);
  }
  return out;
}

function zDayHour(group: string): string {
  // "1520" → "20:00Z on the 15th"; "152030" (FM) → "20:30Z on the 15th"
  const day = Number(group.slice(0, 2));
  const hh = group.slice(2, 4);
  const mm = group.length >= 6 ? group.slice(4, 6) : '00';
  const sfx = day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th';
  return `${hh}:${mm}Z on the ${day}${sfx}`;
}

/** TAF change groups ("TEMPO 1520/1524 4000 TSRA BKN012CB BECMG ...") as plain-English lines. */
export function describeChangeGroups(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  const tokens = text.trim().toUpperCase().split(/\s+/);
  const groups: string[][] = [];
  for (const t of tokens) {
    const starts = t === 'TEMPO' || t === 'BECMG' || /^PROB\d{2}$/.test(t) || /^FM\d{6}$/.test(t);
    // "PROB30 TEMPO" is a single group
    if (starts && !(t === 'TEMPO' && groups.length && /^PROB\d{2}$/.test(groups[groups.length - 1].at(-1) ?? ''))) groups.push([t]);
    else if (groups.length) groups[groups.length - 1].push(t);
  }
  return groups.map((g) => {
    let i = 0;
    const head: string[] = [];
    if (/^PROB\d{2}$/.test(g[i])) {
      head.push(`${g[i].slice(4)}% chance,`);
      i++;
    }
    if (g[i] === 'TEMPO') {
      head.push(head.length ? 'temporarily' : 'Temporarily');
      i++;
    } else if (g[i] === 'BECMG') {
      head.push('Becoming');
      i++;
    } else if (g[i]?.startsWith('FM')) {
      head.push(`From ${zDayHour(g[i].slice(2))}`);
      i++;
    }
    const period = g[i]?.match(/^(\d{4})\/(\d{4})$/);
    if (period) {
      head.push(`between ${zDayHour(period[1])} and ${zDayHour(period[2])}`);
      i++;
    }
    const body = describeConditions(readConditions(g.slice(i)), { includeTemps: false });
    let lead = head.join(' ').replace(/,$/, '');
    lead = lead.charAt(0).toUpperCase() + lead.slice(1);
    return `${lead}: ${body.length ? body.join('; ') : 'see code'}.`;
  });
}
