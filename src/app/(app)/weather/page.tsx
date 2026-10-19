import { requirePage } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { nameOnly } from '@/lib/selects';
import { personName } from '@/lib/constants';
import { formatDateTime } from '@/lib/time';
import { Card, PageHeader } from '@/components/ui';
import { PlainWeather, RawReport, WeatherTiles } from '@/components/weather-panel';
import { WeatherEntry } from '@/components/weather-entry';
import { getSettings } from '@/lib/settings';

export const metadata = { title: 'Weather' };

export default async function WeatherPage() {
  const auth = await requirePage('weather.view');
  const [metar, taf, history, settings] = await Promise.all([
    db.weatherReport.findFirst({ where: { kind: 'METAR' }, orderBy: { createdAt: 'desc' }, include: { enteredBy: { select: nameOnly } } }),
    db.weatherReport.findFirst({ where: { kind: 'TAF' }, orderBy: { createdAt: 'desc' }, include: { enteredBy: { select: nameOnly } } }),
    db.weatherReport.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
    getSettings(),
  ]);
  return (
    <>
      <PageHeader title={`Weather${metar ? ` · ${metar.station}` : ''}`} sub={metar ? `METAR entered by ${personName(metar.enteredBy)} · ${formatDateTime(metar.createdAt)}` : 'No reports yet.'} />
      <div className="flex flex-wrap items-start gap-6">
        <Card className="min-w-0 flex-[1_1_380px]" title="Current conditions">
          <div className="flex flex-col gap-4">
            <WeatherTiles metar={metar} />
            <PlainWeather report={metar} />
            <RawReport label="METAR" text={metar?.rawText} />
            <PlainWeather report={taf} />
            <RawReport label="TAF" text={taf?.rawText} />
          </div>
        </Card>
        {auth.perms.has('weather.update') && (
          <Card className="min-w-0 flex-[1_1_380px]" title="Update">
            <WeatherEntry station={settings.homeAerodrome.icao ?? ''} />
          </Card>
        )}
      </div>
      <Card title="Recent reports" bodyClass="">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Entered</th>
                <th>Kind</th>
                <th>Report</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="whitespace-nowrap">{formatDateTime(h.createdAt)}</td>
                  <td>{h.kind}</td>
                  <td className="font-mono text-[12px]">{h.rawText}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
