import type { MetadataRoute } from 'next';
import { getBranding } from '@/lib/branding';

export const dynamic = 'force-dynamic';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { unit } = await getBranding();
  return {
    name: `${unit.short} Flight Ops`,
    short_name: `${unit.short} Ops`.slice(0, 12),
    description: `Flight operations management for ${unit.name}, ${unit.location}`,
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#F3F6FA',
    theme_color: '#0B1F3A',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
