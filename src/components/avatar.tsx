// Personnel photo, or initials when no photo has been added. Works in server and client components.

type Person = { id: string; fullName: string; photoUpdatedAt?: Date | string | null };

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

export function photoUrl(p: Person): string | null {
  if (!p.photoUpdatedAt) return null;
  const v = new Date(p.photoUpdatedAt).getTime();
  return `/api/v1/users/${p.id}/photo?v=${v}`;
}

export function Avatar({ user, size = 36, className = '' }: { user: Person; size?: number; className?: string }) {
  const url = photoUrl(user);
  const style = { width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.38)) };
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={size} style={style} className={`shrink-0 rounded-full border border-line bg-white object-cover ${className}`} />;
  }
  return (
    <span aria-hidden="true" style={style} className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[#DCE6F5] font-semibold text-navy ${className}`}>
      {initials(user.fullName)}
    </span>
  );
}

export const CrewAvatar = Avatar;
