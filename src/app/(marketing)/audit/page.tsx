import type { Metadata } from "next";
import { AuditTool } from "@/features/audit/audit-tool";
import s from "@/features/audit/audit.module.css";
import { ExportGuide } from "@/features/audit/export-guide";
import { samplePreview } from "@/features/audit/sample-preview";
import { formatInsightValue } from "@/domain/insights";
import { FindingExhibit } from "@/features/marketing/exhibits";
import m from "@/features/marketing/marketing.module.css";
import { marketingMetadata } from "@/features/marketing/seo";
import { cn } from "@/lib/cn";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = marketingMetadata("/audit");

/* The self-serve wasted-spend audit (D-083). The page is static; the export
   is read and analysed by the client component in the visitor's browser. No
   server action, route handler or request ever receives the file. */

export default function AuditPage() {
  const preview = samplePreview();
  return (
    <div className={cn(m.container, s.page)}>
      <div className={s.hero}>
        <header className={s.header}>
          <h1 className={s.h1}>See what your Meta Ads are wasting.</h1>
          <p className={s.lead}>
            Drop in a Meta Ads Manager export and see what Ad Analyst flags: spend with no
            conversions, rising costs, creatives showing fatigue and campaigns worth scaling,
            with the figures behind each. Free, no sign-up, and the file never leaves your
            browser.
          </p>
        </header>
        {preview ? <SamplePreviewFigure preview={preview} /> : null}
      </div>
      <AuditTool guide={<ExportGuide />} email={CONTACT_EMAIL} />
    </div>
  );
}

/* One finding the audit makes in its own sample export, at its own size, in
   the landing hero's compact form (D-NEW-fixes-audit-hero-1). Desktop only:
   below 1024px the drop zone comes straight after the lead. */
function SamplePreviewFigure({
  preview,
}: {
  preview: NonNullable<ReturnType<typeof samplePreview>>;
}) {
  const { finding, currency } = preview;
  const label = `From the sample export, ${finding.entity.name}: ${finding.headline} ${finding.evidence
    .map((item) => `${item.label} ${formatInsightValue(item.value, item.format, currency)}`)
    .join(", ")}. Suggested action: ${finding.action}`;
  return (
    <figure className={s.preview}>
      <figcaption className={s.previewCaption}>
        From the sample export · {preview.accountName}
      </figcaption>
      <div className={s.previewCard} role="img" aria-label={label}>
        <div inert aria-hidden>
          <FindingExhibit
            finding={finding}
            currency={currency}
            currentLabel={preview.currentLabel}
            previousLabel={preview.previousLabel}
            compact
          />
        </div>
      </div>
    </figure>
  );
}
