'use client';

import { useState } from 'react';
import { api } from '@/lib/client/api';
import { submitOrQueue } from '@/lib/client/outbox';
import { FormError, useSubmit } from '../form';

export function ReadinessButtons({ missionId, missionNo }: { missionId: string; missionNo: string }) {
  const s = useSubmit();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [done, setDone] = useState<null | { ready: boolean; queued: boolean }>(null);

  async function send(ready: boolean) {
    const body = { ready, reason: ready ? undefined : reason };
    const res = await s.run(() =>
      submitOrQueue('readiness', missionId, body, `${missionNo}: ${ready ? 'READY' : 'NOT AVAILABLE'}`, () => api(`missions/${missionId}/readiness`, { body })),
    );
    if (res) {
      setDone({ ready, queued: res.queued });
      if (!res.queued) setTimeout(() => window.location.reload(), 800);
    }
  }

  if (done) {
    return (
      <div role="status" className={done.queued ? 'alert-warn' : 'alert-good'}>
        {done.ready ? 'You are marked READY.' : 'You are marked NOT AVAILABLE.'} {done.queued ? 'Waiting to sync — Ops will see it when you are back online.' : 'Ops, CO Flying Wing and the Commander can see it now.'}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <FormError error={s.error} />
      {!asking ? (
        <>
          <button className="btn-primary h-14 text-[17px] tracking-wide" disabled={s.busy} onClick={() => send(true)}>
            READY FOR MISSION
          </button>
          <button className="btn-danger h-12" disabled={s.busy} onClick={() => setAsking(true)}>
            NOT AVAILABLE
          </button>
        </>
      ) : (
        <>
          <label htmlFor={`reason-${missionId}`} className="label">
            Reason you are not available
          </label>
          <textarea id={`reason-${missionId}`} className="textarea" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          {s.fields.reason && <p className="field-error">{s.fields.reason}</p>}
          <div className="flex gap-2">
            <button className="btn-danger flex-1" disabled={s.busy || !reason.trim()} onClick={() => send(false)}>
              Send NOT AVAILABLE
            </button>
            <button className="btn-secondary" onClick={() => setAsking(false)}>
              Back
            </button>
          </div>
        </>
      )}
      <p className="text-[13px] text-ink-muted">Ops, CO Flying Wing and the Commander see your answer immediately.</p>
    </div>
  );
}
