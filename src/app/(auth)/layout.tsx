import { Logo } from '@/components/logo';
import { getBranding } from '@/lib/branding';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const b = await getBranding();
  return (
    <div className="flex min-h-screen flex-col bg-ground lg:flex-row">
      <header className="flex flex-col items-start gap-4 bg-navy px-7 pb-9 pt-12 text-white lg:w-[420px] lg:justify-center lg:px-12">
        <Logo size={112} version={b.logoVersion} className="rounded-xl bg-white p-1.5" />
        <div>
          <div className="text-[26px] font-bold">{b.unit.short} Flight Ops</div>
          <div className="text-navy-muted">
            {b.unit.name} · {b.unit.location}
          </div>
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-6 py-8 lg:items-center">
        <div className="w-full max-w-md">{children}</div>
      </main>
      <footer className="px-6 pb-6 text-center text-[12px] text-ink-muted lg:hidden">Authorised personnel only. All activity is logged.</footer>
    </div>
  );
}
