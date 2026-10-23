import { requirePage } from '@/lib/auth/guard';
import { Card, PageHeader } from '@/components/ui';
import { MfaSetup } from '@/components/mfa-setup';

export const metadata = { title: 'Sign-In Security' };

export default async function SecurityPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const auth = await requirePage();
  const required = (await searchParams).setup === 'required' || auth.mfaSetupRequired;
  return (
    <>
      <PageHeader title="Sign-In Security" />
      {required && !auth.user.totpEnabled && (
        <div className="alert-warn">Your appointment requires two-step sign-in. Set it up now to continue using the system.</div>
      )}
      <Card title="Two-Step Sign-In">
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
