import type {
  ComparisonRow,
  EvidenceItem,
  InsightEntity,
  ValueFormat,
} from "@/domain/insights";
import type { CreativeThumbnail, CreativeType, CurrencyCode } from "@/domain/types";

export type QuestionId = "cpa" | "campaign" | "creatives" | "limits";

export const QUESTIONS: Record<QuestionId, string> = {
  cpa: "Why did CPA rise this week?",
  campaign: "Which campaign should I investigate first?",
  creatives: "Show me the creatives in that campaign.",
  limits: "Does the data prove audience fatigue?",
};

export interface AnswerTable {
  title: string;
  identityLabel: string;
  columns: Array<{ label: string; format: ValueFormat }>;
  rows: Array<{
    id: string;
    name: string;
    context: string;
    values: Array<number | null>;
    artwork?: { thumbnail: CreativeThumbnail; type: CreativeType };
  }>;
  note: string;
}

export interface LabAnswer {
  id: QuestionId | "unsupported";
  title: string;
  summary: string;
  scope: string;
  evidence: EvidenceItem[];
  entities: InsightEntity[];
  comparison?: ComparisonRow[];
  table?: AnswerTable;
  limitation: string;
  next: string;
  methodology: string;
  followUps: QuestionId[];
}

export interface AskLabModel {
  clientName: string;
  currency: CurrencyCode;
  currentLabel: string;
  previousLabel: string;
  comparison: string;
  answers: Record<QuestionId, LabAnswer>;
}

const normalize = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[?.!]+$/, "");

/** An explicit fixture lookup, not an intent parser or a pretend AI service. */
export function answerForQuestion(question: string, model: AskLabModel): LabAnswer {
  const match = (Object.keys(QUESTIONS) as QuestionId[]).find(
    (id) => normalize(QUESTIONS[id]) === normalize(question),
  );
  if (match) return model.answers[match];
  return {
    id: "unsupported",
    title: "This question is outside the lab examples.",
    summary:
      "No analysis was run. This prototype only has four prepared responses; it does not interpret other questions.",
    scope: model.clientName,
    evidence: [],
    entities: [],
    limitation: "An unavailable lab response does not mean your data has no answer.",
    next: "Choose a suggested question to continue the example thread.",
    methodology: "Local fixture lookup only. No model, API or analytics query was called.",
    followUps: ["cpa", "campaign", "limits"],
  };
}
