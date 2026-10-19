import { db } from '@/lib/db';
import { invalid, route } from '@/lib/api';
import { weatherSchema } from '@/lib/validators';
import { parseWeather } from '@/lib/weather/metar';
import { entryProblem } from '@/lib/weather/validity';
import { getSettings } from '@/lib/settings';
import { nameOnly } from '@/lib/selects';
import { audit } from '@/lib/audit';

export const GET = route({ perm: 'weather.view' }, async () => {
  const [metar, taf, history] = await Promise.all([
    db.weatherReport.findFirst({ where: { kind: 'METAR' }, orderBy: { createdAt: 'desc' }, include: { enteredBy: { select: nameOnly } } }),
    db.weatherReport.findFirst({ where: { kind: 'TAF' }, orderBy: { createdAt: 'desc' }, include: { enteredBy: { select: nameOnly } } }),
    db.weatherReport.findMany({ orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, kind: true, rawText: true, createdAt: true } }),
  ]);
  return { metar, taf, history };
});

export const POST = route({ perm: 'weather.update', schema: weatherSchema }, async ({ auth, body }) => {
  const parsed = parseWeather(body.raw, body.kind);
  const settings = await getSettings();
  if (!parsed.station) throw invalid('The report should start with the station code, for example DNAA.', { raw: 'Station code missing.' });
  const problem = entryProblem({ kind: body.kind, observedAt: parsed.observedAt, validFrom: parsed.validFrom, validTo: parsed.validTo });
  if (problem) throw invalid(problem, { raw: problem });
  const w = await db.weatherReport.create({
    data: {
      kind: body.kind,
      station: parsed.station ?? settings.homeAerodrome.icao ?? 'ZZZZ',
      rawText: body.raw.trim().toUpperCase(),
      windDir: parsed.windDir,
      windSpeedKt: parsed.windSpeedKt,
      gustKt: parsed.gustKt,
      visibilityM: parsed.visibilityM,
      temperatureC: parsed.temperatureC,
      dewpointC: parsed.dewpointC,
      qnhHpa: parsed.qnhHpa,
      clouds: parsed.clouds,
      phenomena: parsed.phenomena,
      changeGroups: parsed.changeGroups,
      ceilingFt: parsed.ceilingFt,
      observedAt: parsed.observedAt,
      validFrom: parsed.validFrom,
      validTo: parsed.validTo,
      enteredById: auth.user.id,
    },
  });
  await audit(auth.user.id, 'weather.update', 'weather_report', w.id, { after: { kind: w.kind, raw: w.rawText } });
  return w;
});
