'use client';

import { api } from '@/lib/client/api';

export function MarkAllRead() {
  return (
    <button
      className="btn-secondary btn-sm"
      onClick={async () => {
        await api('notifications/read', { body: { all: true } }).catch(() => undefined);
        window.location.reload();
      }}
    >
      Mark all as read
    </button>
  );
}
