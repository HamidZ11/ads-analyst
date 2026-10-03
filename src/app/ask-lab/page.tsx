import type { Metadata } from "next";
import { LabFrame } from "../campaigns-lab/lab-frame";
import { LabPortal } from "../design-lab/lab-portal";
import { luxeWorkspace } from "../sidebar-lab/workspace";
import { ConceptReview, ConceptView } from "./concepts";
import { buildAskLab } from "./fixtures";

export const metadata: Metadata = {
  title: "Ask Analyst lab",
  robots: { index: false, follow: false },
};

export default function AskLabPage() {
  const workspace = luxeWorkspace();
  const lab = buildAskLab(workspace);
  return (
    <LabPortal>
      <div className="fixed inset-0 z-[60] overflow-auto bg-canvas">
        <div className="mx-auto w-[1440px] py-10">
          <div className="mb-8 flex items-end justify-between gap-8">
            <div>
              <h1 className="text-2xl font-semibold">Ask Analyst · interaction study</h1>
              <p className="mt-2 text-sm text-ink-secondary">
                A and C remain under review. Concept B was rejected. Use Preview to inspect the
                example thread and recovery states.
              </p>
            </div>
            <p className="max-w-[360px] text-right text-xs leading-5 text-ink-muted">
              Fixed Luxe Skin Co. / 7D lab scope. Sidebar and date controls show the approved
              shell; client and period exploration are not part of this study.
            </p>
          </div>
          {(["a", "c"] as const).map((variant) => (
            <ConceptReview key={variant} variant={variant} lab={lab}>
              <LabFrame workspace={workspace} activeHref="/ask">
                <ConceptView />
              </LabFrame>
            </ConceptReview>
          ))}
        </div>
      </div>
    </LabPortal>
  );
}
