import { Check } from "lucide-react";
import { formatDateRange, formatNumber } from "@/domain/format";
import type { Client, ClientDataSource } from "@/domain/types";
import { TargetsNudge } from "./getting-started";
import type { OnboardingProgress } from "./progress";

/** Where the first import lands: Insights opens with what was just imported. */
export const FIRST_IMPORT_LANDING = "/insights?imported=1";

/**
 * One line above the findings after the first import, naming the file the
 * findings come from (read back from the stored import, so a reload stays
 * true), then the optional targets step when it is still open.
 */
export function ImportedNote({
  client,
  dataSource,
  progress,
}: {
  client: Client;
  dataSource: ClientDataSource;
  progress: OnboardingProgress | null;
}) {
  const latest = dataSource.imports[0];
  if (!latest) return null;
  return (
    <div className="mb-6 border-b border-border pb-4">
      <p
        role="status"
        className="flex items-start gap-2 text-[13px] leading-5 text-ink-secondary"
      >
        <Check
          aria-hidden
          size={14}
          strokeWidth={2.25}
          className="mt-[3px] shrink-0 text-ink-muted"
        />
        <span className="min-w-0 [overflow-wrap:anywhere]">
          Imported <span className="font-medium text-ink">{latest.fileName}</span> for{" "}
          {client.name}: {formatDateRange({ start: latest.firstDate, end: latest.lastDate })},{" "}
          {formatNumber(latest.rows)} rows. The findings below are computed from it.
        </span>
      </p>
      {progress ? <TargetsNudge progress={progress} className="mt-1.5 pl-[22px]" /> : null}
    </div>
  );
}
