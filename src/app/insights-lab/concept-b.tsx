import type { InsightsLab } from "./fixtures";
import { LabHeader } from "./shared";
import { WorkspaceView } from "./workspace-view";

/**
 * Concept B — Decision Workspace. A ranked list of findings on the left and
 * the selected finding's evidence, chart, comparison, action and methodology
 * on the right, in the Creatives inspector's register. Filter and selection
 * are real.
 */
export function ConceptB({ lab }: { lab: InsightsLab }) {
  return (
    <>
      <LabHeader lab={lab} />
      <WorkspaceView
        fixtures={lab.fixtures}
        counts={lab.counts}
        currency={lab.currency}
        comparison={lab.comparison}
        currentLabel={lab.periodLabel}
        previousLabel={lab.previousLabel}
      />
    </>
  );
}
