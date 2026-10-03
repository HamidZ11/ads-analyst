import { Briefcase, Database, SlidersHorizontal, UserRound } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { signOut } from "@/features/auth/actions";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DefinitionList } from "@/components/ui/definition-list";
import { formatCurrency, formatDate, formatMultiple } from "@/domain/format";
import { CLIENT_TYPE_LABELS, conversionVocabulary, tracksRevenue } from "@/domain/labels";
import { TargetForm } from "./target-form";
import type { Workspace } from "@/features/workspace/server";

export function ClientSettings({ workspace }: { workspace: Workspace }) {
  const { client, adAccount, agency, coverage, dataSource } = workspace;
  const vocab = conversionVocabulary(client.type);
  const imported = dataSource.kind === "meta_csv";
  const latest = dataSource.imports[0];

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
                value:
                  client.targetCpa === null
                    ? "Not set"
                    : formatCurrency(client.targetCpa, client.currency, { decimals: 2 }),
                detail:
                  client.targetCpa === null
                    ? "Cost comparisons omit target language."
                    : vocab.costLabel,
              },
              {
                label: "Target ROAS",
                value:
                  client.targetRoas === null
                    ? "Not a primary target"
                    : formatMultiple(client.targetRoas, 1),
                detail:
                  client.targetRoas === null
                    ? tracksRevenue(client)
                      ? "Revenue metrics are shown but not compared against a goal."
                      : "Conversion value is not recorded, so ROAS is not shown."
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
              {
                label: workspace.mode === "supabase" ? "Workspace" : "Agency",
                value: agency.name,
              },
              {
                label: "Ad account",
                value: adAccount ? adAccount.name : "None",
                detail: adAccount ? `${adAccount.externalId} · Meta` : undefined,
              },
              {
                label: "Data source",
                value: imported ? "Meta Ads CSV import" : "Seeded demo dataset",
                detail: coverage
                  ? `${coverage.days} days · ${formatDate(coverage.firstDate)} – ${formatDate(coverage.lastDate, { year: true })}`
                  : "No metrics loaded",
              },
              { label: "Default comparison", value: "Last 7 days vs previous 7 days" },
            ]}
          />
        </CardBody>
      </Card>
      {workspace.mode === "supabase" && workspace.user ? (
        <AccountCard email={workspace.user.email} />
      ) : null}

      {imported ? (
        <Card>
          <CardHeader
            icon={Database}
            title="Imports"
            description="Each import replaces the ad-days it contains and keeps the rest."
          />
          <CardBody>
            <DefinitionList
              items={[
                {
                  label: "Last import",
                  value: latest
                    ? new Date(latest.importedAt).toLocaleString("en-GB", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "None",
                  detail: latest
                    ? `${latest.fileName} · ${latest.rows.toLocaleString("en-GB")} rows · ${formatDate(latest.firstDate)} – ${formatDate(latest.lastDate, { year: true })} · ${latest.daysAdded.toLocaleString("en-GB")} new, ${latest.daysReplaced.toLocaleString("en-GB")} replaced`
                    : undefined,
                },
                { label: "Imports", value: String(dataSource.imports.length) },
                {
                  label: "Primary conversion",
                  value: latest?.outcomeColumn || "—",
                  detail: `Counted as ${vocab.plural.toLowerCase()}.`,
                },
                {
                  label: "Conversion value",
                  value: latest?.revenueColumn ?? "Not imported",
                },
                {
                  label: "Account ID",
                  value: adAccount?.externalId || "Not in the export",
                },
              ]}
            />
          </CardBody>
        </Card>
      ) : null}

      {imported ? (
        <Card>
          <CardHeader
            icon={SlidersHorizontal}
            title="Targets"
            description="Optional. Pages compare against a target only when one is set."
          />
          <CardBody>
            <TargetForm
              clientId={client.id}
              currency={client.currency}
              targetCpa={client.targetCpa}
              targetRoas={client.targetRoas}
              revenueTracked={tracksRevenue(client)}
            />
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

/** Who is signed in, and the way out. Shown in Supabase mode, with or without clients. */
export function AccountCard({ email }: { email: string | null }) {
  return (
    <Card>
      <CardHeader
        icon={UserRound}
        title="Account"
        description="You only see this workspace's clients and data."
      />
      <CardBody>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 text-sm">
            <p className="text-xs font-medium text-ink-muted">Signed in as</p>
            <p className="mt-0.5 truncate text-ink">{email ?? "Signed in"}</p>
          </div>
          <form action={signOut}>
            <button type="submit" className={buttonClasses("secondary")}>
              Sign out
            </button>
          </form>
        </div>
      </CardBody>
    </Card>
  );
}
