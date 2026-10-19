// Small METAR / TAF parser. It reads the common groups and keeps the raw text; anything it cannot
// read is left empty rather than guessed. Pure, so it runs in the browser (form preview) and on the server.

export type Cloud = { cover: string; baseFt: number | null; type?: string };

export type Conditions = {
  windDir: number | null;
  windVariable: boolean;
  windSpeedKt: number | null;
  gustKt: number | null;
  windVaryFrom: number | null;
  windVaryTo: number | null;
  cavok: boolean;
  visibilityM: number | null;
  phenomena: string[]; // e.g. ["-RA", "BR"], or ["NSW"]
  clouds: Cloud[];
  noCloud: string | null; // NSC, NCD, SKC, CLR
  temperatureC: number | null;
  dewpointC: number | null;
  qnhHpa: number | null;
};

export type ParsedWeather = Conditions & {
  kind: 'METAR' | 'TAF';
  station: string | null;
  observedAt: Date | null;
  validFrom: Date | null;
  validTo: Date | null;
  ceilingFt: number | null;
  changeGroups: string | null; // TAF TEMPO / BECMG / FM / PROB groups, as written
};

const INTENSITY = '(?:\\+|-|VC)?';
const DESCRIPTOR = '(?:MI|PR|BC|DR|BL|SH|TS|FZ)?';
const PHENOMENON = '(?:DZ|RA|SN|SG|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PO|SQ|FC|SS|DS|IC)';
export const WX_RE = new RegExp(`^${INTENSITY}${DESCRIPTOR}(?:${PHENOMENON})+$|^${INTENSITY}TS$|^VCSH$|^NSW$`);

function dayTime(ref: Date, dd: number, hh: number, mm: number): Date {
  // Day-of-month groups refer to the current or previous month
  const d = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), dd, hh, mm));
  if (d.getTime() - ref.getTime() > 5 * 86_400_000) d.setUTCMonth(d.getUTCMonth() - 1);
  return d;
}

export function emptyConditions(): Conditions {
  return {
    windDir: null,
    windVariable: false,
    windSpeedKt: null,
    gustKt: null,
    windVaryFrom: null,
    windVaryTo: null,
    cavok: false,
    visibilityM: null,
    phenomena: [],
    clouds: [],
    noCloud: null,
    temperatureC: null,
    dewpointC: null,
    qnhHpa: null,
  };
}

/** Reads wind, visibility, weather, cloud, temperature and pressure groups from a list of tokens. */
export function readConditions(tokens: string[]): Conditions {
  const out = emptyConditions();
  for (const t of tokens) {
    let m: RegExpMatchArray | null;
    if ((m = t.match(/^(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?(KT|MPS)$/))) {
      const factor = m[4] === 'MPS' ? 1.94384 : 1;
      out.windVariable = m[1] === 'VRB';
      out.windDir = m[1] === 'VRB' ? null : +m[1];
      out.windSpeedKt = Math.round(+m[2] * factor);
      out.gustKt = m[3] ? Math.round(+m[3] * factor) : null;
    } else if ((m = t.match(/^(\d{3})V(\d{3})$/))) {
      out.windVaryFrom = +m[1];
      out.windVaryTo = +m[2];
    } else if (t === 'CAVOK') {
      out.cavok = true;
      out.visibilityM = 10_000;
    } else if ((m = t.match(/^(\d{4})(NDV)?$/)) && out.visibilityM === null) {
      out.visibilityM = +m[1] === 9999 ? 10_000 : +m[1];
    } else if ((m = t.match(/^(\d{1,2})SM$/))) {
      out.visibilityM = Math.round(+m[1] * 1609);
    } else if ((m = t.match(/^(FEW|SCT|BKN|OVC|VV)(\d{3}|\/\/\/)(CB|TCU)?$/))) {
      const baseFt = m[2] === '///' ? null : +m[2] * 100;
      out.clouds.push({ cover: m[1], baseFt, ...(m[3] ? { type: m[3] } : {}) });
    } else if (t === 'NSC' || t === 'NCD' || t === 'SKC' || t === 'CLR') {
      out.noCloud = t;
    } else if ((m = t.match(/^(M?\d{2})\/(M?\d{2})?$/))) {
      const n = (s: string) => (s.startsWith('M') ? -Number(s.slice(1)) : Number(s));
      out.temperatureC = n(m[1]);
      out.dewpointC = m[2] ? n(m[2]) : null;
    } else if ((m = t.match(/^Q(\d{4})$/))) {
      out.qnhHpa = +m[1];
    } else if ((m = t.match(/^A(\d{4})$/))) {
      out.qnhHpa = Math.round((+m[1] / 100) * 33.8639);
    } else if (WX_RE.test(t)) {
      out.phenomena.push(t);
    }
  }
  return out;
}

export function ceilingOf(clouds: Cloud[]): number | null {
  const layers = clouds.filter((c) => (c.cover === 'BKN' || c.cover === 'OVC' || c.cover === 'VV') && c.baseFt !== null);
  return layers.length ? Math.min(...layers.map((c) => c.baseFt as number)) : null;
}

const CHANGE_START = (t: string) => t === 'TEMPO' || t === 'BECMG' || /^PROB\d{2}$/.test(t) || /^FM\d{6}$/.test(t);

export function parseWeather(raw: string, kind: 'METAR' | 'TAF', now: Date = new Date()): ParsedWeather {
  const text = raw.trim().toUpperCase().replace(/\s+/g, ' ').replace(/=$/, '');
  let tokens = text.split(' ');
  if (tokens[0] === 'METAR' || tokens[0] === 'SPECI' || tokens[0] === 'TAF') tokens = tokens.slice(1);
  if (tokens[0] === 'AMD' || tokens[0] === 'COR') tokens = tokens.slice(1);

  // Remarks are not interpreted
  const rmk = tokens.indexOf('RMK');
  if (rmk > 0) tokens = tokens.slice(0, rmk);

  // A TAF's base forecast ends at the first change group; the rest is kept as written
  let changeGroups: string | null = null;
  if (kind === 'TAF') {
    const stopAt = tokens.findIndex((t, i) => i > 0 && CHANGE_START(t));
    if (stopAt > 0) {
      changeGroups = tokens.slice(stopAt).join(' ');
      tokens = tokens.slice(0, stopAt);
    }
  } else {
    // A METAR trend (NOSIG, TEMPO, BECMG) is not part of the observation
    const trend = tokens.findIndex((t, i) => i > 0 && (t === 'NOSIG' || t === 'TEMPO' || t === 'BECMG'));
    if (trend > 0) tokens = tokens.slice(0, trend);
  }

  let station: string | null = null;
  let observedAt: Date | null = null;
  let validFrom: Date | null = null;
  let validTo: Date | null = null;
  const rest: string[] = [];
  for (const t of tokens) {
    let m: RegExpMatchArray | null;
    if (!station && rest.length === 0 && /^[A-Z][A-Z0-9]{3}$/.test(t)) {
      station = t;
    } else if ((m = t.match(/^(\d{2})(\d{2})(\d{2})Z$/))) {
      observedAt = dayTime(now, +m[1], +m[2], +m[3]);
    } else if ((m = t.match(/^(\d{2})(\d{2})\/(\d{2})(\d{2})$/)) && kind === 'TAF' && !validFrom) {
      validFrom = dayTime(now, +m[1], +m[2] === 24 ? 0 : +m[2], 0);
      const to = dayTime(now, +m[3], +m[4] === 24 ? 0 : +m[4], 0);
      if (+m[4] === 24) to.setUTCDate(to.getUTCDate() + 1);
      if (to < validFrom) to.setUTCMonth(to.getUTCMonth() + 1);
      validTo = to;
    } else {
      rest.push(t);
    }
  }
  const c = readConditions(rest);
  return { kind, station, observedAt, validFrom, validTo, ...c, ceilingFt: ceilingOf(c.clouds), changeGroups };
}
