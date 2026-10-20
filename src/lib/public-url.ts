/**
 * Absolute address for redirects. Behind the tunnel or a proxy the server can see itself as
 * http://localhost:3000, so redirects use the public address in APP_URL when it is set.
 * No server-only imports: also used by the middleware.
 */
export function publicUrl(path: string, req: { url: string }): URL {
  const base = (process.env.APP_URL ?? '').trim().replace(/\/$/, '');
  return new URL(path, base ? `${base}/` : req.url);
}
