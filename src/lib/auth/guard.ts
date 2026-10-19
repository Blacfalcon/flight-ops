import 'server-only';
import { redirect, notFound } from 'next/navigation';
import { getAuth, type AuthContext } from './session';
import type { Permission } from '../rbac';

/** For pages: the signed-in person, or a redirect to sign-in. Optionally requires a permission. */
export async function requirePage(perm?: Permission | Permission[]): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) redirect('/login');
  if (perm) {
    const needed = Array.isArray(perm) ? perm : [perm];
    if (!needed.some((p) => auth.perms.has(p))) notFound();
  }
  return auth;
}
