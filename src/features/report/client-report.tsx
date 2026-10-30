import type { ReactNode } from "react";
import { CampaignName } from "@/components/ui/campaign-name";
import { Delta } from "@/components/ui/delta";
import { Table, TBody, THead, Td, Th, Tr } from "@/components/ui/table";
import { formatCurrency, formatMetric, formatMultiple, formatNumber } from "@/domain/format";
import type { ReportNote } from "@/data/supabase/gateway";
import { FindingChart } from "@/features/insights/finding-chart";
import { cn } from "@/lib/cn";
import {
  CLIENT_GROUP_LABELS,
  suggestedNextSteps,
  type ClientFindingGroup,
} from "./client-wording";
import { NotesEditor } from "./notes-editor";
import type { ClientReportModel, ReportEntityRow, ReportMetric } from "./report-model";

/* The report is a document, not a dashboard: one column, hairline sections,
   the agency's name at the top and the client's figures in the client's
   words. On paper (Save as PDF) the app shell and the toolbar disappear,
   sections avoid splitting across pages and the editor becomes plain text. */

const GROUP_RULE: Record<ClientFindingGroup, string> = {
  attention: "bg-negative",
  working: "bg-positive",
  watching: "bg-warning",
};

function Section({
  id,
  title,
  description,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn("border-t border-border pt-6 pb-8 print:pt-5 print:pb-6", className)}
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={id} className="text-base font-semibold tracking-[-0.01em] text-ink">
          {title}
        </h2>
        {description ? <p className="text-xs text-ink-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function metricValue(metric: ReportMetric, model: ClientReportModel) {
  return formatMetric(metric.key, metric.current, model.currency);
}

function targetLine(metric: ReportMetric, model: ClientReportModel) {
  if (metric.target === null) return null;
  return metric.key === "roas"
    ? `Target ${formatMultiple(metric.target, 1)}`
    : `Target ${formatCurrency(metric.target, model.currency, { decimals: Number.isInteger(metric.target) ? 0 : 2 })}`;
}

function HeadlineMetrics({ model }: { model: ClientReportModel }) {
  return (
    <ul className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-3 print:grid-cols-3">
      {model.metrics.map((metric) => (
        <li
          key={metric.key}
          className="min-w-0 break-inside-avoid border-l-2 border-border pl-3"
        >
          <p className="text-xs font-medium text-ink-muted">{metric.label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-[-0.02em] whitespace-nowrap text-ink">
            {metricValue(metric, model)}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-muted">
            <Delta
              change={metric.change}
              higherIsBetter={metric.higherIsBetter}
              neutralBelow={0.05}
            />
            <span className="tabular">
              from {formatMetric(metric.key, metric.previous, model.currency)}
            </span>
          </p>
          {targetLine(metric, model) ? (
            <p className="mt-0.5 text-xs text-ink-muted">{targetLine(metric, model)}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function Findings({ model }: { model: ClientReportModel }) {
  if (model.findings.length === 0)
    return (
      <p className="text-sm text-ink-secondary">
        Nothing stood out against the {model.comparison}: no campaign, ad or creative crossed
        the checks for wasted spend, falling results or room to grow.
      </p>
    );
  return (
    <ol className="divide-y divide-border">
      {model.findings.map((finding) => (
        <li key={finding.id} className="relative break-inside-avoid py-3 pl-4">
          <span
            aria-hidden
            className={cn(
              "absolute top-3.5 bottom-3.5 left-0 w-0.5 rounded-full",
              GROUP_RULE[finding.group],
            )}
          />
          <p className="text-xs text-ink-muted">
            {CLIENT_GROUP_LABELS[finding.group]} · {finding.where}
          </p>
          <h3 className="mt-0.5 text-sm font-semibold text-ink">{finding.title}</h3>
          <p className="mt-0.5 text-sm text-ink-secondary">{finding.sentence}</p>
        </li>
      ))}
    </ol>
  );
}

function EntityTable({
  caption,
  nameLabel,
  rows,
  model,
  campaigns,
}: {
  caption: string;
  nameLabel: string;
  rows: ReportEntityRow[];
  model: ClientReportModel;
  campaigns: boolean;
}) {
  return (
    <Table caption={caption} wrapperClassName="print:overflow-visible">
      <THead>
        <tr>
          <Th>{nameLabel}</Th>
          <Th numeric>Spend</Th>
          <Th numeric>Change</Th>
          <Th numeric>{model.conversionPlural}</Th>
          <Th numeric>Change</Th>
          <Th numeric>{model.costLabel}</Th>
          {model.showRoas ? <Th numeric>Return on ad spend</Th> : null}
        </tr>
      </THead>
      <TBody>
        {rows.map((row) => (
          <Tr key={row.id} className="break-inside-avoid">
            <Td className="max-w-[320px] py-2 whitespace-normal">
              {campaigns ? (
                <CampaignName
                  name={row.name}
                  className="truncate text-sm font-medium text-ink"
                  contextClassName="truncate"
                />
              ) : (
                <span className="block truncate text-sm font-medium text-ink" title={row.name}>
                  {row.name}
                </span>
              )}
              {row.detail ? (
                <span className="block text-xs text-ink-muted">{row.detail}</span>
              ) : null}
            </Td>
            <Td numeric className="font-medium text-ink">
              {formatCurrency(row.spend, model.currency, { decimals: 0 })}
            </Td>
            <Td numeric>
              <Delta change={row.spendChange} higherIsBetter={null} />
            </Td>
            <Td numeric className="text-ink-secondary">
              {formatNumber(row.conversions)}
            </Td>
            <Td numeric>
              <Delta change={row.conversionsChange} higherIsBetter neutralBelow={0.05} />
            </Td>
            <Td numeric className="text-ink-secondary">
              {formatCurrency(row.cpa, model.currency, { decimals: 2 })}
            </Td>
            {model.showRoas ? (
              <Td numeric className="text-ink-secondary">
                {formatMultiple(row.roas, 2)}
              </Td>
            ) : null}
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}

function shownOf(shown: number, total: number, noun: string) {
  return shown < total
    ? `The ${shown} with the most spend, of ${total} ${noun} that spent this period`
    : `${total} ${total === 1 ? noun.replace(/s$/, "") : noun} spent this period`;
}

export function ClientReport({
  model,
  note,
  canSave,
}: {
  model: ClientReportModel;
  note: ReportNote | null;
  canSave: boolean;
}) {
  return (
    <article
      aria-labelledby="report-title"
      className="mx-auto max-w-[960px] print:max-w-none"
      data-report
    >
      <header className="pb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <p className="text-sm font-semibold text-ink">{model.agencyName}</p>
          <p className="text-xs text-ink-muted">Prepared {model.preparedOn}</p>
        </div>
        <p className="mt-6 text-xs font-medium text-ink-muted">Performance report · Meta Ads</p>
        <h2
          id="report-title"
          className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-ink sm:text-3xl"
        >
          {model.clientName}
        </h2>
        <p className="mt-1.5 text-sm text-ink-secondary">
          <span className="font-medium text-ink">{model.currentLabel}</span> compared with{" "}
          {model.previousLabel}
        </p>
        {model.demo ? (
          <p className="mt-4 rounded-md border border-dashed border-border-strong bg-surface-subtle px-3 py-2 text-xs text-ink-secondary">
            <span className="font-semibold text-ink">Sample report.</span> Built from the seeded
            demo dataset for a fictional client; these are not real results.
          </p>
        ) : null}
      </header>

      <Section
        id="report-results"
        title="Headline results"
        description={`Against the ${model.comparison}`}
        className="break-inside-avoid"
      >
        <HeadlineMetrics model={model} />
      </Section>

      {model.charts.length > 0 ? (
        <Section
          id="report-trend"
          title="Day by day"
          description="This period against the one before, aligned by day"
          className="break-inside-avoid"
        >
          <div className="grid gap-x-10 md:grid-cols-2 print:grid-cols-2 [&>section]:mt-0 [&>section]:border-t-0 [&>section]:pt-0">
            {model.charts.map((chart) => (
              <FindingChart
                key={chart.title}
                chart={chart}
                currency={model.currency}
                currentLabel={model.currentLabel}
                previousLabel={model.previousLabel}
              />
            ))}
          </div>
        </Section>
      ) : null}

      <Section
        id="report-findings"
        title="What we found"
        description={
          model.findingTotal > model.findings.length
            ? `The ${model.findings.length} most important of ${model.findingTotal}`
            : undefined
        }
      >
        <Findings model={model} />
      </Section>

      <Section
        id="report-campaigns"
        title="Top campaigns"
        description={shownOf(model.campaigns.length, model.campaignTotal, "campaigns")}
      >
        {model.campaigns.length > 0 ? (
          <EntityTable
            caption={`Top campaigns by spend, ${model.currentLabel}`}
            nameLabel="Campaign"
            rows={model.campaigns}
            model={model}
            campaigns
          />
        ) : (
          <p className="text-sm text-ink-muted">No campaign spent in this period.</p>
        )}
      </Section>

      <Section
        id="report-creatives"
        title="Top creatives"
        description={shownOf(model.creatives.length, model.creativeTotal, "creatives")}
      >
        {model.creatives.length > 0 ? (
          <EntityTable
            caption={`Top creatives by spend, ${model.currentLabel}`}
            nameLabel="Creative"
            rows={model.creatives}
            model={model}
            campaigns={false}
          />
        ) : (
          <p className="text-sm text-ink-muted">No creative spent in this period.</p>
        )}
      </Section>

      <NotesEditor
        key={`${model.clientId}-${model.current.start}-${model.current.end}`}
        clientId={model.clientId}
        periodStart={model.current.start}
        periodEnd={model.current.end}
        initial={note?.body ?? ""}
        suggestion={suggestedNextSteps(model.findings)}
        canSave={canSave}
      />

      <footer className="border-t border-border pt-4 text-xs text-ink-muted">
        {model.demo
          ? `Figures are computed from the seeded demo dataset for ${model.currentLabel} and the ${model.comparison}; they are not real results.`
          : `Figures are computed from ${model.clientName}'s Meta Ads daily data for ${model.currentLabel} and the ${model.comparison}.`}{" "}
        Prepared by {model.agencyName}.
      </footer>
    </article>
  );
}
