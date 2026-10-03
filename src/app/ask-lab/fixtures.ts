import { formatChange, formatDateRange, formatPercent } from "@/domain/format";
import {
  DETECTOR_LABELS,
  INSIGHT_RULES,
  formatInsightValue,
  runInsightEngine,
  type ComparisonRow,
  type EntityFacts,
  type EvidenceItem,
  type InsightEntity,
} from "@/domain/insights";
import { percentChange, snapshot } from "@/domain/metrics";
import { collectInsightFacts } from "@/features/insights/facts";
import type { Workspace } from "@/features/workspace/server";
import type { AnswerTable, AskLabModel } from "./model";

const shortName = (name: string) => name.split(" | ").at(-1) ?? name;

/** Lab-only copy around actual metrics and detector findings. No production imports this. */
export function buildAskLab(workspace: Workspace): AskLabModel {
  const { repository, client, periods } = workspace;
  const facts = collectInsightFacts(repository, client, periods);
  const findings = runInsightEngine(facts);
  const format = (value: number | null, kind: EvidenceItem["format"]) =>
    formatInsightValue(value, kind, client.currency);
  const campaignFindings = findings.filter((finding) => finding.entity.type === "campaign");
  const campaign =
    facts.campaigns.find((item) => item.entity.id === campaignFindings[0]?.entity.id) ??
    [...facts.campaigns].sort((a, b) => b.current.totals.spend - a.current.totals.spend)[0];
  if (!campaign) throw new Error("Ask lab requires a seeded campaign.");
  const selectedFinding = campaignFindings.find(
    (item) => item.entity.id === campaign.entity.id,
  );
  const { vocabulary } = facts.context;
  const outcomes = vocabulary.plural.toLowerCase();
  const cost = vocabulary.costLabel;
  const name = shortName(campaign.entity.name);
  const account = facts.account;

  const comparisonFor = (entity: EntityFacts): ComparisonRow[] => [
    {
      label: "Spend",
      format: "money",
      current: entity.current.totals.spend,
      previous: entity.previous.totals.spend,
      change: percentChange(entity.current.totals.spend, entity.previous.totals.spend),
      higherIsBetter: null,
    },
    {
      label: vocabulary.plural,
      format: "count",
      current: entity.current.totals.conversions,
      previous: entity.previous.totals.conversions,
      change: percentChange(
        entity.current.totals.conversions,
        entity.previous.totals.conversions,
      ),
      higherIsBetter: true,
    },
    {
      label: cost,
      format: "cost",
      current: entity.current.derived.cpa,
      previous: entity.previous.derived.cpa,
      change: percentChange(entity.current.derived.cpa, entity.previous.derived.cpa),
      higherIsBetter: false,
    },
  ];
  const evidenceFor = (entity: EntityFacts): EvidenceItem[] =>
    comparisonFor(entity).map((row) => ({
      label: row.label,
      value: row.current,
      format: row.format,
      change: row.change,
      higherIsBetter: row.higherIsBetter,
      note: `from ${format(row.previous, row.format)}`,
    }));

  const cpaChange = percentChange(account.current.derived.cpa, account.previous.derived.cpa);
  const cpaTitle =
    cpaChange === null
      ? "There is no comparable account CPA for this period."
      : Math.abs(cpaChange) < INSIGHT_RULES.steady
        ? "Account CPA is essentially flat. The campaign picture is not."
        : cpaChange > 0
          ? `Account CPA rose ${formatPercent(cpaChange)}.`
          : `Account CPA fell ${formatPercent(Math.abs(cpaChange))}, rather than rising.`;
  const cpaSummary =
    cpaChange === null
      ? "A missing or zero comparison denominator prevents a meaningful CPA change. Review the spend and outcome totals separately."
      : `It moved from ${format(account.previous.derived.cpa, "cost")} to ${format(account.current.derived.cpa, "cost")} (${formatChange(cpaChange)}). ${selectedFinding ? `${name}: ${selectedFinding.headline.charAt(0).toLowerCase()}${selectedFinding.headline.slice(1)}` : `${name} has the most spend and is a starting point for inspection, not a diagnosed problem.`}`;

  const ranked = campaignFindings.slice(0, 3).flatMap((finding) => {
    const item = facts.campaigns.find((candidate) => candidate.entity.id === finding.entity.id);
    return item ? [{ finding, item }] : [];
  });
  const campaignsTable: AnswerTable = {
    title: "Campaigns to review",
    identityLabel: "Campaign",
    columns: [
      { label: "Spend", format: "money" },
      { label: vocabulary.plural, format: "count" },
      { label: "CPA now", format: "cost" },
      { label: "CPA before", format: "cost" },
    ],
    rows: ranked.map(({ finding, item }) => ({
      id: item.entity.id,
      name: shortName(item.entity.name),
      context: DETECTOR_LABELS[finding.detector],
      values: [
        item.current.totals.spend,
        item.current.totals.conversions,
        item.current.derived.cpa,
        item.previous.derived.cpa,
      ],
    })),
    note: "Insights order: priority, then spend involved. A review order, not causal attribution.",
  };

  // Re-aggregate only this campaign's ads: a reused creative must not leak metrics
  // from another campaign into an answer to “in that campaign”.
  const campaignAdIds = new Set(campaign.ads.map((ad) => ad.entity.id));
  const campaignAds = repository
    .listAdsForClient(client.id)
    .filter((ad) => campaignAdIds.has(ad.id));
  const creativeRows = repository
    .listCreatives(client.id)
    .flatMap((creative) => {
      const ads = campaignAds.filter((ad) => ad.creativeId === creative.id);
      if (!ads.length) return [];
      const measure = (range: typeof periods.current) =>
        snapshot(
          repository.queryMetrics({
            clientId: client.id,
            entityIds: ads.map((ad) => ad.id),
            range,
          }),
        );
      return [
        {
          creative,
          ads,
          current: measure(periods.current),
          previous: measure(periods.previous),
        },
      ];
    })
    .sort((a, b) => b.current.totals.spend - a.current.totals.spend);
  const creativeEntities: InsightEntity[] = creativeRows.map(({ creative, ads }) => ({
    type: "creative",
    id: creative.id,
    name: creative.name,
    context: `${creative.type} · ${ads.length} ${ads.length === 1 ? "ad" : "ads"} in ${name}`,
  }));
  const leadingCreative = creativeRows[0];
  const creativesTable: AnswerTable = {
    title: `Creatives in ${name}`,
    identityLabel: "Creative",
    columns: [
      { label: "Spend", format: "money" },
      { label: vocabulary.plural, format: "count" },
      { label: "CPA now", format: "cost" },
      { label: "CPA before", format: "cost" },
    ],
    rows: creativeRows.map(({ creative, ads, current, previous }) => ({
      id: creative.id,
      name: creative.name,
      context: `${creative.type} · ${ads.length} ${ads.length === 1 ? "ad" : "ads"}`,
      values: [
        current.totals.spend,
        current.totals.conversions,
        current.derived.cpa,
        previous.derived.cpa,
      ],
      artwork: { thumbnail: creative.thumbnail, type: creative.type },
    })),
    note: "Ranked by spend. Only ads in this campaign are counted; artwork is seeded placeholder imagery.",
  };

  const targetNote =
    facts.context.targetCpa === null
      ? "No CPA target is configured."
      : `The client’s ${cost.toLowerCase()} target is ${format(facts.context.targetCpa, "cost")}.`;
  const sourceNote =
    "Seeded Meta Ads daily metrics, summed at ad level. CPA is total spend divided by total outcomes, never an average of row CPAs.";
  return {
    clientName: client.name,
    currency: client.currency,
    currentLabel: formatDateRange(periods.current),
    previousLabel: formatDateRange(periods.previous),
    comparison: workspace.comparison,
    answers: {
      cpa: {
        id: "cpa",
        title: cpaTitle,
        summary: cpaSummary,
        scope: `${client.name} · account`,
        evidence: evidenceFor(account),
        entities: [campaign.entity],
        comparison: comparisonFor(account),
        limitation: "These changes show what happened, not why people converted differently.",
        next: `Inspect ${name} before treating the account average as the whole story.`,
        methodology: `${sourceNote} “Essentially flat” means a relative change below ${formatPercent(INSIGHT_RULES.steady, 0)}. ${targetNote}`,
        followUps: ["campaign", "limits"],
      },
      campaign: {
        id: "campaign",
        title: `Start with ${name}.`,
        summary: selectedFinding
          ? `${selectedFinding.headline} It is the first campaign in the deterministic Insights review order. ${targetNote}`
          : `It has the most spend in this period. No campaign finding was flagged, so this is a starting point for inspection, not a detected issue.`,
        scope: campaign.entity.name,
        evidence: evidenceFor(campaign),
        entities: ranked.length ? ranked.map(({ item }) => item.entity) : [campaign.entity],
        table: campaignsTable,
        limitation:
          "The campaign changes do not establish a cause for the account’s CPA movement.",
        next: `Inspect the creatives delivering inside ${name}. No budget change is applied.`,
        methodology: `${sourceNote} ${selectedFinding?.reason ?? "No campaign detector fired."}`,
        followUps: ["creatives", "limits"],
      },
      creatives: {
        id: "creatives",
        title: `${creativeRows.length} creatives, scoped to ${name}.`,
        summary: leadingCreative
          ? `${leadingCreative.creative.name} leads spend at ${format(leadingCreative.current.totals.spend, "money")}, with ${leadingCreative.current.totals.conversions} ${outcomes} at ${format(leadingCreative.current.derived.cpa, "cost")} each. This ranking describes delivery, not creative quality.`
          : "No creatives are linked to the ads in this campaign.",
        scope: campaign.entity.name,
        evidence: evidenceFor(campaign),
        entities: [campaign.entity, ...creativeEntities],
        table: creativesTable,
        limitation:
          "Performance alone does not establish fatigue, audience quality or an attribution problem.",
        next: "Check each creative’s delivery and recent edits before deciding what to change.",
        methodology: `${sourceNote} Creative metrics include only ads belonging to ${name}, for these two periods. No visual classification was performed.`,
        followUps: ["limits", "cpa"],
      },
      limits: {
        id: "limits",
        title: "The available data cannot establish audience fatigue.",
        summary: `For ${name}, I can confirm CTR of ${format(campaign.current.derived.ctr, "percent")} versus ${format(campaign.previous.derived.ctr, "percent")} previously. That is an observed rate, not evidence of a particular cause.`,
        scope: campaign.entity.name,
        evidence: [
          {
            label: "CTR",
            value: campaign.current.derived.ctr,
            format: "percent",
            change: percentChange(campaign.current.derived.ctr, campaign.previous.derived.ctr),
            higherIsBetter: true,
            note: `from ${format(campaign.previous.derived.ctr, "percent")}`,
          },
          ...evidenceFor(campaign).filter((item) => item.label !== vocabulary.plural),
        ],
        entities: [campaign.entity],
        limitation:
          "Audience frequency, change history and attribution diagnostics are not available in this dataset. I cannot confirm or rule out fatigue.",
        next: "Check audience frequency and recent targeting or creative changes in the source account before attributing a cause.",
        methodology: `${sourceNote} No benchmark, competitor comparison or causal model is available.`,
        followUps: ["creatives", "campaign"],
      },
    },
  };
}
