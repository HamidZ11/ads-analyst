import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Delta } from "@/components/ui/delta";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatCurrency, formatMetric, formatNumber } from "@/domain/format";
import { conversionVocabulary } from "@/domain/labels";
import type { CampaignRow } from "@/features/analytics/queries";
import type { Workspace } from "@/features/workspace/server";

const VISIBLE = 6;

export function TopCampaigns({
  workspace,
  rows,
}: {
  workspace: Workspace;
  rows: CampaignRow[];
}) {
  const { client, comparison } = workspace;
  const vocab = conversionVocabulary(client.type);
  const top = rows
    .filter((r) => r.current.totals.spend > 0)
    .sort((a, b) => b.current.totals.spend - a.current.totals.spend)
    .slice(0, VISIBLE);

  return (
    <section aria-labelledby="top-campaigns-heading" className="min-w-0">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="top-campaigns-heading" className="text-sm font-semibold text-ink">
          Top campaigns by spend
        </h2>
        <Link
          href="/campaigns"
          className="flex items-center gap-1 text-xs font-medium text-accent-strong transition-colors hover:text-accent"
        >
          All campaigns
          <ArrowRight aria-hidden size={12} />
        </Link>
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border border-border">
        <Table
          caption={`Top campaigns by spend in the selected period, compared with the ${comparison}`}
        >
          <THead>
            <Tr>
              <Th>Campaign</Th>
              <Th numeric>Spend</Th>
              <Th numeric>Δ</Th>
              <Th numeric>{vocab.plural}</Th>
              <Th numeric>CPA</Th>
            </Tr>
          </THead>
          <TBody>
            {top.map((row) => (
              <Tr key={row.campaign.id} className="hover:bg-surface-subtle">
                <Td className="max-w-[280px]">
                  <span className="block truncate text-ink">{row.campaign.name}</span>
                </Td>
                <Td numeric className="font-medium text-ink">
                  {formatCurrency(row.current.totals.spend, client.currency)}
                </Td>
                <Td numeric>
                  <Delta change={row.spendChange} higherIsBetter={null} />
                </Td>
                <Td numeric>{formatNumber(row.current.totals.conversions)}</Td>
                <Td numeric>{formatMetric("cpa", row.current.derived.cpa, client.currency)}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>
    </section>
  );
}
