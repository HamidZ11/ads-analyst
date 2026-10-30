/*
 * DRAFT — PENDING REVIEW. This privacy policy is a plain-English draft and has
 * not been reviewed by a lawyer. Before launch, confirm: the operator's legal
 * name and address, ICO registration (data protection fee), the Supabase
 * region and hosting provider, backup retention, and the contact address
 * (NEXT_PUBLIC_CONTACT_EMAIL). Keep it true to what the product does.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ContactUs, LegalPage, LegalSection } from "@/features/marketing/legal";
import { marketingMetadata } from "@/features/marketing/seo";

export const metadata: Metadata = marketingMetadata("/privacy");

export default function PrivacyPage() {
  return (
    <LegalPage
      id="privacy-title"
      title="Privacy policy"
      updated="30 October 2026"
      lead="What Ad Analyst stores, why, where it is kept, how long for, and how to have it deleted."
    >
      <LegalSection title="Who we are">
        <p>
          Ad Analyst is run by a sole trader based in the United Kingdom (“we”, “us”). It is a
          service for marketing agencies to analyse their clients’ Meta Ads performance.
        </p>
        <p>
          For your account details we are the controller under UK data protection law. For the
          ad data you import, your agency decides what to upload and why, and we process it on
          your behalf to run the service.
        </p>
        <p>
          For any privacy question or request, <ContactUs />.
        </p>
      </LegalSection>

      <LegalSection title="What we store">
        <ul>
          <li>
            <strong>Your account:</strong> your email address, and technical records of each
            sign-in (such as the time and IP address) kept by our authentication provider.
          </li>
          <li>
            <strong>Your workspace:</strong> its name and who belongs to it.
          </li>
          <li>
            <strong>Your clients:</strong> the client names you enter, their currency, timezone,
            main conversion and any cost or return targets you set.
          </li>
          <li>
            <strong>Imported ad data:</strong> from each Meta Ads CSV export, the names and IDs
            of ad accounts, campaigns, ad sets, ads and creatives, and daily spend, revenue,
            conversions, impressions and clicks.
          </li>
          <li>
            <strong>Import records:</strong> each file’s name, size, row count and date range,
            and who imported it and when. We do not keep the uploaded file itself: it is read,
            checked and turned into the figures above.
          </li>
          <li>
            <strong>Subscription:</strong> if your workspace subscribes, Stripe’s references for
            your customer record and subscription, the plan, monthly or yearly billing, its
            status and renewal date, and a record of each Stripe notification we have processed.
            Your card details go to Stripe and never reach us.
          </li>
          <li>
            <strong>Usage limits:</strong> a counter of how many imports you have made in the
            current hour, to protect the service from overuse.
          </li>
        </ul>
        <p>
          Meta Ads exports report performance in totals and do not normally identify individual
          people. Please do not upload files that contain personal details of individuals, such
          as lead form answers.
        </p>
      </LegalSection>

      <LegalSection title="Why we store it">
        <ul>
          <li>
            To provide Ad Analyst: signing you in, keeping your workspace and showing your
            analysis. This is necessary for our contract with you.
          </li>
          <li>
            To keep the service secure and working, for example limiting imports and
            investigating faults. This is in our legitimate interests and yours.
          </li>
          <li>To answer your questions and requests.</li>
          <li>To keep the business and tax records the law requires if you pay for a plan.</li>
        </ul>
        <p>We do not sell your data, share it for advertising, or use it to train AI models.</p>
      </LegalSection>

      <LegalSection title="Where it is kept">
        <p>
          Your data is stored in a Postgres database run by Supabase, which also handles sign-in
          and sends sign-in emails. Supabase works for us as a data processor under a data
          processing agreement. Our hosting provider serves the site and passes requests to it.
          If you pay for a plan, Stripe processes the payment; we never see or store your card
          details.
        </p>
        <p>
          Where any of these providers handle data outside the UK, they do so under the
          safeguards UK law requires, such as the International Data Transfer Addendum.
        </p>
        <p>
          Inside Ad Analyst, a workspace’s data can only be read by that workspace’s members.
          The database enforces this on every table. We look at your data only when you ask us
          to, to fix a problem, or when the law requires it.
        </p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          Ad Analyst uses only the cookies it needs to work: sign-in cookies that keep you
          signed in, and preference cookies that remember your selected workspace, client and
          date range for up to a year. There are no analytics or advertising cookies, and no
          third-party tracking.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <p>
          We keep your account and workspace data for as long as you use Ad Analyst.
          Re-importing a period replaces the days it covers rather than adding copies. The
          import counter is overwritten every hour.
        </p>
        <p>
          When you ask us to delete your data, we delete your account and your workspace’s
          clients, ad data and import records within one month. Copies in our providers’ backups
          are removed as those backups expire. Payment and subscription records are kept for as
          long as UK tax law requires.
        </p>
      </LegalSection>

      <LegalSection title="Deleting your data">
        <p>
          To have your account or any of your workspace’s data deleted, <ContactUs /> from the
          email address you sign in with. Tell us whether you want everything removed or only a
          particular client. We confirm when it is done.
        </p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>
          You can ask for a copy of the personal data we hold about you, and ask us to correct
          it, delete it, restrict or object to how we use it, or send it to you in a portable
          format. We answer within one month.
        </p>
        <p>
          If an agency uploaded data about your business, please contact the agency first; we
          will help them with your request.
        </p>
        <p>
          If you are unhappy with how we handle your data, you can complain to the Information
          Commissioner’s Office at <a href="https://ico.org.uk">ico.org.uk</a>. We would be
          grateful for the chance to put things right first.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          If we change this policy, we update the date above, and tell signed-in users by email
          about any change that affects how their data is used. This policy sits alongside our{" "}
          <Link href="/terms">terms of service</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
