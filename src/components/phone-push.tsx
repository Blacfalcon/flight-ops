'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client/api';
import { disablePush, enablePush, nativeMessaging, pushIsOn, pushSupport, rememberedEndpoint, type PushSupport } from '@/lib/client/push';
import { FormError, FormNotice, useSubmit } from './form';

type Device = { id: string; platform: string; label: string | null; createdAt: string; lastUsedAt: string | null; endpoint: string };

/** My profile → Phone notifications: switch this device on or off, test it, remove old phones. */
export function PhonePush() {
  const s = useSubmit();
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [on, setOn] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);

  async function load() {
    setSupport(pushSupport());
    setOn(await pushIsOn().catch(() => false));
    const r = await api<{ devices: Device[] }>('push').catch(() => ({ devices: [] }));
    setDevices(r.devices);
  }
  useEffect(() => {
    load();
  }, []);

  async function run(fn: () => Promise<unknown>, notice: string) {
    if (await s.run(async () => (await fn(), true))) {
      s.setNotice(notice);
      await load();
    }
  }
  const mine = rememberedEndpoint();

  return (
    <div className="flex flex-col gap-3">
      <p className="hint mt-0">Every notification also appears on this phone within a minute. Items that need your action also come by email (see Email notifications).</p>
      <FormError error={s.error} />
      <FormNotice notice={s.notice} />
      {support === 'ios-install-first' && (
        <div className="alert-info">
          On iPhone: tap <strong>Share</strong> → <strong>Add to Home Screen</strong>, open the app from the Home Screen, then come back here and switch notifications on. Needs iOS 16.4 or newer.
        </div>
      )}
      {support === 'unsupported' && <div className="alert-warn">This browser can’t receive notifications. Use Chrome on Android, Safari on iPhone (after Add to Home Screen), or the store app.</div>}
      {(support === 'web' || support === 'native') && (
        <div className="flex flex-wrap items-center gap-2">
          <span className={on ? 'pill-good' : 'pill-none'}>{on ? 'On for this device' : 'Off for this device'}</span>
          {on ? (
            <>
              <button className="btn-secondary btn-sm" disabled={s.busy} onClick={() => run(() => api('push/test', { method: 'POST' }), 'Test sent. It should arrive within a few seconds.')}>
                Send a test
              </button>
              <button className="btn-outline btn-sm" disabled={s.busy} onClick={() => run(disablePush, 'Notifications switched off on this device.')}>
                Turn off
              </button>
            </>
          ) : (
            <button className="btn-primary btn-sm" disabled={s.busy} onClick={() => run(enablePush, 'Notifications are on for this device.')}>
              Turn on notifications
            </button>
          )}
        </div>
      )}
      {devices.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="label mb-0">Devices receiving your notifications</div>
          {devices.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-[14px]">
              <span>
                {d.label ?? (d.platform === 'FCM' ? 'Phone app' : 'Browser')}
                {d.endpoint === mine ? ' · this device' : ''}
                <span className="block text-[12px] text-ink-muted">Added {new Date(d.createdAt).toLocaleDateString('en-GB')}</span>
              </span>
              <button className="text-[13px] font-semibold text-ink-muted underline" disabled={s.busy} onClick={() => run(() => api('push/devices', { method: 'DELETE', body: { id: d.id } }), 'Device removed.')}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** A one-time prompt in the app shell, so people switch phone notifications on without hunting for it. */
export function PushPrompt() {
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        if (localStorage.getItem('push-prompt-dismissed')) return;
      } catch {
        return;
      }
      const sup = pushSupport();
      if (sup === 'unsupported') return;
      if (sup === 'web' && Notification.permission === 'denied') return;
      if (await pushIsOn().catch(() => false)) return;
      setShow(true);
    })();
  }, []);
  if (!show) return null;
  const dismiss = () => {
    try {
      localStorage.setItem('push-prompt-dismissed', '1');
    } catch {
      // ignore
    }
    setShow(false);
  };
  return (
    <div role="region" aria-label="Phone notifications" className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-brand bg-white px-4 py-3 lg:mx-8">
      <div>
        <div className="font-semibold">Get readiness calls and approvals on this phone</div>
        <div className="text-[13px] text-ink-muted">{error ?? (pushSupport() === 'ios-install-first' ? 'On iPhone: Share → Add to Home Screen, then open the app from the Home Screen.' : 'Notifications arrive even when the app is closed.')}</div>
      </div>
      <div className="flex gap-2">
        {pushSupport() !== 'ios-install-first' && (
          <button
            className="btn-primary btn-sm"
            onClick={async () => {
              try {
                await enablePush();
                dismiss();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Turn on
          </button>
        )}
        <button className="btn-secondary btn-sm" onClick={dismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}

/** In the store app: keep the device token fresh and open the right page when a notification is tapped. */
export function NativePushBridge() {
  useEffect(() => {
    let handles: Array<{ remove: () => Promise<void> }> = [];
    (async () => {
      const fm = nativeMessaging();
      if (!fm) return;
      handles.push(
        await fm.addListener('notificationActionPerformed', (e) => {
          const link = e.notification?.data?.link;
          if (typeof link === 'string' && link.startsWith('/')) window.location.href = link;
        }),
      );
      handles.push(
        await fm.addListener('tokenReceived', ({ token }) => {
          if (rememberedEndpoint()) api('push/devices', { body: { platform: 'FCM', endpoint: token, label: 'Phone (app)' } }).catch(() => undefined);
        }),
      );
      // Refresh the token on each launch if notifications were switched on
      if (rememberedEndpoint() && (await fm.checkPermissions()).receive === 'granted') {
        const { token } = await fm.getToken();
        if (token !== rememberedEndpoint()) await api('push/devices', { body: { platform: 'FCM', endpoint: token, label: 'Phone (app)' } }).catch(() => undefined);
        try {
          localStorage.setItem('push-endpoint', token);
        } catch {
          // ignore
        }
      }
    })();
    return () => {
      handles.forEach((h) => h.remove().catch(() => undefined));
      handles = [];
    };
  }, []);
  return null;
}
