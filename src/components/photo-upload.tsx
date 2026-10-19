'use client';

import { useState } from 'react';
import { api } from '@/lib/client/api';
import { resizeImage } from '@/lib/client/image';
import { Avatar } from './avatar';
import { FormError, FormNotice, useSubmit } from './form';

/** Add, replace or remove a personnel photo (own profile, or Admin on someone else's). */
export function PhotoUpload({ user }: { user: { id: string; fullName: string; photoUpdatedAt: string | null } }) {
  const s = useSubmit();
  const [version, setVersion] = useState<string | null>(user.photoUpdatedAt);

  async function upload(file: File | undefined) {
    if (!file) return;
    let dataUrl: string;
    try {
      dataUrl = await resizeImage(file, 400, 'image/jpeg', 0.85);
    } catch (e) {
      s.setError((e as Error).message);
      return;
    }
    const res = await s.run(() => api<{ photoUpdatedAt: string }>(`users/${user.id}/photo`, { method: 'PUT', body: { dataUrl } }));
    if (res) {
      setVersion(res.photoUpdatedAt);
      s.setNotice('Photo saved.');
    }
  }
  async function remove() {
    if (await s.run(() => api(`users/${user.id}/photo`, { method: 'DELETE' }))) {
      setVersion(null);
      s.setNotice('Photo removed.');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <FormError error={s.error} />
      <FormNotice notice={s.notice} />
      <div className="flex items-center gap-4">
        <Avatar user={{ id: user.id, fullName: user.fullName, photoUpdatedAt: version }} size={88} />
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <label className="btn-secondary btn-sm cursor-pointer">
              {s.busy ? 'Saving…' : version ? 'Choose a new photo' : 'Choose a photo'}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
            </label>
            <label className="btn-outline btn-sm cursor-pointer">
              Take a photo
              <input type="file" accept="image/*" capture="user" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
            </label>
          </div>
          {version && (
            <button type="button" className="self-start text-[13px] font-semibold text-ink-muted underline" onClick={remove} disabled={s.busy}>
              Remove photo
            </button>
          )}
          <p className="hint mt-0">A clear head-and-shoulders photo. It is shown on crew lists and Personnel.</p>
        </div>
      </div>
    </div>
  );
}
