import { VerifyEmail } from './verify';

export const metadata = { title: 'Confirm email' };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { token } = await searchParams;
  return <VerifyEmail token={token ?? ''} />;
}
