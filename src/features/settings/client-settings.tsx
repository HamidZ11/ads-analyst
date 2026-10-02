import { Briefcase, SlidersHorizontal } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DefinitionList } from "@/components/ui/definition-list";
import { formatCurrency, formatDate, formatMultiple } from "@/domain/format";
import { CLIENT_TYPE_LABELS, conversionVocabulary } from "@/domain/labels";
import type { Workspace } from "@/features/workspace/server";

export function ClientSettings({ workspace }: { workspace: Workspace }) {
  const { client, adAccount, agency, coverage } = workspace;
  const vocab = conversionVocabulary(client.type);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader
          icon={SlidersHorizontal}
          title="Client"
          description="Targets drive CPA and ROAS comparisons across the product."
        />
        <CardBody>
          <DefinitionList
            items={[
              { label: "Client name", value: client.name },
              {
                label: "Industry",
                value: CLIENT_TYPE_LABELS[client.type],
                detail: `Conversions are counted as ${vocab.plural.toLowerCase()}.`,
              },
              { label: "Currency", value: client.currency },
              {
                label: "Timezone",
                value: client.timezone,
                detail: "Daily metrics are bucketed by this calendar.",
              },
              {
                label: "Target CPA",
                value: formatCurrency(client.targetCpa, client.currency, { decimals: 2 }),
                detail: vocab.costLabel,
              },
              {
                label: "Target ROAS",
                value:
                  client.targetRoas === null
                    ? "Not a primary target"
                    : formatMultiple(client.targetRoas, 1),
                detail:
                  client.targetRoas === null
                    ? "Revenue metrics are shown but not compared against a goal."
                    : undefined,
              },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          icon={Briefcase}
          title="Workspace"
          description="Agency-level context shared by every client."
        />
        <CardBody>
          <DefinitionList
            items={[
              { label: "Agency", value: agency.name },
              {
                label: "Ad account",
                value: adAccount ? adAccount.name : "None",
                detail: adAccount ? `${adAccount.externalId} · Meta` : undefined,
              },
              {
                label: "Data source",
                value: "Seeded demo dataset",
                detail: coverage
                  ? `${coverage.days} days · ${formatDate(coverage.firstDate)} – ${formatDate(coverage.lastDate, { year: true })}`
                  : "No metrics loaded",
              },
              { label: "Default comparison", value: "Last 7 days vs previous 7 days" },
            ]}
          />
        </CardBody>
      </Card>
    </div>
  );
}
