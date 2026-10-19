import { requirePage } from '@/lib/auth/guard';
import { Card, PageHeader } from '@/components/ui';
import { MfaSetup } from '@/components/mfa-setup';

export const metadata = { title: 'Sign-in security' };

export default async function SecurityPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const auth = await requirePage();
  const required = (await searchParams).setup === 'required' || auth.mfaSetupRequired;
  return (
    <>
      <PageHeader title="Sign-in security" />
      {required && !auth.user.totpEnabled && (
        <div className="alert-warn">Your appointment requires two-step sign-in. Set it up now to continue using the system.</div>
      )}
      <Card title="Two-step sign-in">
        {auth.user.totpEnabled ? (
          <p>
            Two-step sign-in is <strong>on</strong>. If you lose your phone, ask Admin to reset it.
          </p>
        ) : (
          <MfaSetup />
        )}
      </Card>
    </>
  );
}
