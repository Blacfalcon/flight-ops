import { requirePage } from '@/lib/auth/guard';
import { getSettings } from '@/lib/settings';
import { PageHeader } from '@/components/ui';
import { SettingsForm } from '@/components/settings-form';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  await requirePage('settings.manage');
  const settings = await getSettings();
  return (
    <>
      <PageHeader title="Settings" sub="Changes take effect immediately and are recorded in the audit log." />
      <SettingsForm initial={settings} />
    </>
  );
}
