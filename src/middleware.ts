import { NextResponse, type NextRequest } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE, verifyAccessToken } from '@/lib/auth/jwt';
import { publicUrl } from '@/lib/public-url';

// Page protection. API routes check sign-in themselves (they return 401 rather than redirecting).
const PUBLIC = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password', '/offline', '/privacy', '/delete-account'];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();

  const claims = await verifyAccessToken(req.cookies.get(ACCESS_COOKIE)?.value);
  if (claims) {
    // Pass the path on so the app layout can enforce two-step sign-in setup
    const headers = new Headers(req.headers);
    headers.set('x-pathname', pathname);
    return NextResponse.next({ request: { headers } });
  }

  const next = encodeURIComponent(pathname + search);
  if (req.cookies.get(REFRESH_COOKIE)?.value) {
    return NextResponse.redirect(publicUrl(`/api/v1/auth/refresh?next=${next}`, req));
  }
  return NextResponse.redirect(publicUrl(`/login?next=${next}`, req));
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|icons|brand|favicon.ico|manifest.webmanifest|sw.js|robots.txt).*)'],
};
