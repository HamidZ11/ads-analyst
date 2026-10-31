import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buttonClasses } from "./button";
import { Input } from "./input";

/* Focus rings appear at once (DESIGN.md §20). Tailwind's `transition-colors`
   (and bare `transition`) also animate `outline-color`, which made the ring
   fade in from the text colour, so controls and links transition colour,
   background and border only (D-NEW-focus-1, D-NEW-focus-2). */

const LIMITED = "transition-[color,background-color,border-color]";

describe("focus rings appear instantly", () => {
  it("buttons and inputs never transition outline colour", () => {
    for (const variant of ["primary", "secondary", "ghost"] as const) {
      expect(buttonClasses(variant)).toContain(LIMITED);
      expect(buttonClasses(variant)).not.toMatch(/\btransition-colors\b/);
    }
    const input = renderToStaticMarkup(createElement(Input, { "aria-label": "Search" }));
    expect(input).toContain(LIMITED);
    expect(input).not.toMatch(/\btransition-colors\b/);
  });

  it("no button, input, select, textarea or link in the app uses transition-colors", () => {
    const files = [
      "src/components/ui/segmented-control.tsx",
      "src/features/insights/insights-workspace.tsx",
      "src/features/clients/clients-table.tsx",
      "src/features/settings/workspace-name-form.tsx",
      "src/features/settings/target-form.tsx",
      "src/features/ask/ask-analyst.tsx",
      "src/features/audit/audit-tool.tsx",
      "src/features/audit/audit-targets.tsx",
      "src/features/report/share-dialog.tsx",
      "src/features/report/notes-editor.tsx",
      "src/features/campaigns/campaigns-table.tsx",
      "src/features/creatives/creative-inspector.tsx",
      "src/features/creatives/creative-board.tsx",
      "src/features/overview/performance-chart.tsx",
      "src/features/import/import-flow.tsx",
      "src/features/import/mapping-table.tsx",
      "src/features/auth/sign-in-form.tsx",
      "src/components/shell/nav-links.tsx",
      "src/features/overview/overview-analytics.tsx",
      "src/app/sign-in/page.tsx",
    ];
    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      // Every control element or class constant for one, up to its closing ">".
      const controls = [
        ...source.matchAll(
          /<(button|input|select|textarea|Dialog\.Close|Link|a|label)\b[^>]*>/g,
        ),
        ...source.matchAll(/const (?:INPUT|SELECT|SUBMIT)\b[^;]*;/g),
      ].map(([match]) => match);
      for (const control of controls)
        expect(control, `${file}: ${control.slice(0, 80)}`).not.toMatch(
          /\btransition-colors\b/,
        );
    }
  });
});
