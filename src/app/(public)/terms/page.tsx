import { getBranding } from '@/lib/branding';
import { privacyContact } from '@/lib/privacy';

export const metadata = { title: 'Conditions of Use' };

const UPDATED = '23 October 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export default async function TermsPage() {
  const b = await getBranding();
  const contact = privacyContact();
  const app = `${b.unit.short} Flight Ops`;
  return (
    <div className="card overflow-hidden">
      <div className="card-body flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1>Conditions of Use</h1>
          <p className="text-ink-muted">Last updated {UPDATED}</p>
        </div>

        <p>
          {app} is the flight operations app of {b.unit.name}, {b.unit.location}. By creating an account or signing in you agree to these conditions. They apply to the website, the installable web app and the Android and iPhone apps.
        </p>

        <Section title="Who May Use It">
          <ul className="list-disc pl-6">
            <li>Only serving personnel authorised by the unit, aged 18 or over. Every account is activated by the unit Admin, who may refuse or suspend it.</li>
            <li>Use your own account only. Do not share your password, two-step sign-in codes or a signed-in device.</li>
            <li>Register with your true rank, name, service details and appointment, and keep them up to date.</li>
          </ul>
        </Section>

        <Section title="How You Must Use It">
          <ul className="list-disc pl-6">
            <li>Enter information that is accurate and complete. Approvals, readiness replies, risk assessments and reports you submit are official records made in your name.</li>
            <li>Only view or change what your appointment requires. Do not try to reach other people&apos;s data, get round the access rules, or disrupt the service.</li>
            <li>Do not copy, photograph or pass operational information outside the people entitled to it.</li>
            <li>Tell the unit Admin at once if you think your account or device has been compromised, or if you lose a phone signed in to the app.</li>
          </ul>
        </Section>

        <Section title="It Supports, and Does Not Replace, Orders and Procedures">
          <p>
            The app helps plan and record flying. It does not replace the unit&apos;s orders, regulations, flying supervision or the judgement of the aircraft captain and the authorising officer. If the app and an official order disagree, the order applies. If the app is unavailable, use the unit&apos;s standing manual procedures.
          </p>
        </Section>

        <Section title="Records and Monitoring">
          <p>
            Actions in the app are logged with who did what and when, and the log cannot be changed. The unit may review it for safety, accountability and discipline. Misuse may lead to the account being suspended and to action under service regulations.
          </p>
        </Section>

        <Section title="Availability">
          <p>The unit aims to keep the app running but does not promise it will always be available or free of faults. Planned maintenance is announced in advance where possible.</p>
        </Section>

        <Section title="Your Data">
          <p>
            How your personal data is used is set out in the <a href="/privacy">privacy policy</a>. You can delete your account at any time from <em>My profile</em> or on the <a href="/delete-account">account deletion page</a>.
          </p>
        </Section>

        <Section title="Changes and Questions">
          <p>
            If these conditions change, the new version is posted here with a new date. Questions go to the unit Admin or <a href={`mailto:${contact}`}>{contact}</a>.
          </p>
        </Section>
      </div>
    </div>
  );
}
