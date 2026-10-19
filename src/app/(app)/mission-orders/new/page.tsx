import { redirect } from 'next/navigation';

// Mission orders are raised together with the sortie on the schedule.
export default async function NewOrderPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  redirect(sp.missionId ? `/missions/${sp.missionId}/edit` : '/schedule/new');
}
