'use client';

import { api } from '@/lib/client/api';
import { useSubmit } from './form';

export function ApprovePlan({ planId }: { planId: string }) {
  const s = useSubmit();
  return (
    <>
      <button
        className="btn-primary btn-sm"
        disabled={s.busy}
        onClick={async () => {
          if (await s.run(() => api(`flight-plans/${planId}/approve`, { body: {} }))) window.location.reload();
        }}
      >
        Approve plan
      </button>
      {s.error && <span className="text-[13px] font-medium text-bad-fg">{s.error}</span>}
    </>
  );
}
