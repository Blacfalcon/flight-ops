import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PwaRegister } from '@/components/pwa-register';
import { Watermark } from '@/components/logo';
import { getBranding } from '@/lib/branding';

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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        {children}
        <Watermark version={b.watermarkVersion} />
        <PwaRegister />
      </body>
    </html>
  );
}
