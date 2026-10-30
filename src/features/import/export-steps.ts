/**
 * How to export from Ads Manager, limited to what was verified (D-083):
 * Reports › Export table data is Meta's own wording; the Ads tab, the Day
 * breakdown and the CSV choice come from consistent third-party guides and
 * the column names Ads Manager writes. Nothing here guesses at a menu. One
 * list serves the audit and the import (D-090); where a step's reason differs,
 * each says it in its own words.
 */
const STEPS = [
  {
    title: "Open the Ads tab",
    body: {
      audit:
        "Each row must be one ad. Campaign and ad set exports can’t show which ads are spending.",
      import: "Each row must be one ad, so Insights can show which ads are spending.",
    },
  },
  {
    title: "Pick at least the last 14 days",
    body: {
      audit:
        "The audit compares the later half of the file with the earlier half, so 14 days gives two weeks.",
      import: "Insights compares the last 7 days with the 7 before them.",
    },
  },
  {
    title: "Choose Breakdown › By time › Day",
    body: "One row per ad per day.",
  },
  {
    title: "Check the columns",
    body: {
      audit:
        "Campaign name, Ad set name, Ad name, Amount spent, Impressions, Link clicks, and Purchases or Leads. For ROAS, Purchases conversion value too. Add any that are missing from the Columns menu.",
      import:
        "Campaign name, Ad set name, Ad name, Amount spent, Impressions, Link clicks, and Purchases or Leads. For ROAS, Purchases conversion value too.",
    },
  },
  {
    title: "Export as CSV",
    body: {
      audit:
        "Reports › Export table data, then CSV. Drop the file here as it downloads: opening and saving it in a spreadsheet can change dates and round IDs.",
      import:
        "Reports › Export table data, then CSV. Upload the file as it downloads: opening and saving it in a spreadsheet can change dates and round IDs.",
    },
  },
] as const;

export type ExportStep = { title: string; body: string };

/** The steps, with each reason worded for the audit or the signed-in import. */
export function exportSteps(context: "audit" | "import"): readonly ExportStep[] {
  return STEPS.map((step) => ({
    title: step.title,
    body: typeof step.body === "string" ? step.body : step.body[context],
  }));
}

export const EXPORT_NOTE = "Menu names can differ slightly between Ads Manager versions.";
