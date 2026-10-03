import type { Metadata } from "next";
import { LabPortal } from "../design-lab/lab-portal";
import { ConceptA } from "./concept-a";
import { ConceptB } from "./concept-b";
import { ConceptC } from "./concept-c";
import { buildCampaignsLab } from "./data";
import { LabFrame } from "./lab-frame";

export const metadata: Metadata = {
  title: "Campaigns lab",
  robots: { index: false, follow: false },
};

/**
 * Temporary Campaigns exploration: three concepts, each inside the approved
 * production shell (sidebar and page header), at 1440px. Unlinked from
 * navigation and mounted above the production shell through the lab portal.
 */
export default function CampaignsLabPage() {
  const lab = buildCampaignsLab();
  const concepts = [
    { id: "a", label: "Concept A — Refined Analytical Table", node: <ConceptA lab={lab} /> },
    { id: "b", label: "Concept B — Campaign Performance Ledger", node: <ConceptB lab={lab} /> },
    { id: "c", label: "Concept C — Campaign Command Table", node: <ConceptC lab={lab} /> },
  ];
  return (
    <LabPortal>
      <div className="fixed inset-0 z-[60] overflow-auto bg-[#d9dee7]">
        <div className="mx-auto w-[1440px] py-10">
          {concepts.map((concept) => (
            <section key={concept.id} className="mb-14" aria-label={concept.label}>
              <h2 className="mb-3 text-[14px] font-semibold text-ink">{concept.label}</h2>
              <LabFrame workspace={lab.workspace}>{concept.node}</LabFrame>
            </section>
          ))}
        </div>
      </div>
    </LabPortal>
  );
}
