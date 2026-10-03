import type { Metadata } from "next";
import { LabFrame } from "../campaigns-lab/lab-frame";
import { LabPortal } from "../design-lab/lab-portal";
import { ConceptA } from "./concept-a";
import { ConceptB } from "./concept-b";
import { ConceptC } from "./concept-c";
import { buildInsightFixtures } from "./fixtures";

export const metadata: Metadata = {
  title: "Insights lab",
  robots: { index: false, follow: false },
};

/**
 * Temporary Insights exploration: three concepts on lab-only fixtures
 * computed from the seeded Luxe Skin Co. scenarios, each inside the approved
 * shell with Insights active, at 1440px. The fourth frame shows the empty
 * state of a group with no findings.
 */
export default function InsightsLabPage() {
  const lab = buildInsightFixtures();
  const concepts = [
    { id: "a", label: "Concept A — Priority Analysis Feed", node: <ConceptA lab={lab} /> },
    { id: "b", label: "Concept B — Decision Workspace", node: <ConceptB lab={lab} /> },
    { id: "c", label: "Concept C — Analytical Briefing", node: <ConceptC lab={lab} /> },
    {
      id: "empty",
      label: "Empty state — a group with no findings (Concept C treatment)",
      node: <ConceptC lab={lab} emptyDemo />,
    },
  ];
  return (
    <LabPortal>
      <div className="fixed inset-0 z-[60] overflow-auto bg-[#d9dee7]">
        <div className="mx-auto w-[1440px] py-10">
          {concepts.map((concept) => (
            <section key={concept.id} className="mb-14" aria-label={concept.label}>
              <h2 className="mb-3 text-[14px] font-semibold text-ink">{concept.label}</h2>
              <LabFrame workspace={lab.workspace} activeHref="/insights">
                {concept.node}
              </LabFrame>
            </section>
          ))}
        </div>
      </div>
    </LabPortal>
  );
}
