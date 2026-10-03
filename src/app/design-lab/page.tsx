import type { Metadata } from "next";
import { ConceptA } from "./concept-a";
import { ConceptB } from "./concept-b";
import { ConceptC } from "./concept-c";
import { buildLabModel } from "./data";
import { LabPortal } from "./lab-portal";

export const metadata: Metadata = {
  title: "Design lab",
  robots: { index: false, follow: false },
};

/**
 * Temporary visual laboratory: three Overview compositions at 1440px on the
 * seeded Luxe Skin Co. data. A fixed overlay, portalled to <body>, isolates it
 * from the production shell without touching production routes or navigation.
 */
export default function DesignLabPage() {
  const m = buildLabModel();
  const concepts = [
    { id: "a", label: "Concept A — Analytical Command Surface", node: <ConceptA m={m} /> },
    { id: "b", label: "Concept B — Modern Product Analytics", node: <ConceptB m={m} /> },
    { id: "c", label: "Concept C — Premium Data Workstation", node: <ConceptC m={m} /> },
  ];
  return (
    <LabPortal>
      <div className="fixed inset-0 z-[60] overflow-auto bg-[#d9dee7]">
        <div className="mx-auto w-[1440px] py-10">
          {concepts.map((c) => (
            <section key={c.id} className="mb-16" aria-label={c.label}>
              <h2 className="mb-3 text-[14px] font-semibold text-ink">{c.label}</h2>
              {c.node}
            </section>
          ))}
        </div>
      </div>
    </LabPortal>
  );
}
