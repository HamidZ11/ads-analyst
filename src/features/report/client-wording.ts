import type { ConversionVocabulary } from "@/domain/labels";
import { splitCampaignName } from "@/domain/labels";
import type { DetectorId, Finding, InsightPriority } from "@/domain/insights";

/**
 * The deterministic findings rewritten for the agency's client: plain words
 * instead of platform abbreviations and detector names, with exactly the same
 * figures. Only the wording changes; every number comes from the finding's
 * own headline, which the insight engine computed.
 */

export type ClientFindingGroup = "attention" | "working" | "watching";

export const CLIENT_GROUP_LABELS: Record<ClientFindingGroup, string> = {
  attention: "Needs attention",
  working: "Working well",
  watching: "Keeping an eye on",
};

const GROUP_BY_PRIORITY: Record<InsightPriority, ClientFindingGroup> = {
  high: "attention",
  opportunity: "working",
  watch: "watching",
};

export interface ClientFinding {
  id: string;
  group: ClientFindingGroup;
  /** A short plain title: "Spend without purchases". */
  title: string;
  /** Where it happened: "Campaign: Autumn Reset Sale", "Across the account". */
  where: string;
  /** What happened, with the finding's own figures. */
  sentence: string;
  /** The suggested next step in client language; a draft for the agency, never sent as is. */
  nextStep: string;
}

/** Platform shorthand → plain English, applied to whole words only. */
const PLAIN_TERMS: Array<[RegExp, string]> = [
  [/\bCTR\b/g, "click-through rate"],
  [/\bCPM\b/g, "the cost per 1,000 impressions"],
  [/\bCPC\b/g, "cost per click"],
  [/\bROAS\b/g, "return on ad spend"],
];
const CPA = /\bCPA\b/g;

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/**
 * Replaces platform abbreviations with plain words; sentence-initial terms are
 * capitalised. CPA takes the client's own label ("cost per purchase"), as the
 * report's tiles and titles do; "cost per result" only without one.
 */
export function plainLanguage(text: string, vocab?: ConversionVocabulary): string {
  let out = text;
  for (const [pattern, words] of PLAIN_TERMS) out = out.replace(pattern, words);
  out = out.replace(CPA, vocab ? vocab.costLabel.toLowerCase() : "cost per result");
  return capitalise(out);
}

function title(detector: DetectorId, vocab: ConversionVocabulary): string {
  const plural = vocab.plural.toLowerCase();
  switch (detector) {
    case "zero_conversion_spend":
      return `Spend without ${plural}`;
    case "campaign_deterioration":
      return `${vocab.plural} fell as spend rose`;
    case "cpa_spike":
      return `${vocab.costLabel} went up`;
    case "roas_decline":
      return "Return on ad spend fell";
    case "ctr_deterioration":
      return "Fewer people clicked";
    case "creative_fatigue":
      return "An ad is drawing fewer clicks";
    case "spend_concentration":
      return "Spend is concentrated";
    case "underfunded_winner":
      return "A strong ad with room to grow";
    case "campaign_improvement":
      return `More ${plural} at a lower cost`;
    case "scaling_winner":
      return "Growing while staying efficient";
  }
}

function where(finding: Finding): string {
  const { entity } = finding;
  switch (entity.type) {
    case "account":
      return "Across the account";
    case "campaign":
      return `Campaign: ${splitCampaignName(entity.name).primary}`;
    case "ad_set":
      return `Ad set: ${entity.name}`;
    case "ad":
      return `Ad: ${entity.name}`;
    case "creative":
      return `Ad creative: ${entity.name}`;
  }
}

function sentence(finding: Finding, vocab: ConversionVocabulary): string {
  const { headline, detector } = finding;
  if (detector === "creative_fatigue") {
    // "This creative shows a fatigue pattern: CTR fell 31.4% while CPM held steady."
    const observed = headline.replace(/^This creative shows a fatigue pattern:\s*/, "");
    return `${plainLanguage(observed, vocab).replace(/\.$/, "")}, which can mean the audience has seen it often.`;
  }
  if (detector === "underfunded_winner") return `This ad has the ${lowerFirst(headline)}`;
  return plainLanguage(headline, vocab);
}

export function toClientFinding(finding: Finding, vocab: ConversionVocabulary): ClientFinding {
  return {
    id: finding.id,
    group: GROUP_BY_PRIORITY[finding.priority],
    title: title(finding.detector, vocab),
    where: where(finding),
    sentence: sentence(finding, vocab),
    nextStep: plainLanguage(finding.action, vocab),
  };
}

/** A starting point for "What we're doing next", one line per finding. The agency edits it. */
export function suggestedNextSteps(findings: readonly ClientFinding[]): string {
  return findings.map((f) => `- ${f.where}: ${f.nextStep}`).join("\n");
}
