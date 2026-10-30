import { EXPORT_NOTE, exportSteps } from "@/features/import/export-steps";
import s from "./audit.module.css";

/** The verified export steps, in the audit's words (D-083). */
export const EXPORT_STEPS = exportSteps("audit");

export function ExportGuide() {
  return (
    <section className={s.guide} aria-labelledby="export-guide-title">
      <h2 id="export-guide-title" className={s.guideTitle}>
        How to export from Ads Manager
      </h2>
      <ol className={s.steps}>
        {EXPORT_STEPS.map((step) => (
          <li key={step.title}>
            <p className={s.stepTitle}>{step.title}</p>
            <p className={s.stepBody}>{step.body}</p>
          </li>
        ))}
      </ol>
      <p className={s.guideNote}>{EXPORT_NOTE}</p>
    </section>
  );
}
