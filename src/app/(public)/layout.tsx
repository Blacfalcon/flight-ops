import { Logo } from '@/components/logo';
import { getBranding } from '@/lib/branding';

// Public pages that must open without signing in (privacy policy, conditions of use, account deletion).
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const b = await getBranding();
  return (
    <div className="min-h-screen bg-ground">
      <header className="bg-navy px-6 py-5 text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          <Logo size={48} version={b.logoVersion} className="rounded-lg bg-white p-1" />
          <div>
            <div className="text-[18px] font-bold">{b.unit.short} Flight Ops</div>
            <div className="text-[13px] text-navy-muted">{b.unit.name}</div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">{children}</main>
      <footer className="mx-auto flex max-w-3xl flex-wrap gap-4 px-6 pb-8 text-[13px] text-ink-muted">
        <a href="/privacy">Privacy policy</a>
        <a href="/terms">Conditions of use</a>
        <a href="/delete-account">Delete your account</a>
        <a href="/login">Sign in</a>
      </footer>
    </div>
  );
}
