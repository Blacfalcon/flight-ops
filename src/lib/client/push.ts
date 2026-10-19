'use client';

import { api } from './api';

// Phone notifications on this device.
// - In the Play Store / App Store app (Capacitor), Firebase Cloud Messaging is used through the
//   native plugin, which the app shell injects as window.Capacitor.Plugins.FirebaseMessaging.
// - In a browser or the installed web app, standard Web Push is used. On iPhone this works only
//   after "Add to Home Screen" (iOS 16.4 or newer).

type Listener = { remove: () => Promise<void> };
type FirebaseMessaging = {
  checkPermissions(): Promise<{ receive: string }>;
  requestPermissions(): Promise<{ receive: string }>;
  getToken(): Promise<{ token: string }>;
  deleteToken(): Promise<void>;
  addListener(event: 'tokenReceived', fn: (e: { token: string }) => void): Promise<Listener>;
  addListener(event: 'notificationActionPerformed', fn: (e: { notification: { data?: Record<string, unknown> } }) => void): Promise<Listener>;
};
type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: { FirebaseMessaging?: FirebaseMessaging };
  registerPlugin?: (name: string) => unknown;
};

const KEY = 'push-endpoint';

function cap(): CapacitorGlobal | undefined {
  return typeof window === 'undefined' ? undefined : (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

export function nativeMessaging(): FirebaseMessaging | null {
  const c = cap();
  if (!c?.isNativePlatform?.()) return null;
  return c.Plugins?.FirebaseMessaging ?? ((c.registerPlugin?.('FirebaseMessaging') as FirebaseMessaging | undefined) ?? null);
}

export type PushSupport = 'native' | 'web' | 'ios-install-first' | 'unsupported';

export function pushSupport(): PushSupport {
  if (typeof window === 'undefined') return 'unsupported';
  if (nativeMessaging()) return 'native';
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return ios && !standalone ? 'ios-install-first' : 'unsupported';
  return 'web';
}

function label(): string {
  const ua = navigator.userAgent;
  const kind = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android phone' : /Windows/.test(ua) ? 'Windows computer' : /Mac/.test(ua) ? 'Mac' : 'Device';
  return nativeMessaging() ? `${kind} (app)` : kind;
}

function b64ToBytes(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function remember(endpoint: string | null) {
  try {
    if (endpoint) localStorage.setItem(KEY, endpoint);
    else localStorage.removeItem(KEY);
  } catch {
    // storage unavailable: the server copy is still correct
  }
}

export function rememberedEndpoint(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Is push switched on for this device right now? */
export async function pushIsOn(): Promise<boolean> {
  const fm = nativeMessaging();
  if (fm) return (await fm.checkPermissions()).receive === 'granted' && !!rememberedEndpoint();
  if (pushSupport() !== 'web' || Notification.permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.ready;
  return !!(await reg.pushManager.getSubscription());
}

/** Asks permission (must be called from a tap) and registers this device. */
export async function enablePush(): Promise<void> {
  const fm = nativeMessaging();
  if (fm) {
    const p = await fm.requestPermissions();
    if (p.receive !== 'granted') throw new Error('Notifications are blocked for this app. Allow them in the phone’s Settings.');
    const { token } = await fm.getToken();
    await api('push/devices', { body: { platform: 'FCM', endpoint: token, label: label() } });
    remember(token);
    return;
  }
  const support = pushSupport();
  if (support === 'ios-install-first') throw new Error('On iPhone, first tap Share → Add to Home Screen, open the app from the Home Screen, then turn notifications on there.');
  if (support !== 'web') throw new Error('This browser cannot receive notifications. Use Chrome on Android, or the installed app.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are blocked for this site. Allow them in the browser’s site settings, then try again.');
  const { webKey } = await api<{ webKey: string | null }>('push');
  if (!webKey) throw new Error('Phone notifications are not set up on the server yet. Ask Admin to add the push keys.');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(webKey) as BufferSource }));
  const json = sub.toJSON() as { endpoint: string; keys?: { p256dh?: string; auth?: string } };
  await api('push/devices', { body: { platform: 'WEB', endpoint: json.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth, label: label() } });
  remember(json.endpoint);
}

/** Stops push on this device. `keepPermission` is used on sign-out so the next person can switch it on again. */
export async function disablePush(): Promise<void> {
  const endpoint = rememberedEndpoint();
  try {
    if (endpoint) await api('push/devices', { method: 'DELETE', body: { endpoint } });
  } finally {
    remember(null);
    const fm = nativeMessaging();
    if (fm) {
      await fm.deleteToken().catch(() => undefined);
    } else if (pushSupport() === 'web') {
      const reg = await navigator.serviceWorker.ready;
      await (await reg.pushManager.getSubscription())?.unsubscribe().catch(() => undefined);
    }
  }
}
