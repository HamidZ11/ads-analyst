import type { Metadata } from "next";
import { DatePresetControl } from "@/components/shell/date-preset-control";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateRange } from "@/domain/format";
import { conversionVocabulary } from "@/domain/labels";
import { getAccountStructure } from "@/features/analytics/queries";
import { InsightSections } from "@/features/insights/insight-sections";
import { getWorkspace } from "@/features/workspace/server";

export const metadata: Metadata = { title: "Insights" };

export default async function InsightsPage() {
  const workspace = await getWorkspace();
  const { repository, client, periods, comparison, coverage } = workspace;
  const structure = getAccountStructure(repository, client);

  const scope = [
    `${structure.campaigns.active} active campaigns`,
    `${structure.ads} ads`,
    `${structure.creatives} creatives`,
    coverage ? `${coverage.days} days of daily metrics` : "no metrics loaded",
  ];

  return (
    <>
      <PageHeader
        title="Insights"
        description={`${client.name} · what changed, where efficiency is slipping, where money is wasted, and where to scale`}
        actions={
          <>
            <span className="text-xs text-ink-muted">
              {formatDateRange(periods.current)}{" "}
              <span className="text-ink-faint">vs {comparison}</span>
            </span>
            <DatePresetControl value={workspace.preset} />
          </>
        }
      />
      <p className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
        <span className="font-medium text-ink-secondary">Evaluation scope</span>
        {scope.map((item) => (
          <span
            key={item}
            className="rounded-sm bg-surface-active px-1.5 py-0.5 text-ink-secondary"
          >
            {item}
          </span>
        ))}
      </p>
      <InsightSections vocabulary={conversionVocabulary(client.type)} />
    </>
  );
}
