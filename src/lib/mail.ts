import nodemailer, { type Transporter } from 'nodemailer';
import { env } from './env';
import { DEFAULT_SETTINGS, getSettings } from './settings';

async function unitShort(): Promise<string> {
  try {
    return (await getSettings()).unit.short;
  } catch {
    return DEFAULT_SETTINGS.unit.short;
  }
}

// Emails never carry operational detail: they say what kind of item is waiting and ask the person to sign in.

let transporter: Transporter | null = null;

function transport(): Transporter {
  if (!transporter) {
    const s = env.smtp();
    transporter = nodemailer.createTransport({ host: s.host, port: s.port, secure: s.secure, auth: { user: s.user, pass: s.pass } });
  }
  return transporter;
}

/** Keep the address from MAIL_FROM but always show the unit's name, e.g. "DHS Ops <unit@gmail.com>". */
function fromHeader(mailFrom: string, unit: string): string {
  const address = /<([^>]+)>/.exec(mailFrom)?.[1] ?? mailFrom.trim();
  return `"${unit.replace(/"/g, '')} Ops" <${address}>`;
}

/** Escape text placed into email HTML. The unit name and wording still show exactly as typed. */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function layout(rawUnit: string, rawTitle: string, rawBody: string, action?: { label: string; url: string }) {
  const unit = esc(rawUnit);
  const title = esc(rawTitle);
  const body = esc(rawBody);
  const manageUrl = `${env.appUrl}/me`;
  const button = action
    ? `<p style="margin:24px 0"><a href="${esc(action.url)}" style="background:#1F5FD1;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${esc(action.label)}</a></p>`
    : '';
  const html = `<!doctype html><html><body style="margin:0;background:#F3F6FA;font-family:Arial,sans-serif;color:#0F1B2D">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border:1px solid #DCE3EC;border-radius:12px">
<tr><td style="background:#0B1F3A;color:#ffffff;padding:18px 24px;border-radius:12px 12px 0 0;font-weight:700">${unit} Flight Ops</td></tr>
<tr><td style="padding:24px"><h1 style="font-size:18px;margin:0 0 12px">${title}</h1><p style="margin:0;line-height:1.5">${body}</p>${button}
<p style="margin:24px 0 0;color:#4A5A70;font-size:12px">This message contains no operational detail. Sign in to view it.</p>
<p style="margin:8px 0 0;color:#4A5A70;font-size:12px"><a href="${esc(manageUrl)}" style="color:#1F4FB0">Change which emails you get</a> on My profile.</p></td></tr>
</table></td></tr></table></body></html>`;
  const text = `${rawTitle}\n\n${rawBody}${action ? `\n\n${action.label}: ${action.url}` : ''}\n\nThis message contains no operational detail. Sign in to view it.\nChange which emails you get: ${manageUrl}`;
  return { html, text };
}

/** `subject` is prefixed with the unit's short name, e.g. "DHS — Confirm your email". */
export async function sendMail(to: string, subject: string, title: string, body: string, action?: { label: string; url: string }) {
  const unit = await unitShort();
  const { html, text } = layout(unit, title, body, action);
  await transport().sendMail({ from: fromHeader(env.smtp().from, unit), to, subject: `${unit} — ${subject}`, html, text });
}

export function sendVerificationEmail(to: string, token: string) {
  const url = `${env.appUrl}/verify-email?token=${encodeURIComponent(token)}`;
  return sendMail(to, 'Confirm your email', 'Confirm your email address', 'Confirm your email to continue your registration. The link expires in 24 hours.', {
    label: 'Confirm email',
    url,
  });
}

export function sendPasswordResetEmail(to: string, token: string) {
  const url = `${env.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
  return sendMail(to, 'Password reset', 'Reset your password', 'Someone asked to reset the password for this account. If it was you, use the link below within 1 hour. If not, ignore this email.', {
    label: 'Reset password',
    url,
  });
}

export function sendAlertEmail(to: string, count = 1, urgent = true) {
  const title = count > 1 ? `You have ${count} new items` : 'You have a new item';
  const body = urgent ? `${count > 1 ? `${count} items are` : 'An item is'} waiting for your attention. Sign in to view ${count > 1 ? 'them' : 'it'}.` : `${count > 1 ? `${count} updates have` : 'An update has'} been posted since your last email. Sign in to view ${count > 1 ? 'them' : 'it'}.`;
  return sendMail(to, urgent ? 'Action required' : 'New updates', title, body, {
    label: 'Sign in',
    url: `${env.appUrl}/notifications`,
  });
}

export function sendAccountActivatedEmail(to: string) {
  return sendMail(to, 'Account activated', 'Your account is active', 'An administrator has activated your account. You can now sign in.', {
    label: 'Sign in',
    url: `${env.appUrl}/login`,
  });
}
