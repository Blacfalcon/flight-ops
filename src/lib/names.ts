// People's names: stored as first name, optional middle name and surname, plus the joined full name
// that the rest of the app displays ("Flt Lt Chinedu Emeka Okeke").

export function joinName(first: string, middle: string | null | undefined, surname: string): string {
  return [first, middle, surname]
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

/** Best-effort split of a single full name: first word, last word, anything in between. */
export function splitName(full: string): { firstName: string; middleName: string | null; surname: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] ?? '', middleName: null, surname: '' };
  return { firstName: parts[0], middleName: parts.slice(1, -1).join(' ') || null, surname: parts[parts.length - 1] };
}
