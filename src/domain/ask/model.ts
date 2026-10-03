import type {
  ComparisonRow,
  EvidenceItem,
  Finding,
  InsightChart,
  InsightEntity,
  InsightFacts,
  EntityFacts,
  ValueFormat,
} from "../insights";
import type { CurrencyCode, DateRange } from "../types";

export type AskIntent =
  | "cpa"
  | "roas"
  | "deterioration"
  | "improvement"
  | "waste"
  | "investigate_campaign"
  | "strongest_campaign"
  | "weakest_campaign"
  | "strongest_creative"
  | "investigate_creative"
  | "concentration"
  | "campaign_creatives"
  | "ctr"
  | "fatigue"
  | "comparison"
  | "spend"
  | "unsupported";
export interface AskScope {
  key: string;
  clientId: string;
  clientName: string;
  currency: CurrencyCode;
  current: DateRange;
  previous: DateRange;
  comparison: string;
}
export interface AskContext {
  scopeKey: string;
  campaignId?: string;
  creativeId?: string;
  previousIntent?: AskIntent;
  previousEntity?: { type: "campaign" | "creative" | "account"; id: string };
}
export interface AskInterpretation {
  intent: AskIntent;
  /** An explicit window is never silently interpreted as the selected one. */
  requestedDays?: number;
  reason?: string;
}
export interface AskTable {
  title: string;
  columns: Array<{ label: string; format: ValueFormat }>;
  rows: Array<{ entity: InsightEntity; values: Array<number | null>; note?: string }>;
  note: string;
}
export interface AskAnswer {
  intent: AskIntent;
  state: "available" | "insufficient" | "unsupported" | "clarification";
  scope: AskScope;
  title: string;
  summary: string;
  metrics: EvidenceItem[];
  comparison: ComparisonRow[];
  entities: InsightEntity[];
  table: AskTable | null;
  chart: InsightChart | null;
  evidenceLimit: string;
  nextInspection: string;
  followUps: string[];
  methodology: string;
  sources: string[];
}
export interface AskData {
  scope: AskScope;
  facts: InsightFacts;
  findings: Finding[];
  campaignCreatives: Record<string, EntityFacts[]>;
}
export interface AskResult {
  answer: AskAnswer;
  context: AskContext;
}

export const ASK_MAX_QUESTION_LENGTH = 1000;
export const ASK_SUGGESTIONS = [
  "What changed from the previous period?",
  "Which campaign should I investigate first?",
  "Where am I wasting spend?",
  "Which creative is performing best?",
];

export function scopeKey(clientId: string, current: DateRange, previous: DateRange): string {
  return [clientId, current.start, current.end, previous.start, previous.end].join(":");
}
