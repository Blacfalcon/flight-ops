import { z } from 'zod';
import { invalid, route } from '@/lib/api';
import { getSettings, setSetting, settingSchemas, type SettingKey } from '@/lib/settings';
import { audit } from '@/lib/audit';

export const GET = route({ perm: 'settings.manage' }, async () => getSettings());

const patchSchema = z.record(z.string(), z.unknown());

export const PATCH = route({ perm: 'settings.manage', schema: patchSchema }, async ({ auth, body }) => {
  const before = await getSettings();
  // Check everything first so a mistake in one section saves nothing
  const fields: Record<string, string> = {};
  const parsed: Array<[SettingKey, unknown]> = [];
  for (const [key, value] of Object.entries(body)) {
    if (!(key in settingSchemas)) continue;
    const r = settingSchemas[key as SettingKey].safeParse(value);
    if (r.success) parsed.push([key as SettingKey, r.data]);
    else for (const issue of r.error.issues) fields[[key, ...issue.path].join('.')] ??= issue.message;
  }
  if (Object.keys(fields).length) throw invalid('Some settings need attention.', fields);
  for (const [key, value] of parsed) await setSetting(key, value as never);
  const after = await getSettings();
  await audit(auth.user.id, 'settings.update', 'settings', null, { before, after });
  return after;
});
