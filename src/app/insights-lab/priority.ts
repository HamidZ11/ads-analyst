/** Kept apart from the fixtures so client components never pull in the data layer. */
export type Priority = "high" | "opportunity" | "watch";

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: "High impact",
  opportunity: "Opportunity",
  watch: "Watch",
};
