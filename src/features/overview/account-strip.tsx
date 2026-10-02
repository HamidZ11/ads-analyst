import { formatDate } from "@/domain/format";
import type { AccountStructure } from "@/features/analytics/queries";
import type { Workspace } from "@/features/workspace/server";

/** Inline account facts; closes the page without another card. */
export function AccountStrip({
  workspace,
  structure,
}: {
  workspace: Workspace;
  structure: AccountStructure;
}) {
  const { adAccount, coverage } = workspace;
  const items: Array<{ label: string; value: string }> = [
    {
      label: "Ad account",
      value: adAccount ? `${adAccount.name} · ${adAccount.externalId}` : "None connected",
    },
    {
      label: "Campaigns",
      value: `${structure.campaigns.total} · ${structure.campaigns.active} active`,
    },
    { label: "Ad sets", value: `${structure.adSets}` },
    { label: "Ads", value: `${structure.ads}` },
    { label: "Creatives", value: `${structure.creatives}` },
    {
      label: "Daily metrics",
      value: coverage
        ? `${formatDate(coverage.firstDate)} – ${formatDate(coverage.lastDate)} · ${coverage.days} days`
        : "None loaded",
    },
  ];
  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-3 border-t border-border pt-5">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs text-ink-muted">{item.label}</dt>
          <dd className="mt-0.5 text-sm text-ink tabular">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
