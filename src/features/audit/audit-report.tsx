"use client";

import { Printer } from "lucide-react";
import { useId, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CampaignName } from "@/components/ui/campaign-name";
import { Delta } from "@/components/ui/delta";
import {
  countsPhrase,
  DETECTOR_LABELS,
  formatInsightValue,
  PRIORITY_ORDER,
  type InsightPriority,
  type ValueFormat,
} from "@/domain/insights";
import { FindingDetail, INSIGHT_MATERIALITY } from "@/features/insights/finding-detail";
import { PriorityDot } from "@/features/insights/priority";
import { cn } from "@/lib/cn";
import type { AuditReport } from "./audit";
import s from "./audit.module.css";

/**
 * The audit report, in the app's type on a white panel: what the file covers,
 * spend on the campaigns the rules flagged (named as exactly that), every
 * finding with its evidence by the shipped `FindingDetail`, and the campaigns
 * ledger for the compared period. Every figure is the file's or the rules'.
 */

const GROUP_TITLES: Record<InsightPriority, string> = {
  high: "Needs attention",
  opportunity: "Opportunities",
  watch: "Watch",
};

function Fact({
  label,
  value,
  detail,
  wide = false,
}: {
  label: string;
  value: string;
  detail?: string;
  /** Takes the full row on phones, where a date range is wider than half. */
  wide?: boolean;
}) {
  return (
    <div
      className={cn("min-w-0 py-3 md:px-5 md:first:pl-0", wide && "col-span-2 md:col-span-1")}
    >
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold tracking-[-0.01em] whitespace-nowrap text-ink tabular">
        {value}
      </dd>
      {detail ? <dd className="mt-0.5 text-xs text-ink-muted">{detail}</dd> : null}
    </div>
  );
}

function Section({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("mt-8 border-t border-border pt-5", className)}>
      <h3 id={id} className="text-base font-semibold tracking-[-0.01em] text-ink">
        {title}
      </h3>
      {description ? (
        <p className="mt-1 max-w-[80ch] text-sm leading-5 text-ink-muted">{description}</p>
      ) : null}
      {children}
    </section>
  );
}

export function AuditReportView({
  report,
  sample,
  onReset,
  onOutcome,
}: {
  report: AuditReport;
  sample: boolean;
  onReset: () => void;
  onOutcome: (column: number) => void;
}) {
  const { file, periods, vocabulary, currency, spend } = report;
  const fmt = (value: number | null, format: ValueFormat) =>
    formatInsightValue(value, format, currency);
  const plural = vocabulary.plural.toLowerCase();
  const campaignsWord = (n: number) => `${n} ${n === 1 ? "campaign" : "campaigns"}`;
  const windowPhrase = `the last ${periods.days} days of the file (${periods.currentLabel})`;
  const outcomeId = useId();

  return (
    <article
      className={cn(s.panel, s.report, "font-sans text-ink")}
      aria-labelledby="audit-title"
    >
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-ink-muted">Wasted-spend audit</p>
          <h2
            id="audit-title"
            className="mt-1 text-[20px] leading-7 font-semibold tracking-[-0.02em] break-words"
          >
            {report.accountName ?? report.fileName}
          </h2>
          <p className="mt-1 text-sm leading-5 text-ink-muted tabular">
            {file.label} · {file.span} days · {campaignsWord(file.campaigns)} · {file.ads}{" "}
            {file.ads === 1 ? "ad" : "ads"} · {report.fileName}
          </p>
          {sample ? (
            <p className="mt-2 text-sm leading-5 font-medium text-ink-secondary">
              Sample data: generated from the Ad Analyst demo’s fictional Luxe Skin Co. account,
              not a real client.
            </p>
          ) : null}
        </div>
        <div className={cn("flex shrink-0 gap-2", s.noPrint)}>
          <Button onClick={() => window.print()}>
            <Printer aria-hidden size={14} strokeWidth={1.75} />
            Save as PDF
          </Button>
          <Button variant="ghost" onClick={onReset}>
            Audit another file
          </Button>
        </div>
      </header>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 border-t border-border md:grid-cols-4 md:gap-x-0 md:divide-x md:divide-border">
        <Fact label="Period covered" value={file.label} detail={`${file.span} days`} wide />
        <Fact label="Spend" value={fmt(file.spend, "money")} detail="Every day in the file" />
        <Fact
          label={vocabulary.plural}
          value={fmt(file.conversions, "count")}
          detail={`${vocabulary.costLabel} ${fmt(file.conversions > 0 ? file.spend / file.conversions : null, "cost")}`}
        />
        {report.revenueTracked ? (
          <Fact
            label="Conversion value"
            value={fmt(file.revenue, "money")}
            detail={`ROAS ${fmt(file.spend > 0 ? file.revenue / file.spend : null, "multiple")}`}
          />
        ) : (
          <Fact
            label="Ads"
            value={fmt(file.ads, "count")}
            detail={campaignsWord(file.campaigns)}
          />
        )}
      </dl>

      <Section
        title="Spend on flagged campaigns"
        description={`In ${windowPhrase}. These are amounts spent on campaigns the rules flagged, not an estimate of money lost.`}
      >
        <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-ink-secondary">On campaigns that need attention</dt>
            <dd className="mt-0.5 text-[26px] leading-8 font-semibold tracking-[-0.02em] text-ink tabular">
              {fmt(spend.needsAttention, "money")}
            </dd>
            <dd className="mt-0.5 text-xs text-ink-muted tabular">
              {campaignsWord(spend.needsAttentionCampaigns)} ·{" "}
              {fmt(spend.period > 0 ? spend.needsAttention / spend.period : 0, "share")} of{" "}
              {fmt(spend.period, "money")} spent
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-secondary">On campaigns with no {plural}</dt>
            <dd className="mt-0.5 text-[26px] leading-8 font-semibold tracking-[-0.02em] text-ink tabular">
              {fmt(spend.zeroConversion, "money")}
            </dd>
            <dd className="mt-0.5 text-xs text-ink-muted tabular">
              {campaignsWord(spend.zeroConversionCampaigns)}
              {spend.zeroConversionCampaigns > 0 ? " · also counted as needing attention" : ""}
            </dd>
          </div>
        </dl>
      </Section>

      <Section
        title="What the rules found"
        description={`${countsPhrase(report.counts)}, comparing ${periods.currentLabel} with ${periods.previousLabel}. No targets are set, so cost and ROAS are judged against the previous ${periods.days} days.`}
      >
        {report.findings.length === 0 ? (
          <p className="mt-4 text-sm text-ink-secondary">
            No findings for these periods. The rules check spend without {plural}, rising cost
            per {vocabulary.singular.toLowerCase()}, falling {plural}, ROAS and CTR, creative
            fatigue, spend concentration, and campaigns or ads worth scaling.
          </p>
        ) : (
          PRIORITY_ORDER.map((priority) => {
            const group = report.findings.filter((f) => f.priority === priority);
            if (group.length === 0) return null;
            return (
              <div key={priority} className="mt-6">
                <h4 className="flex items-center gap-2 text-xs font-medium text-ink-secondary">
                  <PriorityDot priority={priority} />
                  {GROUP_TITLES[priority]}
                  <span className="text-ink-faint tabular">{group.length}</span>
                </h4>
                <ol className={s.findings}>
                  {group.map((finding) => (
                    <li key={finding.id} className={s.finding}>
                      <FindingDetail
                        finding={finding}
                        currency={currency}
                        currentLabel={periods.currentLabel}
                        previousLabel={periods.previousLabel}
                      />
                    </li>
                  ))}
                </ol>
              </div>
            );
          })
        )}
      </Section>

      <Section
        title="Campaigns"
        description={`${periods.currentLabel}, with the change against ${periods.previousLabel}.`}
      >
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <caption className="sr-only">
              Campaigns, {periods.currentLabel} against {periods.previousLabel}
            </caption>
            <thead>
              <tr className="border-b border-border bg-surface-subtle text-xs text-ink-muted">
                <th scope="col" className="h-9 px-4 text-left font-medium">
                  Campaign
                </th>
                <th scope="col" className="h-9 px-3 text-right font-medium">
                  Spend
                </th>
                <th scope="col" className="h-9 px-3 text-right font-medium">
                  {vocabulary.plural}
                </th>
                <th scope="col" className="h-9 px-3 text-right font-medium">
                  {vocabulary.costLabel}
                </th>
                {report.revenueTracked ? (
                  <th scope="col" className="h-9 px-3 text-right font-medium">
                    ROAS
                  </th>
                ) : null}
                <th scope="col" className="h-9 px-4 text-left font-medium">
                  Finding
                </th>
              </tr>
            </thead>
            <tbody>
              {report.campaigns.map((row) => (
                <tr key={row.id} className="border-b border-border">
                  <th scope="row" className="max-w-[360px] px-4 py-2 text-left font-normal">
                    <CampaignName
                      name={row.name}
                      className="truncate text-sm leading-5 font-medium text-ink"
                    />
                    {row.status === "active" ? null : (
                      <span className="text-xs text-ink-muted">Not delivering</span>
                    )}
                  </th>
                  <td className="px-3 py-2 text-right whitespace-nowrap tabular">
                    <span className="font-medium text-ink">{fmt(row.spend, "money")}</span>
                    <span className="block">
                      <Delta
                        change={row.spendChange}
                        higherIsBetter={null}
                        neutralBelow={INSIGHT_MATERIALITY}
                      />
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap tabular">
                    <span className="text-ink-secondary">{fmt(row.conversions, "count")}</span>
                    <span className="block">
                      <Delta
                        change={row.conversionsChange}
                        higherIsBetter
                        neutralBelow={INSIGHT_MATERIALITY}
                      />
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap text-ink-secondary tabular">
                    {fmt(row.cpa, "cost")}
                  </td>
                  {report.revenueTracked ? (
                    <td className="px-3 py-2 text-right whitespace-nowrap text-ink-secondary tabular">
                      {fmt(row.roas, "multiple")}
                    </td>
                  ) : null}
                  <td className="px-4 py-2 whitespace-nowrap">
                    {row.finding ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-ink-secondary">
                        <PriorityDot priority={row.finding.priority} />
                        {DETECTOR_LABELS[row.finding.detector]}
                      </span>
                    ) : (
                      <span className="text-xs text-ink-faint">None</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {report.campaigns.length > 1 ? (
              <tfoot>
                <tr className="text-ink">
                  <th scope="row" className="px-4 py-2.5 text-left text-sm font-semibold">
                    Total · {campaignsWord(report.campaigns.length)}
                  </th>
                  <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap tabular">
                    {fmt(report.totals.spend, "money")}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap tabular">
                    {fmt(report.totals.conversions, "count")}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap tabular">
                    {fmt(report.totals.cpa, "cost")}
                  </td>
                  {report.revenueTracked ? (
                    <td className="px-3 py-2.5 text-right whitespace-nowrap tabular">
                      {fmt(report.totals.roas, "multiple")}
                    </td>
                  ) : null}
                  <td />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </Section>

      <Section title="How the file was read">
        <ul className="mt-3 space-y-1.5 text-sm leading-5 text-ink-secondary">
          <li>
            {vocabulary.plural} are counted from “{report.outcome.header}”
            {report.revenueTracked ? ", and ROAS from the conversion value column" : ""}. Cost
            per {vocabulary.singular.toLowerCase()}, ROAS and CTR are calculated from the
            totals, not read from the file.
          </li>
          <li>
            The rules compare {periods.currentLabel} with {periods.previousLabel}
            {file.span % 2 === 1 ? `; the first day of the file sits outside both` : ""}.
          </li>
          {report.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        {report.outcomeOptions.length > 1 ? (
          <div className={cn("mt-4 flex flex-wrap items-center gap-3", s.noPrint)}>
            <label htmlFor={outcomeId} className="text-sm text-ink-secondary">
              Count conversions from
            </label>
            <select
              id={outcomeId}
              value={report.outcome.column}
              onChange={(e) => onOutcome(Number(e.target.value))}
              className="h-8 rounded-md border border-border-strong bg-surface px-2 text-sm text-ink hover:border-ink-faint focus-visible:border-accent-border focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent"
            >
              {report.outcomeOptions.map((option) => (
                <option key={option.column} value={option.column}>
                  {option.header}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </Section>
    </article>
  );
}
