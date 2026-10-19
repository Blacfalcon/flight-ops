'use client';

// Browser-side helper for calling the API: refreshes the session once on 401 and surfaces field errors.

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;

async function refresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'same-origin' })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        setTimeout(() => (refreshing = null), 1000);
      });
  }
  return refreshing;
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const doFetch = () =>
    fetch(path.startsWith('/') ? path : `/api/v1/${path}`, {
      method: opts.method ?? (opts.body || opts.form ? 'POST' : 'GET'),
      credentials: 'same-origin',
      headers: opts.form ? undefined : { 'Content-Type': 'application/json' },
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    });

  let res = await doFetch();
  if (res.status === 401 && !path.includes('/auth/')) {
    if (await refresh()) res = await doFetch();
    else {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
      throw new ApiClientError(401, 'unauthenticated', 'Please sign in again.');
    }
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const e = data?.error ?? {};
    throw new ApiClientError(res.status, e.code ?? 'error', e.message ?? 'Something went wrong.', e.fields ?? {});
  }
  return data as T;
}

/** True when the failure was the network, not the server saying no */
export function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError || (typeof navigator !== 'undefined' && !navigator.onLine);
}
