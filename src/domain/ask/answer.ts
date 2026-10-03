import { formatChange, formatPercent } from "../format";
import {
  DETECTOR_LABELS,
  INSIGHT_RULES,
  formatInsightValue,
  type ComparisonRow,
  type EntityFacts,
  type Finding,
  type InsightEntity,
  type ValueFormat,
} from "../insights";
import { dailyMetricSeries, metricValue, percentChange } from "../metrics";
import { rangeLength } from "../periods";
import type { MetricKey } from "../types";
import { interpretQuestion, normalizeQuestion } from "./interpret";
import {
  ASK_SUGGESTIONS,
  type AskAnswer,
  type AskContext,
  type AskData,
  type AskResult,
  type AskTable,
} from "./model";

const CAMPAIGN_QUESTION = "Which campaign should I investigate first?";
const CREATIVE_QUESTION = "Show me the creatives in that campaign.";
const FATIGUE_QUESTION = "Does the data prove audience fatigue?";
const SPEND_QUESTION = "Was spend also higher?";
const shortName = (entity: InsightEntity) => entity.name.split(" | ").at(-1) ?? entity.name;

export function cleanContext(data: AskData, supplied?: AskContext): AskContext {
  const context: AskContext = { scopeKey: data.scope.key };
  if (supplied?.scopeKey !== data.scope.key) return context;
  if (data.facts.campaigns.some((item) => item.entity.id === supplied.campaignId))
    context.campaignId = supplied.campaignId;
  if (data.facts.creatives.some((item) => item.entity.id === supplied.creativeId))
    context.creativeId = supplied.creativeId;
  const previous = supplied.previousEntity;
  if (
    previous &&
    ((previous.type === "account" && previous.id === data.facts.account.entity.id) ||
      (previous.type === "campaign" && previous.id === context.campaignId) ||
      (previous.type === "creative" && previous.id === context.creativeId))
  )
    context.previousEntity = previous;
  context.previousIntent = supplied.previousIntent;
  return context;
}

function resolveSubject(
  question: string,
  data: AskData,
  context: AskContext,
): { subject?: EntityFacts; problem?: string } {
  const q = normalizeQuestion(question);
  const creativePool = context.campaignId
    ? data.facts.creatives.map(
        (creative) =>
          data.campaignCreatives[context.campaignId!]?.find(
            (row) => row.entity.id === creative.entity.id,
          ) ?? creative,
      )
    : data.facts.creatives;
  const candidates = [...data.facts.campaigns, ...creativePool];
  const named = candidates.filter(({ entity }) =>
    [entity.name, shortName(entity)].some((name) => {
      const alias = normalizeQuestion(name);
      return alias.length >= 4 && ` ${q} `.includes(` ${alias} `);
    }),
  );
  if (named.length > 1) return { problem: "Please name one campaign or creative at a time." };
  if (named.length === 1) return { subject: named[0] };
  if (/\b(?:that|this|selected|same) campaign\b/.test(q))
    return {
      subject: data.facts.campaigns.find((item) => item.entity.id === context.campaignId),
      problem: context.campaignId
        ? undefined
        : "Which campaign do you mean? Ask which campaign to investigate, or include its name.",
    };
  if (/\b(?:that|this|selected|same) creative\b/.test(q))
    return {
      subject: creativePool.find((item) => item.entity.id === context.creativeId),
      problem: context.creativeId
        ? undefined
        : "Which creative do you mean? Ask which creative to investigate, or include its name.",
    };
  if (
    /["“”]/.test(question) ||
    /\b(?:campaign|creative) (?:called|named)\b/.test(q) ||
    /\b(?:for|in) (?!the (?:selected|current|previous|last)|this (?:period|week)|that |my (?:account|campaign)|the (?:account|campaign)|all campaigns)\S/.test(
      q,
    )
  )
    return {
      problem:
        "I could not uniquely match that entity in the selected client. Use its displayed name.",
    };
  if (/\b(?:account|overall|all campaigns)\b/.test(q)) return { subject: data.facts.account };
  if (/\b(?:also|it|its|fatigue|that)\b/.test(q) && context.previousEntity) {
    return {
      subject:
        candidates.find((item) => item.entity.id === context.previousEntity?.id) ??
        data.facts.account,
    };
  }
  return { subject: data.facts.account };
}

/** The only answer pipeline. Interpretation selects a deterministic query; JSX sees its result. */
export function answerQuestion(
  question: string,
  data: AskData,
  supplied?: AskContext,
): AskResult {
  const { facts, scope, findings } = data;
  const context = cleanContext(data, supplied);
  const interpretation = interpretQuestion(question);
  const format = (value: number | null, kind: ValueFormat) =>
    formatInsightValue(value, kind, scope.currency);
  const vocabulary = facts.context.vocabulary;
  const answer: AskAnswer = {
    intent: interpretation.intent,
    state: "available",
    scope,
    title: "",
    summary: "",
    metrics: [],
    comparison: [],
    entities: [],
    table: null,
    chart: null,
    evidenceLimit:
      "These metrics describe observed performance. They do not establish a cause or predict the result of a budget change.",
    nextInspection: "Review the underlying campaign or creative before making changes.",
    followUps: [CAMPAIGN_QUESTION, "What changed from the previous period?"],
    methodology:
      "Stored ad-level daily metrics are summed within the selected client and both date ranges. Ratios are recomputed from totals, not averaged. No external AI is used.",
    sources: [],
  };
  const finish = (): AskResult => ({ answer, context });
  const cannot = (state: AskAnswer["state"], title: string, summary: string): AskResult => {
    answer.state = state;
    answer.title = title;
    answer.summary = summary;
    answer.followUps = [...ASK_SUGGESTIONS];
    answer.evidenceLimit = "No unsupported metric, benchmark or cause has been inferred.";
    answer.nextInspection = "Choose one of the supported questions below.";
    return finish();
  };
  if (interpretation.intent === "unsupported")
    return cannot(
      "unsupported",
      "I can’t answer that reliably from the available analysis yet.",
      interpretation.reason ??
        "Try a question about performance, spend, campaigns or creatives.",
    );
  if (
    interpretation.requestedDays !== undefined &&
    interpretation.requestedDays !== rangeLength(scope.current)
  )
    return cannot(
      "clarification",
      "The question and selected date range differ.",
      `Your question asks about ${interpretation.requestedDays} days. The selected range covers ${rangeLength(scope.current)} days. Change the date control first so the answer uses the intended period.`,
    );
  const resolved = resolveSubject(question, data, context);
  if (resolved.problem)
    return cannot("clarification", "I need a clearer entity reference.", resolved.problem);
  let subject = resolved.subject ?? facts.account;
  const focus = (entity: EntityFacts) => {
    subject = entity;
    answer.entities = [entity.entity];
    answer.sources.push(`metrics:${entity.entity.type}:${entity.entity.id}`);
    if (
      entity.entity.type === "creative" &&
      context.campaignId &&
      entity.entity.context ===
        data.facts.campaigns.find((campaign) => campaign.entity.id === context.campaignId)
          ?.entity.name
    )
      answer.methodology += ` Creative metrics are restricted to ${entity.entity.context}; delivery in other campaigns is excluded.`;
    context.previousIntent = interpretation.intent;
    if (entity.entity.type === "campaign") {
      context.campaignId = entity.entity.id;
      delete context.creativeId;
    }
    if (entity.entity.type === "creative") {
      context.creativeId = entity.entity.id;
      const parents = Object.entries(data.campaignCreatives).filter(([, rows]) =>
        rows.some((row) => row.entity.id === entity.entity.id),
      );
      if (parents.length === 1) context.campaignId = parents[0][0];
      else if (!parents.some(([id]) => id === context.campaignId)) delete context.campaignId;
    }
    if (
      entity.entity.type === "account" ||
      entity.entity.type === "campaign" ||
      entity.entity.type === "creative"
    )
      context.previousEntity = { type: entity.entity.type, id: entity.entity.id };
  };
  const row = (
    entity: EntityFacts,
    key: MetricKey,
    label: string,
    kind: ValueFormat,
    higherIsBetter: boolean | null,
  ): ComparisonRow => {
    const current = metricValue(entity.current, key),
      previous = metricValue(entity.previous, key);
    return {
      label,
      format: kind,
      current,
      previous,
      change: percentChange(current, previous),
      higherIsBetter,
    };
  };
  const basic = (entity: EntityFacts) => [
    row(entity, "spend", "Spend", "money", null),
    row(entity, "conversions", vocabulary.plural, "count", true),
    row(entity, "cpa", vocabulary.costLabel, "cost", false),
  ];
  const evidence = (rows: ComparisonRow[]) => {
    answer.comparison = rows;
    answer.metrics = rows.map((item) => ({
      label: item.label,
      value: item.current,
      format: item.format,
      change: item.change,
      higherIsBetter: item.higherIsBetter,
      note: `from ${format(item.previous, item.format)}`,
    }));
  };
  const table = (title: string, entities: EntityFacts[], note: string): AskTable => ({
    title,
    columns: [
      { label: "Spend", format: "money" },
      { label: vocabulary.plural, format: "count" },
      { label: vocabulary.costLabel, format: "cost" },
      { label: "Previous cost", format: "cost" },
    ],
    rows: entities.slice(0, 6).map((entity) => ({
      entity: entity.entity,
      values: [
        entity.current.totals.spend,
        entity.current.totals.conversions,
        entity.current.derived.cpa,
        entity.previous.derived.cpa,
      ],
    })),
    note: `${note}${entities.length > 6 ? ` Showing the first 6 of ${entities.length}.` : ""}`,
  });
  const byId = (id: string) =>
    [
      facts.account,
      ...facts.campaigns,
      ...facts.creatives,
      ...facts.campaigns.flatMap((campaign) => campaign.ads),
    ].find((item) => item.entity.id === id);
  const applyFinding = (finding: Finding) => {
    const entity = byId(finding.entity.id);
    if (entity) focus(entity);
    answer.metrics = finding.evidence;
    answer.comparison = finding.comparison;
    answer.chart = finding.chart;
    answer.summary = finding.headline;
    answer.nextInspection = finding.action;
    answer.methodology += ` ${finding.reason}`;
    answer.sources.push(`detector:${finding.id}`);
  };
  const showChart = (key: MetricKey, label: string, kind: ValueFormat) => {
    if (rangeLength(scope.current) < INSIGHT_RULES.chartMinDays) return;
    answer.chart = {
      title: `Daily ${label.toLowerCase()}`,
      format: kind,
      current: dailyMetricSeries(subject.daily.current, key).map((value, i) => ({
        date: subject.daily.current[i].date,
        value,
      })),
      previous: dailyMetricSeries(subject.daily.previous, key).map((value, i) => ({
        date: subject.daily.previous[i].date,
        value,
      })),
      summary: `${label}: ${format(metricValue(subject.current, key), kind)} for the selected period; ${format(metricValue(subject.previous, key), kind)} previously. Daily observations are aligned by day index, not calendar date.`,
    };
  };
  const followEntity = () => {
    answer.followUps =
      subject.entity.type === "campaign"
        ? [CREATIVE_QUESTION, SPEND_QUESTION, FATIGUE_QUESTION]
        : [SPEND_QUESTION, FATIGUE_QUESTION, CAMPAIGN_QUESTION];
  };

  // Ranking and account-wide detectors must not silently ignore a named scope.
  if (
    subject.entity.type !== "account" &&
    [
      "waste",
      "concentration",
      "investigate_campaign",
      "deterioration",
      "improvement",
      "strongest_campaign",
      "weakest_campaign",
      "strongest_creative",
      "investigate_creative",
    ].includes(interpretation.intent)
  )
    return cannot(
      "clarification",
      "That query uses an account-wide ranking.",
      "Ask the ranking without an entity reference, or ask about CPA, CTR, spend or the period comparison for the named entity.",
    );

  switch (interpretation.intent) {
    case "cpa":
    case "roas":
    case "ctr":
    case "spend": {
      if (interpretation.intent === "roas" && !facts.context.tracksRevenue)
        return cannot(
          "insufficient",
          "ROAS is not available for this client.",
          `Revenue is not tracked here. Use ${vocabulary.costLabel.toLowerCase()} and ${vocabulary.plural.toLowerCase()} instead.`,
        );
      const spec = {
        cpa: ["cpa", vocabulary.costLabel, "cost", false],
        roas: ["roas", "Return on ad spend", "multiple", true],
        ctr: ["ctr", "Click-through rate", "percent", true],
        spend: ["spend", "Spend", "money", null],
      }[interpretation.intent] as [MetricKey, string, ValueFormat, boolean | null];
      const [key, label, kind, desirable] = spec;
      focus(subject);
      const movement = row(subject, key, label, kind, desirable);
      const name = subject.entity.type === "account" ? "Account" : shortName(subject.entity);
      answer.title =
        movement.change === null
          ? `${label} has no comparable baseline.`
          : Math.abs(movement.change) < INSIGHT_RULES.steady
            ? `${name}: ${label.toLowerCase()} is essentially flat.`
            : `${name}: ${label.toLowerCase()} ${movement.change > 0 ? "rose" : "fell"} ${formatPercent(Math.abs(movement.change))}.`;
      answer.summary = `${label} is ${format(movement.current, kind)}, versus ${format(movement.previous, kind)} in the ${scope.comparison}. ${movement.change === null ? "A missing or zero baseline prevents a relative change calculation." : "The direction above reflects the data, even if the question assumed a different movement."}`;
      if (movement.current === null || movement.change === null) answer.state = "insufficient";
      evidence(
        [movement, ...basic(subject).filter((item) => item.label !== label)].slice(0, 3),
      );
      if (key !== "spend") showChart(key, label, kind);
      if (subject.entity.type === "account") {
        const related = findings.filter(
          (finding) =>
            finding.entity.type === "campaign" &&
            (key === "cpa"
              ? ["cpa_spike", "campaign_deterioration"].includes(finding.detector)
              : key === "roas"
                ? ["roas_decline", "campaign_deterioration"].includes(finding.detector)
                : key === "ctr"
                  ? finding.detector === "ctr_deterioration"
                  : true),
        );
        const rows = related.flatMap((finding) => {
          const item = byId(finding.entity.id);
          return item ? [item] : [];
        });
        if (rows.length)
          answer.table = table(
            "Related campaign findings",
            rows,
            "Insights priority, then spend. These are observations, not an attribution of the account movement.",
          );
        answer.sources.push(...related.map((finding) => `detector:${finding.id}`));
      }
      answer.methodology += ` Relative changes below ${formatPercent(INSIGHT_RULES.steady, 0)} are described as essentially flat.`;
      followEntity();
      break;
    }
    case "fatigue": {
      focus(subject);
      answer.state = "insufficient";
      answer.title = "The available data does not establish audience fatigue.";
      const ctr = row(subject, "ctr", "CTR", "percent", true);
      answer.summary = `${subject.entity.name}: CTR is ${format(ctr.current, "percent")} versus ${format(ctr.previous, "percent")} previously. ${ctr.change === null ? "There is no comparable CTR baseline." : `That is ${formatChange(ctr.change)}.`} Performance changes alone do not explain audience behaviour.`;
      evidence([ctr, ...basic(subject).filter((item) => item.label !== vocabulary.plural)]);
      const proxy = findings.find(
        (finding) =>
          finding.entity.id === subject.entity.id && finding.detector === "creative_fatigue",
      );
      if (proxy) {
        answer.methodology += ` A deterministic creative-fatigue proxy was flagged: ${proxy.reason} A proxy is not proof of audience fatigue.`;
        answer.sources.push(`detector:${proxy.id}`);
      }
      answer.evidenceLimit =
        "Frequency, audience overlap, targeting edits and attribution diagnostics are not available. I cannot confirm or rule out fatigue as a cause.";
      answer.nextInspection =
        "Inspect frequency and recent targeting or creative changes in the source account before assigning a cause.";
      answer.followUps = context.campaignId
        ? [CREATIVE_QUESTION, SPEND_QUESTION]
        : ["Which creative should I investigate?", CAMPAIGN_QUESTION];
      break;
    }
    case "campaign_creatives": {
      const campaign =
        subject.entity.type === "campaign"
          ? subject
          : facts.campaigns.find((item) => item.entity.id === context.campaignId);
      if (!campaign)
        return cannot(
          "clarification",
          "Which campaign do you mean?",
          "Ask which campaign to investigate first, or include a campaign name. No campaign has been selected in this scope.",
        );
      focus(campaign);
      const creatives = data.campaignCreatives[campaign.entity.id] ?? [];
      answer.title = `${creatives.length} creatives in ${shortName(campaign.entity)}.`;
      answer.summary =
        "Ranked by spend in this campaign only. A reused creative’s delivery in other campaigns is excluded; this is a delivery ranking, not a quality score.";
      evidence(basic(campaign));
      answer.table = creatives.length
        ? table(
            "Creatives in this campaign",
            creatives,
            "Only ads belonging to this campaign are included.",
          )
        : null;
      answer.entities.push(...creatives.map((item) => item.entity));
      answer.nextInspection =
        "Compare the creative-level costs and outcome counts before choosing an individual creative to inspect.";
      answer.followUps = creatives[0]
        ? [`What changed for "${creatives[0].entity.name}"?`, FATIGUE_QUESTION]
        : [CAMPAIGN_QUESTION];
      break;
    }
    case "waste": {
      const waste = findings.filter((finding) => finding.detector === "zero_conversion_spend");
      const rows = waste.flatMap((finding) => {
        const entity = byId(finding.entity.id);
        return entity ? [entity] : [];
      });
      if (!rows.length)
        return cannot(
          "insufficient",
          "No zero-conversion spend finding met the Insights thresholds.",
          "This does not mean all spend is efficient. The detector checks material spend against the client’s cost target; review campaign costs as well.",
        );
      applyFinding(waste[0]);
      answer.title = `${format(
        rows.reduce((total, item) => total + item.current.totals.spend, 0),
        "money",
      )} spent without recorded ${vocabulary.plural.toLowerCase()} in flagged campaigns.`;
      answer.table = table(
        "Zero-conversion spend findings",
        rows,
        "Ordered by spend. The existing Insights detector supplies eligibility and thresholds.",
      );
      answer.sources = waste.map((finding) => `detector:${finding.id}`);
      answer.evidenceLimit =
        "No recorded outcomes is an inspection signal, not proof that all this spend was wasted. Tracking and attribution may be incomplete.";
      followEntity();
      break;
    }
    case "investigate_campaign":
    case "deterioration":
    case "improvement":
    case "investigate_creative": {
      const creative = interpretation.intent === "investigate_creative";
      let selected = findings.filter(
        (finding) => finding.entity.type === (creative ? "creative" : "campaign"),
      );
      const costIncrease = (finding: Finding): number => {
        const fact = byId(finding.entity.id);
        return fact
          ? (percentChange(fact.current.derived.cpa, fact.previous.derived.cpa) ?? 0)
          : 0;
      };
      if (interpretation.intent === "deterioration")
        selected = selected
          .filter((finding) =>
            [
              "campaign_deterioration",
              "cpa_spike",
              "roas_decline",
              "ctr_deterioration",
            ].includes(finding.detector),
          )
          .filter((finding) => costIncrease(finding) > 0)
          .sort((a, b) => costIncrease(b) - costIncrease(a));
      if (interpretation.intent === "improvement")
        selected = selected
          .filter((finding) => finding.detector === "campaign_improvement")
          .sort(
            (a, b) =>
              (b.comparison.find((r) => r.label === vocabulary.plural)?.change ?? 0) -
              (a.comparison.find((r) => r.label === vocabulary.plural)?.change ?? 0),
          );
      const first = selected[0];
      if (!first)
        return cannot(
          "insufficient",
          "No qualifying finding was flagged for this question.",
          "The selected period did not meet the relevant Insights detector thresholds. This is not a claim that performance is unchanged.",
        );
      applyFinding(first);
      answer.title =
        interpretation.intent === "improvement"
          ? `Largest outcome improvement among flagged campaigns: ${shortName(first.entity)}.`
          : interpretation.intent === "deterioration"
            ? `Largest cost increase among flagged campaigns: ${shortName(first.entity)}.`
            : `Start with ${shortName(first.entity)}.`;
      answer.summary +=
        interpretation.intent === "improvement"
          ? " Ranked by relative outcome growth among campaign-improvement findings."
          : interpretation.intent === "deterioration"
            ? " Ranked by positive relative cost increase among deterioration findings; missing cost comparisons are excluded. This is not a causal contribution score."
            : " Selected by Insights priority, then spend involved—not a causal contribution score.";
      const rows = selected.flatMap((finding) => {
        const entity = byId(finding.entity.id);
        return entity ? [entity] : [];
      });
      answer.table = table(
        creative ? "Creative findings to review" : "Campaign findings to review",
        rows,
        selected.map((finding) => DETECTOR_LABELS[finding.detector]).join(" · "),
      );
      followEntity();
      break;
    }
    case "strongest_campaign":
    case "weakest_campaign":
    case "strongest_creative": {
      const creative = interpretation.intent === "strongest_creative",
        weakest = interpretation.intent === "weakest_campaign";
      const pool = creative ? facts.creatives : facts.campaigns;
      const qualified = pool
        .filter(
          (item) =>
            item.current.totals.conversions >= INSIGHT_RULES.minConversions &&
            item.current.totals.spend > 0 &&
            item.current.derived.cpa !== null,
        )
        .sort(
          (a, b) =>
            (weakest ? -1 : 1) * (a.current.derived.cpa! - b.current.derived.cpa!) ||
            b.current.totals.conversions - a.current.totals.conversions ||
            a.entity.id.localeCompare(b.entity.id),
        );
      const first = qualified[0];
      if (!first)
        return cannot(
          "insufficient",
          "There are too few recorded outcomes to rank efficiency reliably.",
          `This ranking requires at least ${INSIGHT_RULES.minConversions} ${vocabulary.plural.toLowerCase()} per entity and some spend. Try a broader date range.`,
        );
      focus(first);
      evidence(basic(first));
      answer.title = `${shortName(first.entity)} has the ${weakest ? "highest" : "lowest"} qualifying ${vocabulary.costLabel.toLowerCase()}.`;
      answer.summary = `${format(first.current.derived.cpa, "cost")} from ${format(first.current.totals.spend, "money")} and ${first.current.totals.conversions} ${vocabulary.plural.toLowerCase()}. “${weakest ? "Weakest" : "Strongest"}” here means observed cost efficiency, not a quality judgement or a promise of future performance.`;
      answer.table = table(
        `${creative ? "Creatives" : "Campaigns"} ranked by cost efficiency`,
        qualified,
        `Requires at least ${INSIGHT_RULES.minConversions} outcomes. Ratios use totals; low-outcome and zero-outcome entities are not ranked.`,
      );
      answer.methodology += ` Qualification uses the Insights minimum of ${INSIGHT_RULES.minConversions} outcomes.`;
      const finding = findings.find((item) => item.entity.id === first.entity.id);
      if (finding) answer.sources.push(`detector:${finding.id}`);
      followEntity();
      break;
    }
    case "concentration": {
      focus(facts.account);
      const rows = facts.campaigns
        .filter((item) => item.current.totals.spend > 0)
        .sort((a, b) => b.current.totals.spend - a.current.totals.spend);
      const total = facts.account.current.totals.spend;
      if (!total)
        return cannot(
          "insufficient",
          "No spend is recorded in this period.",
          "A spend share cannot be calculated without spend.",
        );
      const count = Math.min(INSIGHT_RULES.concentration.topCount, rows.length),
        topSpend = rows
          .slice(0, count)
          .reduce((sum, item) => sum + item.current.totals.spend, 0);
      answer.title = `${formatPercent(topSpend / total, 0)} of spend sits in ${count} ${count === 1 ? "campaign" : "campaigns"}.`;
      answer.summary = `${format(topSpend, "money")} of ${format(total, "money")} total spend in the selected period. Concentration describes exposure; it is not inherently good or bad.`;
      answer.metrics = [
        { label: "Total spend", value: total, format: "money" },
        { label: "Leading campaign spend", value: topSpend, format: "money" },
        { label: `Top ${count} share`, value: topSpend / total, format: "share" },
      ];
      answer.table = {
        title: "Spend distribution",
        columns: [
          { label: "Spend", format: "money" },
          { label: "Share", format: "share" },
        ],
        rows: rows.slice(0, 6).map((item) => ({
          entity: item.entity,
          values: [item.current.totals.spend, item.current.totals.spend / total],
        })),
        note: `Ranked by spend across ${rows.length} delivering campaigns. Showing up to six; shares use all account spend.`,
      };
      const finding = findings.find((item) => item.detector === "spend_concentration");
      if (finding) {
        answer.sources.push(`detector:${finding.id}`);
        answer.methodology += ` ${finding.reason}`;
      }
      answer.followUps = [CAMPAIGN_QUESTION, "Where am I wasting spend?"];
      break;
    }
    case "comparison": {
      focus(subject);
      evidence(basic(subject));
      if (facts.context.tracksRevenue)
        answer.comparison.push(row(subject, "roas", "ROAS", "multiple", true));
      answer.title = `${subject.entity.type === "account" ? scope.clientName : shortName(subject.entity)}: current versus previous period.`;
      answer.summary = `Spend is ${format(subject.current.totals.spend, "money")} versus ${format(subject.previous.totals.spend, "money")}; ${vocabulary.plural.toLowerCase()} are ${subject.current.totals.conversions} versus ${subject.previous.totals.conversions}. Every comparison uses the two date ranges shown on this page.`;
      answer.followUps =
        subject.entity.type === "campaign"
          ? [CREATIVE_QUESTION, SPEND_QUESTION, FATIGUE_QUESTION]
          : [CAMPAIGN_QUESTION, "What improved the most?", "Why did CPA change?"];
      break;
    }
  }
  return finish();
}
