/**
 * How to export from Ads Manager, in the words of the instant audit's guide
 * (D-083 on the audit branch), limited to what was verified there: "Export
 * table data" is Meta's own wording; the Ads tab, the Day breakdown and the CSV
 * choice come from consistent third-party guides and the column names Ads
 * Manager writes. Only the reasons are changed to fit the import. When both
 * branches meet, the two lists should become one.
 */
export const EXPORT_STEPS = [
  {
    title: "Open the Ads tab",
    body: "Each row must be one ad, so Insights can show which ads are spending.",
  },
  {
    title: "Pick at least the last 14 days",
    body: "Insights compares the last 7 days with the 7 before them.",
  },
  {
    title: "Choose Breakdown › By time › Day",
    body: "One row per ad per day.",
  },
  {
    title: "Check the columns",
    body: "Campaign name, Ad set name, Ad name, Amount spent, Impressions, Link clicks, and Purchases or Leads. For ROAS, Purchases conversion value too.",
  },
  {
    title: "Export as CSV",
    body: "Reports › Export table data, then CSV. Upload the file as it downloads: opening and saving it in a spreadsheet can change dates and round IDs.",
  },
] as const;

export const EXPORT_NOTE = "Menu names can differ slightly between Ads Manager versions.";
