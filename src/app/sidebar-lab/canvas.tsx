import { PageHeader } from "@/components/ui/page-header";
import { formatDateRange } from "@/domain/format";
import { DATE_PRESETS } from "@/domain/periods";
import { getCampaignRows, getClientPeriodSummary } from "@/features/analytics/queries";
import { OverviewAnalytics } from "@/features/overview/overview-analytics";
import type { Workspace } from "@/features/workspace/server";
import { cn } from "@/lib/cn";

/**
 * The approved Overview, rendered by its real components and clipped to the
 * first viewport, so each sidebar concept is judged beside the surface it
 * must support. The preset control is a static replica: clicking the real one
 * would change the production cookie.
 */
export function OverviewCanvas({ workspace }: { workspace: Workspace }) {
  const { repository, client, adAccount, periods, comparison } = workspace;
  const summary = getClientPeriodSummary(repository, client, periods);
  const campaignRows = getCampaignRows(repository, client, periods);
  return (
    <main className="min-w-0 flex-1 overflow-hidden bg-surface px-10 py-8">
      <PageHeader
        title="Overview"
        description={`${client.name} · Meta Ads${adAccount ? ` · ${adAccount.externalId}` : ""}`}
        actions={
          <>
            <span className="text-xs text-ink-muted md:text-right">
              <span className="block font-medium text-ink-secondary">
                {formatDateRange(periods.current)}
              </span>
              <span className="mt-0.5 block">vs {comparison}</span>
            </span>
            <div
              role="group"
              aria-label="Date range (static)"
              className="inline-flex items-center gap-0.5 rounded-md border border-border bg-surface p-0.5"
            >
              {DATE_PRESETS.map((preset) => (
                <span
                  key={preset.id}
                  className={cn(
                    "flex h-7 items-center rounded-sm px-2.5 text-xs font-medium",
                    preset.id === workspace.preset
                      ? "bg-accent-soft text-accent-strong"
                      : preset.available
                        ? "text-ink-muted"
                        : "text-ink-faint",
                  )}
                >
                  {preset.label}
                </span>
              ))}
            </div>
          </>
        }
      />
      <OverviewAnalytics
        workspace={workspace}
        summary={summary}
        campaignRows={campaignRows}
        contextTrend={[]}
      />
    </main>
  );
}
