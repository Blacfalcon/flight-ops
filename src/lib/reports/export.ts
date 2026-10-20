import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import type { SummaryFigures } from './summary';
import { missionTypeLabel } from '../constants';
import { formatShortDate } from '../time';
import { formatHours } from '../hours';

export type UnitLabel = { name: string; short: string; location: string };

const TITLE: Record<string, string> = { DAILY: 'Daily summary', WEEKLY: 'Weekly summary', MONTHLY: 'Monthly summary', QUARTERLY: 'Quarterly summary' };

function rangeLabel(f: SummaryFigures) {
  return f.start === f.end ? formatShortDate(f.start) : `${formatShortDate(f.start)} – ${formatShortDate(f.end)}`;
}

const pct = (n: number | null) => (n === null ? '—' : `${n}%`);

// ───────────────────────────── Excel ─────────────────────────────

export async function summaryToXlsx(f: SummaryFigures, unit: UnitLabel): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = `${unit.short} Flight Ops`;
  wb.created = new Date();

  const head = (ws: ExcelJS.Worksheet) => {
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B1F3A' } };
  };

  const s = wb.addWorksheet('Summary');
  s.columns = [{ header: 'Measure', key: 'k', width: 34 }, { header: 'Value', key: 'v', width: 22 }];
  head(s);
  s.addRows([
    { k: 'Report', v: `${TITLE[f.period]} · ${unit.name}, ${unit.location}` },
    { k: 'Period', v: rangeLabel(f) },
    { k: 'Total missions', v: f.totals.missions },
    { k: 'Completed', v: f.totals.completed },
    { k: 'Aborted', v: f.totals.aborted },
    { k: 'Cancelled', v: f.totals.cancelled },
    { k: 'Mission success rate', v: pct(f.totals.successRate) },
    { k: 'Flight hours (HH:MM)', v: formatHours(f.totals.flightHours) },
    { k: 'Flight hours (decimal)', v: f.totals.flightHours },
    { k: 'Fuel used (kg)', v: f.totals.fuelKg },
    { k: 'Fuel used (L)', v: f.totals.fuelL },
    { k: 'Open snags at generation', v: f.totals.openSnags },
    { k: 'Crew readiness rate', v: pct(f.personnel.readinessRate) },
    { k: 'Snags raised / closed', v: `${f.maintenance.snagsRaised} / ${f.maintenance.snagsClosed}` },
    { k: 'Average days to close a snag', v: f.maintenance.avgDaysToClose ?? '—' },
    { k: 'Risk assessments Low / Medium / High', v: `${f.safety.low} / ${f.safety.medium} / ${f.safety.high}` },
    { k: 'Risk assessments rejected', v: f.safety.rejected },
    { k: 'Hazard / incident reports', v: `${f.safety.hazards} / ${f.safety.incidents}` },
    { k: 'Sorties self-authorised by a crewed approver', v: f.safety.selfAuthorised ?? 0 },
  ]);

  const d = wb.addWorksheet('By day');
  d.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Missions', key: 'missions', width: 10 },
    { header: 'Completed', key: 'completed', width: 11 },
    { header: 'Aborted', key: 'aborted', width: 10 },
    { header: 'Flight hours', key: 'hours', width: 13 },
    { header: 'Fuel (kg)', key: 'fuelKg', width: 11 },
  ];
  head(d);
  d.addRows(f.perDay);

  const t = wb.addWorksheet('By mission type');
  t.columns = [
    { header: 'Type', key: 'type', width: 26 },
    { header: 'Missions', key: 'missions', width: 10 },
    { header: 'Completed', key: 'completed', width: 11 },
    { header: 'Aborted', key: 'aborted', width: 10 },
    { header: 'Flight hours', key: 'hours', width: 13 },
  ];
  head(t);
  t.addRows(f.byType.map((r) => ({ ...r, type: missionTypeLabel(r.type) })));

  const a = wb.addWorksheet('Aircraft');
  a.columns = [
    { header: 'Aircraft', key: 'registration', width: 16 },
    { header: 'Sorties', key: 'sorties', width: 10 },
    { header: 'Flight hours', key: 'hours', width: 13 },
    { header: 'Days unserviceable', key: 'daysUnserviceable', width: 19 },
  ];
  head(a);
  a.addRows(f.aircraft);

  const p = wb.addWorksheet('Pilots');
  p.columns = [
    { header: 'Pilot', key: 'name', width: 30 },
    { header: 'Sorties', key: 'sorties', width: 10 },
    { header: 'Hours', key: 'hours', width: 10 },
    { header: 'As instructor', key: 'instructorHours', width: 14 },
    { header: 'As trainee', key: 'traineeHours', width: 12 },
  ];
  head(p);
  p.addRows(f.personnel.pilots);

  const r = wb.addWorksheet('Abort reasons');
  r.columns = [{ header: 'Reason', key: 'reason', width: 50 }, { header: 'Count', key: 'count', width: 10 }];
  head(r);
  r.addRows(f.abortReasons);

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}

// ───────────────────────────── PDF ─────────────────────────────

/** `part: 'safety'` gives the Safety Officer's extract: safety figures only. */
export function summaryToPdf(f: SummaryFigures, unit: UnitLabel, opts: { part?: 'all' | 'safety' } = {}): Promise<Buffer> {
  const safetyOnly = opts.part === 'safety';
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `${TITLE[f.period]}${safetyOnly ? ' (safety)' : ''} ${rangeLabel(f)}`, Author: `${unit.short} Flight Ops` } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const navy = '#0B1F3A';
    const muted = '#4A5A70';
    doc.rect(0, 0, doc.page.width, 72).fill(navy);
    doc.fill('#FFFFFF').font('Helvetica-Bold').fontSize(16).text(`${unit.short} ${unit.location} — ${TITLE[f.period]}${safetyOnly ? ': safety' : ''}`, 48, 26);
    doc.font('Helvetica').fontSize(10).text(rangeLabel(f), 48, 46);
    doc.moveDown(3).fill('#0F1B2D');

    const section = (title: string) => {
      doc.moveDown(0.8).font('Helvetica-Bold').fontSize(12).fill(navy).text(title);
      doc.moveDown(0.3).font('Helvetica').fontSize(10).fill('#0F1B2D');
    };
    const table = (headers: string[], rows: Array<Array<string | number>>, widths: number[]) => {
      const x0 = doc.page.margins.left;
      const drawRow = (cells: Array<string | number>, bold: boolean) => {
        if (doc.y > doc.page.height - 80) doc.addPage();
        const y = doc.y;
        let x = x0;
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fill(bold ? muted : '#0F1B2D');
        cells.forEach((c, i) => {
          doc.text(String(c), x, y, { width: widths[i] - 6, lineBreak: false, ellipsis: true });
          x += widths[i];
        });
        doc.y = y + 15;
        doc.x = x0;
      };
      drawRow(headers, true);
      if (!rows.length) drawRow(['None'], false);
      rows.forEach((r) => drawRow(r, false));
    };

    if (safetyOnly) {
      section('Safety performance');
      table(
        ['Risk Low', 'Medium', 'High', 'Rejected', 'Hazard reports', 'Incident reports'],
        [[f.safety.low, f.safety.medium, f.safety.high, f.safety.rejected, f.safety.hazards, f.safety.incidents]],
        [70, 70, 60, 70, 100, 100],
      );
      section('Missions');
      doc.text(`Missions ${f.totals.missions} · completed ${f.totals.completed} · aborted ${f.totals.aborted} · open snags at generation ${f.totals.openSnags}`);
      if (f.abortReasons.length) {
        section('Abort reasons');
        table(['Reason', 'Count'], f.abortReasons.map((r) => [r.reason, r.count]), [380, 60]);
      }
      doc.moveDown(2).fontSize(8).fill(muted).text(`Safety extract generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')}Z by ${unit.short} Flight Ops.`);
      doc.end();
      return;
    }

    section('Totals');
    table(
      ['Missions', 'Completed', 'Aborted', 'Cancelled', 'Success', 'Hours', 'Fuel kg', 'Fuel L', 'Open snags'],
      [[f.totals.missions, f.totals.completed, f.totals.aborted, f.totals.cancelled, pct(f.totals.successRate), formatHours(f.totals.flightHours), f.totals.fuelKg, f.totals.fuelL, f.totals.openSnags]],
      [56, 58, 50, 56, 50, 46, 56, 50, 60],
    );

    if (f.period !== 'DAILY') {
      section('Day by day');
      table(['Date', 'Missions', 'Completed', 'Aborted', 'Hours', 'Fuel kg'], f.perDay.map((d) => [d.date, d.missions, d.completed, d.aborted, formatHours(d.hours), d.fuelKg]), [90, 70, 70, 70, 70, 70]);
    }

    section('Mission types');
    table(['Type', 'Missions', 'Completed', 'Aborted', 'Hours'], f.byType.map((t) => [missionTypeLabel(t.type), t.missions, t.completed, t.aborted, formatHours(t.hours)]), [170, 70, 70, 70, 70]);

    section('Aircraft utilisation');
    table(['Aircraft', 'Sorties', 'Hours', 'Days unserviceable'], f.aircraft.map((a) => [a.registration, a.sorties, formatHours(a.hours), a.daysUnserviceable]), [130, 80, 80, 120]);

    if (f.abortReasons.length) {
      section('Abort reasons');
      table(['Reason', 'Count'], f.abortReasons.map((r) => [r.reason, r.count]), [380, 60]);
    }

    if (f.period === 'MONTHLY' || f.period === 'QUARTERLY') {
      section('Personnel');
      doc.text(`Crew readiness rate: ${pct(f.personnel.readinessRate)} · Not available responses: ${f.personnel.notAvailable}`);
      doc.moveDown(0.3);
      table(['Pilot', 'Sorties', 'Hours', 'As IP', 'As TP'], f.personnel.pilots.map((p) => [p.name, p.sorties, formatHours(p.hours), formatHours(p.instructorHours), formatHours(p.traineeHours)]), [200, 60, 60, 60, 60]);
    }

    if (f.period === 'QUARTERLY' || f.period === 'MONTHLY') {
      section('Maintenance performance');
      doc.text(`Snags raised: ${f.maintenance.snagsRaised} · closed: ${f.maintenance.snagsClosed} · average days to close: ${f.maintenance.avgDaysToClose ?? '—'}`);
      section('Safety performance');
      doc.text(`Risk assessments — Low ${f.safety.low}, Medium ${f.safety.medium}, High ${f.safety.high}; rejected ${f.safety.rejected}. Hazard reports ${f.safety.hazards}, incident reports ${f.safety.incidents}. Sorties self-authorised by a crewed approver ${f.safety.selfAuthorised ?? 0}.`);
    }

    doc.moveDown(2).fontSize(8).fill(muted).text(`Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')}Z by ${unit.short} Flight Ops. Figures are fixed at generation.`);
    doc.end();
  });
}
