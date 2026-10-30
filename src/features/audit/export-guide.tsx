import s from "./audit.module.css";

/**
 * How to export from Ads Manager, limited to what was verified (D-083):
 * Reports › Export table data is Meta's own wording; the Ads tab, the Day
 * breakdown and the CSV choice come from consistent third-party guides and
 * the column names Ads Manager writes. Nothing here guesses at a menu.
 */
export const EXPORT_STEPS = [
  {
    title: "Open the Ads tab",
    body: "Each row must be one ad. Campaign and ad set exports can’t show which ads are spending.",
  },
  {
    title: "Pick at least the last 14 days",
    body: "The audit compares the later half of the file with the earlier half, so 14 days gives two weeks.",
  },
  {
    title: "Choose Breakdown › By time › Day",
    body: "One row per ad per day.",
  },
  {
    title: "Check the columns",
    body: "Campaign name, Ad set name, Ad name, Amount spent, Impressions, Link clicks, and Purchases or Leads. For ROAS, Purchases conversion value too. Add any that are missing from the Columns menu.",
  },
  {
    title: "Export as CSV",
    body: "Reports › Export table data, then CSV. Drop the file here as it downloads: opening and saving it in a spreadsheet can change dates and round IDs.",
  },
] as const;

export function ExportGuide() {
  return (
    <section className={s.guide} aria-labelledby="export-guide-title">
      <h2 id="export-guide-title" className={s.guideTitle}>
        How to export from Ads Manager
      </h2>
      <ol className={s.steps}>
        {EXPORT_STEPS.map((step) => (
          <li key={step.title}>
            <p className={s.stepTitle}>{step.title}</p>
            <p className={s.stepBody}>{step.body}</p>
          </li>
        ))}
      </ol>
      <p className={s.guideNote}>
        Menu names can differ slightly between Ads Manager versions.
      </p>
    </section>
  );
}
