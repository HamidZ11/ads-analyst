/* The three free calculators: names, routes and the formula each one shows.
   The pages, the index, the sitemap and the structured data all read from
   here, so a tool is described the same way everywhere. */

export type ToolId = "roas" | "cpa" | "break-even-roas";

export interface Tool {
  id: ToolId;
  path:
    "/tools/roas-calculator" | "/tools/cpa-calculator" | "/tools/break-even-roas-calculator";
  /** The page's h1 and the tool's name in structured data. */
  name: string;
  /** One sentence for the index and the page lead. */
  summary: string;
  /** The formula in words, shown on the page. */
  formula: string;
}

export const TOOLS: readonly Tool[] = [
  {
    id: "roas",
    path: "/tools/roas-calculator",
    name: "ROAS calculator",
    summary:
      "Work out return on ad spend from the revenue your ads brought in and what they cost.",
    formula: "ROAS = revenue from ads ÷ ad spend",
  },
  {
    id: "cpa",
    path: "/tools/cpa-calculator",
    name: "CPA calculator",
    summary:
      "Work out cost per acquisition from your ad spend and the conversions it produced.",
    formula: "CPA = ad spend ÷ conversions",
  },
  {
    id: "break-even-roas",
    path: "/tools/break-even-roas-calculator",
    name: "Break-even ROAS calculator",
    summary: "Work out the lowest ROAS that still pays for your ads, from your profit margin.",
    formula: "Break-even ROAS = 1 ÷ profit margin",
  },
];

export function toolById(id: ToolId): Tool {
  const tool = TOOLS.find((candidate) => candidate.id === id);
  if (!tool) throw new Error(`Unknown tool: ${id}`);
  return tool;
}
