'use client';

import { api } from '@/lib/client/api';
import { useSubmit } from './form';

export function DecideRequest({ id }: { id: string }) {
  const s = useSubmit();
  const decide = async (approve: boolean) => {
    if (await s.run(() => api(`profile-change-requests/${id}/decide`, { body: { approve } }))) window.location.reload();
  };
  return (
    <div className="flex items-center gap-2">
      {s.error && <span className="text-[13px] text-bad-fg">{s.error}</span>}
      <button className="btn-primary btn-sm" disabled={s.busy} onClick={() => decide(true)}>
        Approve
      </button>
      <button className="btn-danger btn-sm" disabled={s.busy} onClick={() => decide(false)}>
        Reject
      </button>
    </div>
  );
}
