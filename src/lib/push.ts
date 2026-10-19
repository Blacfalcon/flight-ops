import webpush from 'web-push';
import { SignJWT, importPKCS8 } from 'jose';
import { db } from './db';

// Sends phone notifications.
// - WEB: the installed web app, through the browser's push service (Google for Chrome/Android,
//   Apple for iPhone). The message is encrypted end to end, so the item's title can be shown.
// - FCM: the Play Store / App Store app, through Firebase Cloud Messaging. Google can read FCM
//   messages, so unless PUSH_FCM_SHOW_TITLES=true they carry a generic line and the app opens the item.

export type PushMessage = { title: string; body?: string; link: string; tag?: string };

let vapidReady: boolean | null = null;
function vapid(): boolean {
  if (vapidReady !== null) return vapidReady;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (vapidReady = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || `mailto:${process.env.SMTP_USER ?? 'admin@example.com'}`, pub, priv);
  return (vapidReady = true);
}

export function webPushPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

// ── FCM (HTTP v1) ────────────────────────────────────────────────────────────

type ServiceAccount = { project_id: string; client_email: string; private_key: string };
let account: ServiceAccount | null | undefined;
let accessToken: { value: string; expires: number } | null = null;

function serviceAccount(): ServiceAccount | null {
  if (account !== undefined) return account;
  const raw = process.env.FCM_SERVICE_ACCOUNT_BASE64;
  if (!raw) return (account = null);
  try {
    account = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as ServiceAccount;
  } catch {
    console.error('[push] FCM_SERVICE_ACCOUNT_BASE64 is not valid base64 JSON');
    account = null;
  }
  return account;
}

async function fcmAccessToken(sa: ServiceAccount): Promise<string> {
  if (accessToken && accessToken.expires > Date.now() + 60_000) return accessToken.value;
  const key = await importPKCS8(sa.private_key, 'RS256');
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/firebase.messaging' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!res.ok) throw new Error(`FCM token request failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  accessToken = { value: data.access_token, expires: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

/** Returns false when the device is gone (uninstalled, token expired) and should be removed. */
async function sendFcm(token: string, m: PushMessage, unitShort: string): Promise<boolean> {
  const sa = serviceAccount();
  if (!sa) return true; // not configured: keep the device, nothing sent
  const showTitles = process.env.PUSH_FCM_SHOW_TITLES === 'true';
  const title = showTitles ? m.title : `${unitShort} Ops`;
  const body = showTitles ? (m.body ?? 'Tap to open.') : 'You have a new item. Tap to open it.';
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await fcmAccessToken(sa)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data: { link: m.link },
        android: { priority: 'high', notification: { tag: m.tag, click_action: 'FCM_PLUGIN_ACTIVITY' } },
        apns: { payload: { aps: { sound: 'default', 'thread-id': m.tag ?? 'ops' } } },
      },
    }),
  });
  if (res.ok) return true;
  const text = await res.text();
  if (res.status === 404 || text.includes('UNREGISTERED') || text.includes('INVALID_ARGUMENT')) return false;
  throw new Error(`FCM send failed: ${res.status} ${text}`);
}

/** Sends one message to every device a person has registered. Dead devices are removed. */
export async function pushToUser(userId: string, m: PushMessage, unitShort: string): Promise<number> {
  const devices = await db.pushDevice.findMany({ where: { userId } });
  let sent = 0;
  for (const d of devices) {
    try {
      let alive = true;
      if (d.platform === 'WEB') {
        if (!vapid() || !d.p256dh || !d.auth) continue;
        try {
          await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, JSON.stringify(m), { TTL: 6 * 3600, urgency: 'high' });
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) alive = false;
          else throw err;
        }
      } else {
        alive = await sendFcm(d.endpoint, m, unitShort);
      }
      if (alive) {
        sent++;
        await db.pushDevice.update({ where: { id: d.id }, data: { lastUsedAt: new Date() } });
      } else {
        await db.pushDevice.delete({ where: { id: d.id } });
      }
    } catch (err) {
      console.error('[push] send failed', d.platform, err);
    }
  }
  return sent;
}

export function pushConfigured() {
  return { web: vapid(), fcm: !!serviceAccount() };
}
