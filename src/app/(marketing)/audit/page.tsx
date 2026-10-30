import type { Metadata } from "next";
import { AuditTool } from "@/features/audit/audit-tool";
import s from "@/features/audit/audit.module.css";
import { ExportGuide } from "@/features/audit/export-guide";
import m from "@/features/marketing/marketing.module.css";
import { marketingMetadata } from "@/features/marketing/seo";
import { cn } from "@/lib/cn";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = marketingMetadata("/audit");

/* The self-serve wasted-spend audit (D-083). The page is static; the export
   is read and analysed by the client component in the visitor's browser. No
   server action, route handler or request ever receives the file. */

export default function AuditPage() {
  return (
    <div className={cn(m.container, s.page)}>
      <header className={s.header}>
        <h1 className={s.h1}>See what your Meta Ads are wasting.</h1>
        <p className={s.lead}>
          Drop in a Meta Ads Manager export and see what Ad Analyst flags: spend with no
          conversions, rising costs, creatives showing fatigue and campaigns worth scaling, with
          the figures behind each. Free, no sign-up, and the file never leaves your browser.
        </p>
      </header>
      <AuditTool guide={<ExportGuide />} email={CONTACT_EMAIL} />
    </div>
  );
}
