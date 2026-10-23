import { getBranding } from '@/lib/branding';
import { privacyContact } from '@/lib/privacy';

export const metadata = { title: 'Privacy policy' };

const UPDATED = '23 October 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export default async function PrivacyPage() {
  const b = await getBranding();
  const contact = privacyContact();
  const app = `${b.unit.short} Flight Ops`;
  return (
    <div className="card overflow-hidden">
      <div className="card-body flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1>Privacy policy</h1>
          <p className="text-ink-muted">Last updated {UPDATED}</p>
        </div>

        <p>
          {app} is the flight operations app used by {b.unit.name}, {b.unit.location}, to plan and record flying: schedules, aircraft serviceability, mission orders, crew readiness, risk assessments, flight plans and mission reports. It is for authorised unit personnel only. This policy explains what personal data the app holds, why, and what you can do about it. It applies to the website, the installable web app and the Android and iPhone apps.
        </p>

        <Section title="Who is responsible">
          <p>
            The app is run for {b.unit.name}. Questions about your data go to <a href={`mailto:${contact}`}>{contact}</a>. Data is handled in line with the Nigeria Data Protection Act 2023.
          </p>
        </Section>

        <Section title="What we hold">
          <ul className="list-disc pl-6">
            <li>
              <strong>Your account:</strong> rank, full name, service number, appointment, flight status (captain or co-pilot) and pilot category, email address, phone number, and a photo if you add one.
            </li>
            <li>
              <strong>Your flying records:</strong> the sorties you are crewed on, your readiness replies, risk assessments and IMSAFE answers, flight plans, mission reports, snags and safety reports you raise, and approvals you give.
            </li>
            <li>
              <strong>Sign-in and security:</strong> your password (stored only as a secure one-way hash), your two-step sign-in setting, and for each signed-in session the device type, IP address and times.
            </li>
            <li>
              <strong>Phone alerts:</strong> if you turn on notifications, a technical address for your phone or browser so alerts can reach it.
            </li>
            <li>
              <strong>Activity log:</strong> a record of actions taken in the app (who did what, and when), kept for accountability and safety.
            </li>
          </ul>
          <p>The app does not use advertising, does not track you across other apps or websites, and does not collect your location.</p>
        </Section>

        <Section title="Cookies and storage on your device">
          <p>The app only uses what it needs to work. There are no advertising, analytics or tracking cookies, so there is nothing to opt out of.</p>
          <ul className="list-disc pl-6">
            <li>
              <strong>Sign-in cookies:</strong> one keeps you signed in for 15 minutes at a time, one renews that for up to 7 days, and one remembers for the day that you completed two-step sign-in. They cannot be read by page scripts and are never sent to other sites.
            </li>
            <li>
              <strong>Offline storage:</strong> the app keeps a copy of your own schedule and any changes made while offline on your device, so it works with a poor signal. It is cleared when you sign out.
            </li>
          </ul>
        </Section>

        <Section title="Why we use it">
          <p>
            Only to run flying operations safely: to know who is crewed and ready, to route approvals to the right appointment, to keep aircraft hours and inspections correct, to send you alerts about your duties, and to produce summaries for the chain of command. Your data is never sold.
          </p>
        </Section>

        <Section title="Who can see it">
          <ul className="list-disc pl-6">
            <li>People in the unit who need it for their appointment, as set by the app&apos;s access rules. For example, the Safety Officer sees risk assessments; pilots see their own sorties.</li>
            <li>
              The services that carry the app: the hosting provider that runs the server, the email service that sends alert emails, and Google (Firebase Cloud Messaging) and Apple, which deliver phone notifications. Alert emails and phone notifications only tell you to sign in; they carry no operational details.
            </li>
            <li>No one else, unless the law requires it.</li>
          </ul>
        </Section>

        <Section title="How it is protected">
          <p>
            All traffic is encrypted (HTTPS). Accounts are activated by the unit Admin. Commander, GOO and Admin accounts use two-step sign-in. Repeated wrong passwords lock the account for a while, and idle sessions end automatically. Each unit runs its own separate copy, so units cannot see each other&apos;s data.
          </p>
        </Section>

        <Section title="How long it is kept">
          <p>
            Your account details are kept while you hold an account. Flying records, approvals and the activity log are official unit records and are kept for as long as the unit requires. Notifications and session records are cleared regularly.
          </p>
        </Section>

        <Section title="Your choices and rights">
          <ul className="list-disc pl-6">
            <li>See your details on <em>My profile</em>. Change your phone number there; rank, appointment and flight status changes go to Admin for approval.</li>
            <li>Choose which alerts reach you by email, and turn phone notifications on or off.</li>
            <li>
              Delete your account in the app (<em>My profile → Delete my account</em>) or on the <a href="/delete-account">account deletion page</a>. Your email, phone, photo, password and alert devices are deleted; your rank, name and service number stay on unit records you took part in.
            </li>
            <li>
              Ask for a copy of your data, or for a correction, by writing to <a href={`mailto:${contact}`}>{contact}</a>.
            </li>
          </ul>
        </Section>

        <Section title="Children">
          <p>The app is only for serving unit personnel and is not meant for anyone under 18.</p>
        </Section>

        <Section title="Changes to this policy">
          <p>If this policy changes, the new version is posted here with a new date. See also the <a href="/terms">conditions of use</a>.</p>
        </Section>
      </div>
    </div>
  );
}
