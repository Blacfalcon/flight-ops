import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import './globals.css';
import { PwaRegister } from '@/components/pwa-register';
import { Watermark } from '@/components/logo';
import { getBranding } from '@/lib/branding';

// Fonts are downloaded at build time and served from this site, so no request goes to Google.
const plexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-plex-sans', display: 'swap' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['500'], variable: '--font-plex-mono', display: 'swap' });

// Unit name and images come from Settings, so pages are rendered per request.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { unit } = await getBranding();
  return {
    title: { default: `${unit.short} Flight Ops`, template: `%s · ${unit.short} Ops` },
    description: `Flight operations management for ${unit.name}, ${unit.location}`,
    manifest: '/manifest.webmanifest',
    icons: { icon: '/icons/favicon-32.png', apple: '/icons/apple-touch-icon.png' },
    appleWebApp: { capable: true, title: `${unit.short} Ops`, statusBarStyle: 'black-translucent' },
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: '#0B1F3A',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const b = await getBranding();
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>
        {children}
        <Watermark version={b.watermarkVersion} />
        <PwaRegister />
      </body>
    </html>
  );
}
