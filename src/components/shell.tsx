'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Logo } from './logo';
import { Avatar } from './avatar';
import { NativePushBridge, PushPrompt } from './phone-push';
import { disablePush } from '@/lib/client/push';
import { listOutbox } from '@/lib/client/outbox';

export type NavItem = { href: string; label: string; show: boolean; badge?: number };

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

function useOutboxCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const load = () => listOutbox().then((i) => setCount(i.length)).catch(() => setCount(0));
    load();
    window.addEventListener('outbox-changed', load);
    window.addEventListener('online', load);
    return () => {
      window.removeEventListener('outbox-changed', load);
      window.removeEventListener('online', load);
    };
  }, []);
  return count;
}

function useRefused() {
  const [items, setItems] = useState<Array<{ label: string; message: string }>>([]);
  useEffect(() => {
    const on = (e: Event) => setItems((e as CustomEvent).detail);
    window.addEventListener('outbox-refused', on);
    return () => window.removeEventListener('outbox-refused', on);
  }, []);
  return [items, () => setItems([])] as const;
}

async function signOut() {
  try {
    // Stop this device receiving the signed-out person's notifications
    await disablePush().catch(() => undefined);
    try {
      localStorage.removeItem('push-prompt-dismissed');
    } catch {
      // ignore
    }
    await fetch('/api/v1/auth/logout', { method: 'POST' });
  } finally {
    navigator.serviceWorker?.controller?.postMessage('clear-user-data');
    window.location.href = '/login';
  }
}

export function Shell({
  nav,
  user,
  unit,
  logoVersion,
  unread,
  isPilot,
  children,
}: {
  nav: NavItem[];
  user: { id: string; name: string; fullName: string; role: string; photoUpdatedAt: string | null };
  unit: { short: string; location: string };
  logoVersion: number;
  unread: number;
  isPilot: boolean;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const online = useOnline();
  const waiting = useOutboxCount();
  const [refused, clearRefused] = useRefused();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [path]);

  // Opening a notification's link marks it read
  useEffect(() => {
    const url = new URL(window.location.href);
    const n = url.searchParams.get('n');
    if (!n) return;
    fetch('/api/v1/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [n] }) }).catch(() => undefined);
    url.searchParams.delete('n');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }, [path]);

  const active = (href: string) => path === href || (href !== '/dashboard' && path.startsWith(`${href}/`)) || path === href.split('?')[0];

  const links = nav.map((n) => (
    <a
      key={n.href}
      href={n.href}
      aria-current={active(n.href) ? 'page' : undefined}
      className={`flex items-center justify-between rounded-lg px-3 py-2.5 no-underline ${active(n.href) ? 'bg-navy-3 font-semibold text-white' : 'text-navy-text hover:bg-navy-2 hover:text-white'}`}
    >
      <span>{n.label}</span>
      {!!n.badge && <span className="rounded-full bg-warn-edge px-2 text-[12px] font-bold text-navy">{n.badge}</span>}
    </a>
  ));

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      {/* Desktop sidebar */}
      <nav aria-label="Main" className="hidden w-[240px] shrink-0 flex-col gap-0.5 bg-navy px-3 py-5 lg:flex">
        <a href="/dashboard" className="mb-4 flex items-center gap-2.5 px-2.5 py-1 no-underline">
          <Logo size={40} version={logoVersion} />
          <span>
            <span className="block text-[16px] font-bold text-white">{unit.short}</span>
            <span className="block text-[12px] text-navy-muted">Flight Ops · {unit.location}</span>
          </span>
        </a>
        {links}
        <div className="mt-auto flex flex-col gap-1 border-t border-navy-line px-2.5 pt-4">
          <a href="/me" className="flex items-center gap-2.5 font-semibold text-white no-underline hover:text-white">
            <Avatar user={{ id: user.id, fullName: user.fullName, photoUpdatedAt: user.photoUpdatedAt }} size={34} />
            <span>
              {user.name}
              <span className="block text-[12px] font-normal text-navy-muted">{user.role}</span>
            </span>
          </a>
          <button onClick={signOut} className="mt-2 self-start text-[13px] font-semibold text-navy-text hover:text-white">
            Sign out
          </button>
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex items-center gap-3 bg-navy px-4 py-3 text-white lg:static lg:bg-transparent lg:px-8 lg:pt-6 lg:text-ink">
          <button
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-navy-3 lg:hidden"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <span className="flex items-center gap-2 font-bold lg:hidden">
            <Logo size={28} version={logoVersion} />
            {unit.short} Ops
          </span>
          <div className="ml-auto flex items-center gap-2">
            {!online ? (
              <span className="pill-warn">Offline{waiting ? ` · ${waiting} waiting to sync` : ''}</span>
            ) : waiting ? (
              <span className="pill-warn">{waiting} waiting to sync</span>
            ) : (
              <span className="hidden items-center gap-1.5 rounded-full bg-good-bg px-3 py-1 text-[13px] font-medium text-good-fg sm:inline-flex">
                <span className="h-2 w-2 rounded-full bg-good-solid" />
                Online
              </span>
            )}
            <a
              href="/notifications"
              aria-label={`Notifications, ${unread} unread`}
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/20 bg-navy-3 text-white no-underline lg:border-line lg:bg-white lg:text-ink"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10 21h4" />
              </svg>
              {unread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-bad-solid px-1.5 text-[11px] font-bold text-white">{unread}</span>}
            </a>
          </div>
        </header>

        {/* Mobile menu */}
        {open && (
          <nav aria-label="Main" className="flex flex-col gap-0.5 bg-navy px-3 pb-4 lg:hidden">
            {links}
            <div className="mt-2 flex items-center justify-between border-t border-navy-line px-3 pt-3 text-navy-text">
              <a href="/me" className="text-white no-underline">
                {user.name}
              </a>
              <button onClick={signOut} className="text-[13px] font-semibold">
                Sign out
              </button>
            </div>
          </nav>
        )}

        <PushPrompt />
        <NativePushBridge />

        {refused.length > 0 && (
          <div role="alert" className="mx-4 mt-4 rounded-lg bg-bad-bg px-4 py-3 text-[#7A1A14] lg:mx-8">
            <div className="font-semibold">Some items saved offline were not accepted:</div>
            <ul className="ml-5 list-disc">
              {refused.map((r, i) => (
                <li key={i}>
                  {r.label}: {r.message}
                </li>
              ))}
            </ul>
            <button className="mt-2 text-[13px] font-semibold underline" onClick={clearRefused}>
              Dismiss
            </button>
          </div>
        )}

        <main id="main" tabIndex={-1} className={`flex flex-col gap-6 outline-none px-4 py-6 lg:px-8 lg:pb-10 lg:pt-4 ${isPilot ? 'pb-24' : ''}`}>{children}</main>

        {/* Pilot tab bar on phones */}
        {isPilot && (
          <nav aria-label="App" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
            {[
              { href: '/dashboard', label: 'Today' },
              { href: '/missions', label: 'Missions' },
              { href: '/flight-plans', label: 'Plans' },
              { href: '/weather', label: 'Weather' },
              { href: '/me', label: 'Me' },
            ].map((t) => (
              <a
                key={t.href}
                href={t.href}
                aria-current={active(t.href) ? 'page' : undefined}
                className={`flex h-14 items-center justify-center text-[12px] no-underline ${active(t.href) ? 'font-bold text-brand' : 'text-ink-muted'}`}
              >
                {t.label}
              </a>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
