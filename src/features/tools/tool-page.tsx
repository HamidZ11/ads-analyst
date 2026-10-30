import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import m from "@/features/marketing/marketing.module.css";
import { jsonLd, toolStructuredData } from "@/features/marketing/seo";
import { cn } from "@/lib/cn";
import { APP_HOME, AUDIT_PATH } from "@/lib/routes";
import { Calculator } from "./calculator";
import { TOOLS, toolById, type ToolId } from "./catalog";
import s from "./tools.module.css";

/**
 * The frame every calculator page shares: the title and lead, the calculator
 * beside its formula and explanation, the other tools, and the audit as the
 * one filled call to action (D-NEW-tools-1).
 */
export function ToolPage({ id, children }: { id: ToolId; children: ReactNode }) {
  const tool = toolById(id);
  const others = TOOLS.filter((candidate) => candidate.id !== id);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(toolStructuredData(id)) }}
      />
      <article className={cn(m.container, s.page)} aria-labelledby="tool-title">
        <header className={s.header}>
          <Link href="/tools" className={s.back}>
            <ArrowLeft aria-hidden size={16} strokeWidth={1.75} />
            Free tools
          </Link>
          <h1 id="tool-title" className={s.h1}>
            {tool.name}
          </h1>
          <p className={s.lead}>{tool.summary}</p>
        </header>

        <div className={s.split}>
          <Calculator tool={id} />
          <div className={s.explain}>
            <section aria-labelledby="formula-title">
              <h2 id="formula-title" className={s.h2}>
                The formula
              </h2>
              <p className={s.formula}>{tool.formula}</p>
            </section>
            {children}
          </div>
        </div>

        <nav aria-labelledby="other-tools" className={s.others}>
          <h2 id="other-tools" className={s.h2}>
            Other free tools
          </h2>
          <ToolList tools={others} />
        </nav>
      </article>
      <ToolsCta />
    </>
  );
}

/** A section of a tool's explanation: a 22px heading over prose. */
export function ToolSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={s.section}>
      <h2 className={s.h2}>{title}</h2>
      {children}
    </section>
  );
}

/** Tools as hairline rows: name, summary, formula, and the whole row a link. */
export function ToolList({ tools }: { tools: readonly (typeof TOOLS)[number][] }) {
  return (
    <ul className={s.list}>
      {tools.map((tool) => (
        <li key={tool.id}>
          <Link href={tool.path} className={s.row}>
            <span className={s.rowName}>
              {tool.name}
              <ArrowRight aria-hidden size={18} strokeWidth={1.75} />
            </span>
            <span className={s.rowSummary}>{tool.summary}</span>
            <span className={s.rowFormula}>{tool.formula}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * The tools' closing call to action: the free audit (a page, not a mailto,
 * so it works without a configured contact address) and the demo.
 */
export function ToolsCta() {
  return (
    <section className={cn(m.container, m.cta)} aria-labelledby="tools-cta-title">
      <h2 id="tools-cta-title" className={m.ctaTitle}>
        See what your client accounts are wasting.
      </h2>
      <p className={m.ctaLine}>
        A calculator checks one number. The free wasted-spend audit looks across your clients’
        Meta Ads spend.
      </p>
      <div className={cn(m.actions, m.ctaActions)}>
        <Link href={AUDIT_PATH} className={m.button}>
          Get a free wasted-spend audit
        </Link>
        <Link href={APP_HOME} className={m.textLink}>
          Try the demo
          <ArrowRight aria-hidden size={16} strokeWidth={1.75} />
        </Link>
      </div>
    </section>
  );
}
