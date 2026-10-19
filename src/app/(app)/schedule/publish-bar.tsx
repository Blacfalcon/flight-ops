'use client';

import { useState } from 'react';
import { api, ApiClientError } from '@/lib/client/api';
import { MISSION_STATUS_LABEL, ORDER_STATUS_LABEL } from '@/lib/constants';

type Item = { id: string; missionNo: string; status: string; orderStatus: string | null };
const ready = (m: Item) => m.status === 'DRAFT' && m.orderStatus === 'APPROVED';

export function PublishBar({ missions }: { missions: Item[] }) {
  const [selected, setSelected] = useState<string[]>(missions.filter(ready).map((m) => m.id));
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function publish() {
    setBusy(true);
    setError(null);
    setProblems({});
    try {
      await api('missions/publish', { body: { ids: selected } });
      window.location.reload();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
        setProblems(err.fields);
      } else setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card flex flex-col gap-3 border-2 border-brand p-5" aria-label="Publish">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2>Unpublished missions</h2>
          <p className="text-[13px] text-ink-muted">Crews are notified when you publish. A sortie can be published once its mission order is approved and its aircraft is confirmed serviceable.</p>
        </div>
        <button className="btn-primary" disabled={busy || !selected.length} onClick={publish}>
          {busy ? 'Publishing…' : `Publish ${selected.length}`}
        </button>
      </div>
      {error && (
        <div role="alert" className="alert-bad">
          <div className="font-semibold">{error}</div>
          {Object.keys(problems).length > 0 && (
            <ul className="ml-5 list-disc">
              {Object.entries(problems).map(([k, v]) => (
                <li key={k}>
                  <span className="font-mono">{k}</span>: {v}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {missions.map((m) => (
          <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2">
            <input
              type="checkbox"
              checked={selected.includes(m.id)}
              onChange={(e) => setSelected((s) => (e.target.checked ? [...s, m.id] : s.filter((x) => x !== m.id)))}
            />
            <span className="mono">{m.missionNo}</span>
            <span className={m.status === 'AWAITING_ENGINEERING' ? 'pill-warn' : 'pill-none'}>{MISSION_STATUS_LABEL[m.status]}</span>
            <span className={m.orderStatus === 'APPROVED' ? 'pill-good' : m.orderStatus === 'REJECTED' ? 'pill-bad' : 'pill-warn'}>
              Order: {m.orderStatus ? ORDER_STATUS_LABEL[m.orderStatus] : 'none'}
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}
