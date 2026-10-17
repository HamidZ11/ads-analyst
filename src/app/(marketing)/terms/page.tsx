/*
 * DRAFT — PENDING REVIEW. These terms are a plain-English draft and have not
 * been reviewed by a lawyer. Before launch, confirm: the operator's legal name
 * and address, VAT treatment, the billing, cancellation and refund rules once
 * Stripe billing exists, the liability cap, and the contact address
 * (NEXT_PUBLIC_CONTACT_EMAIL). Keep it true to what the product does.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ContactUs, LegalPage, LegalSection } from "@/features/marketing/legal";
import { marketingMetadata } from "@/features/marketing/seo";

export const metadata: Metadata = marketingMetadata("/terms");

export default function TermsPage() {
  return (
    <LegalPage
      id="terms-title"
      title="Terms of service"
      updated="17 October 2026"
      lead="The agreement between your business and Ad Analyst: what we provide, what we expect, and what happens if things go wrong."
    >
      <LegalSection title="About these terms">
        <p>
          Ad Analyst is run by a sole trader based in the United Kingdom (“we”, “us”). These
          terms apply when your business (“you”) uses Ad Analyst. Ad Analyst is for business
          use; by signing in you confirm you are using it for your business or your agency’s
          clients.
        </p>
        <p>
          How we handle data is set out in our <Link href="/privacy">privacy policy</Link>.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <ul>
          <li>You sign in with a one-time link sent to your email address.</li>
          <li>
            Keep access to that email address secure. You are responsible for what happens in
            your workspace.
          </li>
          <li>Tell us straight away if you think someone else has access to your account.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Your data">
        <p>
          You own the data you import. You give us permission to store and process it only to
          run Ad Analyst for you. You confirm you have the right to upload it, including any
          permission you need from your clients.
        </p>
        <p>
          Do not upload files containing personal details of individuals, or anything you are
          not allowed to share.
        </p>
      </LegalSection>

      <LegalSection title="What Ad Analyst does">
        <p>
          Ad Analyst calculates performance figures and findings from the data you import. They
          are information to help your decisions, not advice. Decisions and changes in your ad
          accounts stay with you. Figures are only as accurate as the export they come from, so
          check anything important against Meta Ads Manager.
        </p>
        <p>Ad Analyst is not made, endorsed or supported by Meta.</p>
      </LegalSection>

      <LegalSection title="Plans and payment">
        <ul>
          <li>
            The Agency plan covers up to 10 client accounts at the price on our{" "}
            <Link href="/pricing">pricing page</Link>, paid monthly or yearly in advance. Prices
            are in pounds sterling.
          </li>
          <li>Enterprise, for more than 10 client accounts, is priced by agreement.</li>
          <li>
            You can cancel at any time. Your plan then runs to the end of the period you have
            paid for, and is not renewed. We do not refund part periods unless the law requires
            it.
          </li>
          <li>We tell you at least 30 days before a price change applies to you.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Fair use">
        <p>You agree not to:</p>
        <ul>
          <li>try to reach another workspace’s data, or get around usage limits;</li>
          <li>attack, overload or disrupt the service, or probe it for weaknesses;</li>
          <li>copy or resell Ad Analyst, or access to it, without our written agreement.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Availability and changes">
        <p>
          We work to keep Ad Analyst available and accurate, but cannot promise it will be
          uninterrupted or free of errors. We may improve, change or remove features. If a
          change takes away something important to your plan, we will tell you in advance.
        </p>
      </LegalSection>

      <LegalSection title="Ending the agreement">
        <p>
          You can stop using Ad Analyst at any time and ask us to delete your data. We may
          suspend or close an account that breaks these terms or is not paid for, with notice
          where that is reasonable. When an account closes, its data is deleted as described in
          the privacy policy.
        </p>
      </LegalSection>

      <LegalSection title="Liability">
        <p>
          Nothing in these terms limits our liability for death or personal injury caused by our
          negligence, for fraud, or for anything else the law does not allow us to limit.
        </p>
        <p>
          Otherwise, we are not liable for lost profits, revenue, ad spend, business or data, or
          for indirect losses. Our total liability to you in any 12 months is limited to what
          you paid us for Ad Analyst in those 12 months.
        </p>
      </LegalSection>

      <LegalSection title="Changes to these terms">
        <p>
          We may update these terms. We tell you by email before a significant change takes
          effect; if you keep using Ad Analyst after that, the new terms apply.
        </p>
      </LegalSection>

      <LegalSection title="Law and contact">
        <p>
          These terms are governed by the law of England and Wales, and the courts of England
          and Wales deal with any dispute. For any question about them, <ContactUs />.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
