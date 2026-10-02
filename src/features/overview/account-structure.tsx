import { Building2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatDate } from "@/domain/format";
import type { AccountStructure as AccountStructureData } from "@/features/analytics/queries";
import type { Workspace } from "@/features/workspace/server";

export function AccountStructure({
  workspace,
  structure,
}: {
  workspace: Workspace;
  structure: AccountStructureData;
}) {
  const { adAccount, coverage } = workspace;
  const items = [
    {
      label: "Campaigns",
      value: `${structure.campaigns.total}`,
      detail: `${structure.campaigns.active} active · ${structure.campaigns.paused} paused`,
    },
    { label: "Ad sets", value: `${structure.adSets}` },
    { label: "Ads", value: `${structure.ads}` },
    { label: "Creatives", value: `${structure.creatives}` },
  ];
  return (
    <Card>
      <CardHeader
        icon={Building2}
        title="Account"
        description={
          adAccount ? `${adAccount.name} · ${adAccount.externalId}` : "No ad account connected"
        }
      />
      <CardBody>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          {items.map((item) => (
            <div key={item.label}>
              <dt className="text-2xs font-medium tracking-wide text-ink-muted uppercase">
                {item.label}
              </dt>
              <dd className="mt-0.5 text-lg font-semibold text-ink tabular">{item.value}</dd>
              {item.detail ? <dd className="text-2xs text-ink-muted">{item.detail}</dd> : null}
            </div>
          ))}
        </dl>
        <p className="mt-4 border-t border-border pt-3 text-xs text-ink-muted">
          {coverage
            ? `Daily metrics from ${formatDate(coverage.firstDate)} to ${formatDate(coverage.lastDate, { year: true })} · ${coverage.days} days`
            : "No daily metrics loaded for this client."}
        </p>
      </CardBody>
    </Card>
  );
}
