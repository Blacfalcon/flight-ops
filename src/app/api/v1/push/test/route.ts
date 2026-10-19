import { forbidden, route } from '@/lib/api';
import { pushToUser } from '@/lib/push';
import { getSettings } from '@/lib/settings';

export const POST = route({}, async ({ auth }) => {
  const { unit } = await getSettings();
  const sent = await pushToUser(auth.user.id, { title: 'Test notification', body: 'Phone notifications are working.', link: '/me', tag: 'test' }, unit.short);
  if (!sent) throw forbidden('No phone is registered for notifications yet, or push is not set up on the server.');
  return { sent };
});
