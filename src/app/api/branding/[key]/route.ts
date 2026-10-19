import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';

// Public: the unit logo and the page watermark (also shown on the sign-in page).
// Admin uploads replace them; otherwise the built-in images in public/brand are used.
const KEYS = new Set(['logo', 'watermark']);

export async function GET(_req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  if (!KEYS.has(key)) return new NextResponse('Not found', { status: 404 });
  const headers = { 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' };
  try {
    const asset = await db.asset.findUnique({ where: { key } });
    if (asset) return new Response(Buffer.from(asset.data), { headers: { ...headers, 'Content-Type': asset.mime } });
  } catch {
    // fall through to the built-in image
  }
  const file = await readFile(path.join(process.cwd(), 'public', 'brand', `${key}.png`));
  return new Response(file, { headers: { ...headers, 'Content-Type': 'image/png' } });
}
