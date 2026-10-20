'use client';

import { useState } from 'react';
import { api } from '@/lib/client/api';
import { APPROVER_ROLE_LABEL } from '@/lib/constants';
import { FormError, useSubmit } from '../form';

type Role = 'COMMANDER' | 'CO_FLYING_WING' | 'CO_ENGINEERING' | 'OPERATIONS_OFFICER';
type Comment = { id: string; author: string; body: string; at: string };

/**
 * Comments and decisions in one place. Anyone with comment rights can post; CO Flying Wing and the
 * Commander (or acting GOO) also get Approve beside Post comment, plus Approve with remarks and Reject.
 */
export function RiskActions({
  riskId,
  comments,
  canComment,
  decide,
}: {
  riskId: string;
  comments: Comment[];
  canComment: boolean;
  decide: { roles: Role[]; high: boolean; ready: boolean; selfAuth?: boolean } | null;
}) {
  const s = useSubmit();
  const [text, setText] = useState('');
  const [role, setRole] = useState<Role | undefined>(decide?.roles[0]);
  const empty = !text.trim();

  async function post() {
    if (await s.run(() => api(`risk-assessments/${riskId}/comments`, { body: { body: text.trim() } }))) window.location.reload();
  }
  async function decision(d: 'APPROVE' | 'APPROVE_WITH_REMARKS' | 'REJECT') {
    if (!role) return;
    if (await s.run(() => api(`risk-assessments/${riskId}/decision`, { body: { role, decision: d, remarks: text.trim() || undefined } }))) window.location.reload();
  }

  const canDecideNow = !!decide && decide.ready;
  return (
    <div className="flex flex-col gap-3">
      {comments.length === 0 && <p className="text-ink-muted">No comments yet.</p>}
      {comments.map((c) => (
        <div key={c.id} className="rounded-lg bg-brand-soft px-3 py-2.5 text-[14px]">
          <div className="text-[12px] font-semibold">
            {c.author} · {c.at}
          </div>
          <p className="whitespace-pre-line">{c.body}</p>
        </div>
      ))}

      {(canComment || decide) && (
        <div className="flex flex-col gap-3 border-t border-line pt-3">
          <FormError error={s.error} />
          {decide && decide.roles.length > 1 && (
            <div>
              <label htmlFor="role" className="label">
                Deciding as
              </label>
              <select id="role" className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {decide.roles.map((r) => (
                  <option key={r} value={r}>
                    {APPROVER_ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="risk-text" className="label">
              {decide ? 'Comment or remarks' : 'Add a comment'}
              {decide && <span className="font-normal text-ink-muted">{decide.selfAuth ? ' (required: self-authorisation)' : decide.high ? ' (remarks required: High risk)' : ' (required to reject or approve with remarks)'}</span>}
            </label>
            <textarea id="risk-text" rows={3} className="textarea" value={text} onChange={(e) => setText(e.target.value)} />
            {s.fields.remarks && <p className="field-error">{s.fields.remarks}</p>}
            {s.fields.body && <p className="field-error">{s.fields.body}</p>}
          </div>

          <div className="flex flex-wrap gap-2">
            {canComment && (
              <button className="btn-secondary flex-1" disabled={empty || s.busy} onClick={post}>
                Post comment
              </button>
            )}
            {decide && (
              <button className="btn-primary flex-1" disabled={!canDecideNow || s.busy || ((decide.high || !!decide.selfAuth) && empty)} onClick={() => decision('APPROVE')}>
                Approve
              </button>
            )}
          </div>
          {decide && (
            <div className="flex flex-wrap gap-2">
              <button className="btn-outline flex-1" disabled={!canDecideNow || s.busy || empty} onClick={() => decision('APPROVE_WITH_REMARKS')}>
                Approve with remarks
              </button>
              <button className="btn-danger flex-1" disabled={!canDecideNow || s.busy || empty} onClick={() => decision('REJECT')}>
                Reject
              </button>
            </div>
          )}
          {decide?.selfAuth && (
            <div className="alert-warn">
              You are crewed on this sortie and no other approver for this role is free, so you may self-authorise. Your remark is required, the decision is marked Self-authorised, and the Safety Officer is told.
            </div>
          )}
          {decide && !decide.ready && <div className="alert-warn">Waiting for every crew member’s IMSAFE check before a decision can be made.</div>}
        </div>
      )}
    </div>
  );
}
