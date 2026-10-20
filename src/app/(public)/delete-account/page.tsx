import { getBranding } from '@/lib/branding';
import { PublicDeleteForm } from '@/components/delete-account';
import { privacyContact } from '@/lib/privacy';

export const metadata = { title: 'Delete your account' };

export default async function DeleteAccountPage() {
  const b = await getBranding();
  const contact = privacyContact();
  return (
    <div className="card overflow-hidden">
      <div className="card-body flex flex-col gap-5">
        <h1>Delete your Flight Ops account</h1>
        <p>
          This page is for people with an account on <strong>{b.unit.short} Flight Ops</strong>, the flight operations app for {b.unit.name}. You can also do this in the app: <em>My profile → Delete my account</em>.
        </p>
        <div className="flex flex-col gap-2">
          <h2>What is deleted</h2>
          <ul className="list-disc pl-6">
            <li>Your email address, phone number and photo</li>
            <li>Your password and two-step sign-in setting</li>
            <li>Your signed-in sessions, phones registered for alerts, and your notifications</li>
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          <h2>What is kept, and why</h2>
          <p>
            Your rank, name and service number stay on the flights, mission orders, risk assessments, approvals and reports you took part in. These are official unit records and the unit must keep them. The activity log is also kept. Nothing else is linked to you, and the account can never sign in again.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <h2>How long it takes</h2>
          <p>Admin approves the request, normally within 7 days. If you cannot sign in (for example you have forgotten your password), reset it first, or email {contact} from the email address on your account.</p>
        </div>
        <div className="h-px bg-line" />
        <PublicDeleteForm />
      </div>
    </div>
  );
}
