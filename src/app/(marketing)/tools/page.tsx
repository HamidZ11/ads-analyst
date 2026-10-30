import type { Metadata } from "next";
import { jsonLd, marketingMetadata, toolsIndexStructuredData } from "@/features/marketing/seo";
import m from "@/features/marketing/marketing.module.css";
import { TOOLS } from "@/features/tools/catalog";
import { ToolList, ToolsCta } from "@/features/tools/tool-page";
import s from "@/features/tools/tools.module.css";
import { cn } from "@/lib/cn";

export const metadata: Metadata = marketingMetadata("/tools");

/* The free tools index (D-095): three calculators, each a row with
   its formula, then the audit. */
export default function ToolsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(toolsIndexStructuredData()) }}
      />
      <article className={cn(m.container, s.page)} aria-labelledby="tools-title">
        <header className={s.header}>
          <h1 id="tools-title" className={s.h1}>
            Free ad calculators
          </h1>
          <p className={s.lead}>
            Three quick checks for paid social accounts. Each works in your browser as you type,
            in pounds, dollars or euros, and shows the formula behind the answer.
          </p>
        </header>
        <ToolList tools={TOOLS} />
      </article>
      <ToolsCta />
    </>
  );
}
