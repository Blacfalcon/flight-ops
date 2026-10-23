import { ResetForm } from './reset-form';

export const metadata = { title: 'New Password' };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { token } = await searchParams;
  return <ResetForm token={token ?? ''} />;
}
