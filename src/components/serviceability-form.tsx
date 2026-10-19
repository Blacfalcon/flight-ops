'use client';

import { useState } from 'react';
import { api } from '@/lib/client/api';
import { AIRCRAFT_STATUSES, AIRCRAFT_STATUS_LABEL, type AircraftStatusValue } from '@/lib/constants';
import { formatHours, HOURS_PATTERN, parseHours } from '@/lib/hours';
import { FormError, FormNotice, useSubmit } from './form';

type Row = {
  id: string;
  registration: string;
  type: string;
  currentStatus: string;
  status: string;
  confirmed: boolean;
  hoursToNextInspection: number;
  remarks: string;
};

export function ServiceabilityForm({ date, rows }: { date: string; rows: Row[] }) {
  const s = useSubmit();
  const [values, setValues] = useState(rows.map((r) => ({ ...r, hoursText: formatHours(r.hoursToNextInspection) })));
  const update = (i: number, patch: Partial<Row & { hoursText: string }>) => setValues((v) => v.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function save() {
    const badRow = values.find((r) => parseHours(r.hoursText) === null);
    if (badRow) {
      s.setError(`Hours to inspection for ${badRow.registration} should be HH:MM, for example 85:30.`);
      return;
    }
    const entries = values.map((r) => ({ aircraftId: r.id, status: r.status, remarks: r.remarks || undefined, hoursToNextInspection: parseHours(r.hoursText) as number }));
    const res = await s.run(() => api<{ confirmed: number }>(`serviceability/${date}`, { body: { entries } }));
    if (res) {
      s.setNotice(`Confirmed ${res.confirmed} aircraft for ${date}.`);
      setValues((v) => v.map((r) => ({ ...r, confirmed: true })));
    }
  }

  if (!rows.length) return <p className="text-ink-muted">No aircraft in the register. Ask Admin to add them.</p>;

  return (
    <section className="card overflow-hidden">
      <div className="card-head">
        <h2>
          {values.filter((v) => v.confirmed).length} of {values.length} confirmed
        </h2>
        <button className="btn-primary" disabled={s.busy} onClick={save}>
          {s.busy ? 'Saving…' : `Confirm all ${values.length} aircraft`}
        </button>
      </div>
      <div className="flex flex-col gap-3 px-5 py-4">
        <FormError error={s.error} />
        <FormNotice notice={s.notice} />
      </div>
      <div className="overflow-x-auto">
        <table className="table min-w-[820px]">
          <thead>
            <tr>
              <th>Aircraft</th>
              <th>Status for {date}</th>
              <th>Hours to inspection (HH:MM)</th>
              <th>Remarks</th>
              <th>Confirmed</th>
            </tr>
          </thead>
          <tbody>
            {values.map((r, i) => (
              <tr key={r.id}>
                <td>
                  <div className="mono">{r.registration}</div>
                  <div className="text-ink-muted">{r.type}</div>
                </td>
                <td>
                  <label htmlFor={`st-${r.id}`} className="sr-only">
                    Status for {r.registration}
                  </label>
                  <select
                    id={`st-${r.id}`}
                    className={`input h-10 font-semibold ${r.status === 'SERVICEABLE' ? 'text-good-fg' : r.status === 'UNSERVICEABLE' ? 'text-bad-fg' : 'text-warn-fg'}`}
                    value={r.status}
                    onChange={(e) => update(i, { status: e.target.value })}
                  >
                    {AIRCRAFT_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {AIRCRAFT_STATUS_LABEL[st as AircraftStatusValue]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <label htmlFor={`h-${r.id}`} className="sr-only">
                    Hours to inspection for {r.registration}
                  </label>
                  <input id={`h-${r.id}`} inputMode="text" pattern={HOURS_PATTERN} placeholder="85:30" className={`input h-10 w-28 font-mono ${parseHours(r.hoursText) === null ? 'input-error' : ''}`} value={r.hoursText} onChange={(e) => update(i, { hoursText: e.target.value })} />
                </td>
                <td>
                  <label htmlFor={`rm-${r.id}`} className="sr-only">
                    Remarks for {r.registration}
                  </label>
                  <input id={`rm-${r.id}`} className="input h-10" value={r.remarks} onChange={(e) => update(i, { remarks: e.target.value })} />
                </td>
                <td>{r.confirmed ? <span className="pill-good">Yes</span> : <span className="pill-warn">Not yet</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
