import type { Metadata } from "next";
import { LabPortal } from "../design-lab/lab-portal";
import { OverviewCanvas } from "./canvas";
import { ConceptA, ConceptB, ConceptC } from "./concepts";
import { luxeWorkspace } from "./workspace";

export const metadata: Metadata = {
  title: "Sidebar lab",
  robots: { index: false, follow: false },
};

const FRAME_HEIGHT = 760;

/**
 * Temporary sidebar exploration: three concepts, each beside the first
 * viewport of the approved Overview, at 1440px. Unlinked from navigation and
 * mounted above the production shell through the lab portal.
 */
export default function SidebarLabPage() {
  const workspace = luxeWorkspace();
  const concepts = [
    { id: "a", label: "Concept A — Quiet Analytical Rail", Sidebar: ConceptA },
    { id: "b", label: "Concept B — Premium Workspace Nav", Sidebar: ConceptB },
    { id: "c", label: "Concept C — Compact Professional Tool", Sidebar: ConceptC },
  ];
  return (
    <LabPortal>
      <div className="fixed inset-0 z-[60] overflow-auto bg-[#d9dee7]">
        <div className="mx-auto w-[1440px] py-10">
          {concepts.map(({ id, label, Sidebar }) => (
            <section key={id} className="mb-14" aria-label={label}>
              <h2 className="mb-3 text-[14px] font-semibold text-ink">{label}</h2>
              <div
                className="flex overflow-hidden border border-border-strong bg-surface"
                style={{ height: FRAME_HEIGHT }}
              >
                <Sidebar workspace={workspace} />
                <OverviewCanvas workspace={workspace} />
              </div>
            </section>
          ))}
        </div>
      </div>
    </LabPortal>
  );
}
