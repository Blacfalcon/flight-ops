'use client';

import { api } from '@/lib/client/api';
import { FormError, useSubmit } from './form';

export function GenerateReport({ today }: { today: string }) {
  const s = useSubmit();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const res = await s.run(() => api<{ id: string }>('reports', { body: { period: f.get('period'), anchor: f.get('anchor') } }));
        if (res) window.location.href = `/reports/${res.id}`;
      }}
      className="flex flex-col gap-3"
    >
      <FormError error={s.error} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div>
          <label htmlFor="period" className="label">
            Summary
          </label>
          <select id="period" name="period" className="input sm:w-44">
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
          </select>
        </div>
        <div>
          <label htmlFor="anchor" className="label">
            Any date in the period
          </label>
          <input id="anchor" name="anchor" type="date" className="input sm:w-48" defaultValue={today} />
        </div>
        <button className="btn-primary" disabled={s.busy}>
          {s.busy ? 'Generating…' : 'Generate'}
        </button>
      </div>
      <p className="hint">Regenerating replaces the stored copy for that period, for example after late mission reports.</p>
    </form>
  );
}
