'use client';

import { useEffect } from 'react';
import { flushOutbox } from '@/lib/client/outbox';

/** Registers the service worker and sends the offline outbox whenever the connection comes back. */
export function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
    }
    const flush = async () => {
      const refused = await flushOutbox();
      if (refused.length) {
        window.dispatchEvent(new CustomEvent('outbox-refused', { detail: refused }));
      }
    };
    flush();
    window.addEventListener('online', flush);
    const timer = window.setInterval(flush, 60_000);
    return () => {
      window.removeEventListener('online', flush);
      window.clearInterval(timer);
    };
  }, []);
  return null;
}
