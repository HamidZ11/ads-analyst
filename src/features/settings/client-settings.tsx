import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClasses } from "@/components/ui/button";
import { DefinitionList } from "@/components/ui/definition-list";
import { formatCurrency, formatDate, formatDateRange, formatMultiple } from "@/domain/format";
import { CLIENT_TYPE_LABELS, conversionVocabulary, tracksRevenue } from "@/domain/labels";
import { signOut } from "@/features/auth/actions";
import type { Workspace } from "@/features/workspace/server";
import type { WorkspaceContext } from "@/features/workspace/context";
import { TargetForm } from "./target-form";

/* Settings reads as one page of sections separated by hairlines: a heading
   and one line of context on the left, the settings on the right. Only what
   exists is shown; demo clients are read-only and say so once. */

export function SettingsSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="grid gap-x-10 gap-y-3 border-t border-border py-7 first:border-t-0 first:pt-1 md:grid-cols-[220px_minmax(0,1fr)]"
    >
      <div>
        <h2 id={id} className="text-sm font-semibold text-ink">
          {title}
        </h2>
        <p className="mt-1 max-w-[34ch] text-xs leading-5 text-ink-muted">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** Who is signed in and which workspace this is; the way out in a signed-in deployment. */
export function AccountSection({
  mode,
  email,
  workspaceName,
}: {
  mode: WorkspaceContext["mode"];
  email: string | null;
  workspaceName: string;
}) {
  const signedIn = mode === "supabase";
  return (
    <SettingsSection
      id="settings-account"
      title="Account"
      description={
        signedIn
          ? "You only see this workspace’s clients and data."
          : "This deployment runs the seeded demo without sign-in."
      }
    >
      <DefinitionList
        items={
          signedIn
            ? [
                { label: "Signed in as", value: email ?? "Signed in" },
                { label: "Workspace", value: workspaceName },
              ]
            : [
                { label: "Agency", value: workspaceName },
                { label: "Mode", value: "Demo", detail: "Read-only. Nothing is stored." },
              ]
        }
      />
      {signedIn ? (
        <form action={signOut} className="mt-4">
          <button type="submit" className={buttonClasses("secondary")}>
            Sign out
          </button>
        </form>
      ) : null}
    </SettingsSection>
  );
}

export function ClientSettings({ workspace }: { workspace: Workspace }) {
  const { client, adAccount, coverage, dataSource, canImport } = workspace;
  const vocab = conversionVocabulary(client.type);
  const imported = dataSource.kind === "meta_csv";
  const latest = dataSource.imports[0];
  const revenue = tracksRevenue(client);

  return (
    <div className="max-w-[880px]">
      <AccountSection
        mode={workspace.mode}
        email={workspace.user?.email ?? null}
        workspaceName={
          workspace.mode === "supabase" ? workspace.workspace.name : workspace.agency.name
        }
      />

      <SettingsSection
        id="settings-client"
        title="Client"
        description={
          imported
            ? "Currency, business type and timezone are fixed after the first import, because imported amounts and days depend on them."
            : "Demo clients are seeded and read-only."
        }
      >
        <DefinitionList
          items={[
            { label: "Client", value: client.name },
            {
              label: "Business type",
              value: CLIENT_TYPE_LABELS[client.type],
              detail: `Conversions are counted as ${vocab.plural.toLowerCase()}.`,
            },
            { label: "Currency", value: client.currency },
            {
              label: "Reporting timezone",
              value: client.timezone,
              detail: "Daily metrics are bucketed by this calendar.",
            },
            { label: "Default comparison", value: "Last 7 days vs previous 7 days" },
          ]}
        />
      </SettingsSection>

      <SettingsSection
        id="settings-targets"
        title="Performance targets"
        description="Optional. Pages compare against a target only when one is set."
      >
        {imported ? (
          <TargetForm
            clientId={client.id}
            currency={client.currency}
            targetCpa={client.targetCpa}
            targetRoas={client.targetRoas}
            revenueTracked={revenue}
          />
        ) : (
          <DefinitionList
            items={[
              {
                label: "Target CPA",
                value:
                  client.targetCpa === null
                    ? "Not set"
                    : formatCurrency(client.targetCpa, client.currency, { decimals: 2 }),
                detail: client.targetCpa === null ? undefined : vocab.costLabel,
              },
              {
                label: "Target ROAS",
                value:
                  client.targetRoas !== null
                    ? formatMultiple(client.targetRoas, 1)
                    : revenue
                      ? "Not set"
                      : "Not tracked",
                detail:
                  client.targetRoas === null && !revenue
                    ? "Conversion value is not recorded, so ROAS is not shown."
                    : undefined,
              },
            ]}
          />
        )}
      </SettingsSection>

      <SettingsSection
        id="settings-data"
        title="Data"
        description={
          imported
            ? "Each import replaces the ad-days it contains and keeps the rest."
            : "Generated in code from a seed; never stored or mixed with a workspace."
        }
      >
        <DefinitionList
          items={[
            {
              label: "Source",
              value: imported ? "Meta Ads · CSV import" : "Seeded demo dataset",
            },
            {
              label: "Coverage",
              value: coverage
                ? `${coverage.days} ${coverage.days === 1 ? "day" : "days"}`
                : "No data yet",
              detail: coverage
                ? formatDateRange({ start: coverage.firstDate, end: coverage.lastDate })
                : undefined,
            },
            {
              label: "Ad account",
              value: adAccount ? adAccount.name : "None",
              detail: adAccount?.externalId ? `${adAccount.externalId} · Meta` : undefined,
            },
            ...(imported
              ? [
                  {
                    label: "Latest import",
                    value: latest
                      ? new Date(latest.importedAt).toLocaleString("en-GB", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "None",
                    detail: latest
                      ? `${latest.fileName} · ${latest.rows.toLocaleString("en-GB")} rows · ${formatDate(latest.firstDate)} – ${formatDate(latest.lastDate, { year: true })} · ${latest.daysAdded.toLocaleString("en-GB")} new, ${latest.daysReplaced.toLocaleString("en-GB")} updated ad-days`
                      : undefined,
                  },
                  { label: "Imports", value: String(dataSource.imports.length) },
                  {
                    label: "Conversion column",
                    value: latest?.outcomeColumn || "—",
                    detail: `Counted as ${vocab.plural.toLowerCase()}.`,
                  },
                  { label: "Value column", value: latest?.revenueColumn ?? "Not imported" },
                ]
              : []),
          ]}
        />
        {imported && canImport ? (
          <Link
            href={`/clients/import?client=${encodeURIComponent(client.id)}`}
            className={buttonClasses("secondary", "md", "mt-4")}
          >
            Import a newer export
          </Link>
        ) : null}
      </SettingsSection>
    </div>
  );
}
