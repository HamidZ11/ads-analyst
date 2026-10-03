import { formatDate } from "@/domain/format";
import { toSplitCreative, type CreativesLab } from "./data";
import { LabHeader } from "./shared";
import { SplitView } from "./split-view";

/**
 * Concept B — Creative Analysis Split View. A ranked list on the left for
 * scanning, a detail pane on the right for inspecting one creative: larger
 * artwork, primary metrics with change and target context, a daily spend
 * chart against the previous period, where the creative runs, and a
 * side-by-side period comparison. Selection, sort and type filter are real.
 */
export function ConceptB({ lab }: { lab: CreativesLab }) {
  const { client, vocabulary, showRoas, comparison, workspace } = lab;
  const p = workspace.periods;
  return (
    <>
      <LabHeader lab={lab} />
      <SplitView
        creatives={lab.creatives.map(toSplitCreative)}
        currency={client.currency}
        vocabulary={vocabulary}
        targetCpa={client.targetCpa}
        showRoas={showRoas}
        comparison={comparison}
        currentLabel={`${formatDate(p.current.start)} – ${formatDate(p.current.end)}`}
        previousLabel={`${formatDate(p.previous.start)} – ${formatDate(p.previous.end)}`}
      />
    </>
  );
}
