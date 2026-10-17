import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { CONTACT_EMAIL } from "@/lib/site";
import s from "./legal.module.css";
import m from "./marketing.module.css";

/** The shared frame for the privacy policy and terms: title, date, lead, sections. */
export function LegalPage({
  id,
  title,
  updated,
  lead,
  children,
}: {
  id: string;
  title: string;
  updated: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <article className={cn(m.container, s.page)} aria-labelledby={id}>
      <header className={s.header}>
        <h1 id={id} className={s.h1}>
          {title}
        </h1>
        <p className={s.updated}>Last updated {updated}</p>
        <p className={s.lead}>{lead}</p>
      </header>
      <div className={s.body}>{children}</div>
    </article>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={s.section}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

/**
 * "email us at <address>" when a contact address is configured; otherwise
 * "contact us", with no link, so the page never shows a dead mailto.
 */
export function ContactUs({ email = CONTACT_EMAIL }: { email?: string | null }) {
  if (!email) return <>contact us</>;
  return (
    <>
      email us at <a href={`mailto:${email}`}>{email}</a>
    </>
  );
}
