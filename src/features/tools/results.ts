import { formatCurrency, formatMultiple } from "@/domain/format";
import type { CurrencyCode } from "@/domain/types";
import type { ToolId } from "./catalog";
import {
  breakEvenCpa,
  breakEvenRoas,
  cpa,
  parseAmount,
  roas,
  type ParsedInput,
} from "./formulas";

/* What each calculator shows for what has been typed: the inputs it asks
   for, a message per invalid field, and the result with the formula worked
   through on the person's own numbers. Pure, so the page and the tests read
   the same thing. */

export const CURRENCIES: readonly { code: CurrencyCode; symbol: string; name: string }[] = [
  { code: "GBP", symbol: "£", name: "pounds" },
  { code: "USD", symbol: "$", name: "US dollars" },
  { code: "EUR", symbol: "€", name: "euros" },
];

export type FieldKind = "money" | "count" | "percent";

export interface Field {
  name: string;
  label: string;
  kind: FieldKind;
  hint?: string;
  placeholder: string;
  optional?: boolean;
}

export const FIELDS: Record<ToolId, readonly Field[]> = {
  roas: [
    {
      name: "revenue",
      label: "Revenue from ads",
      kind: "money",
      hint: "The conversion value your ad platform attributes to the ads.",
      placeholder: "e.g. 12,000",
    },
    { name: "spend", label: "Ad spend", kind: "money", placeholder: "e.g. 3,000" },
  ],
  cpa: [
    { name: "spend", label: "Ad spend", kind: "money", placeholder: "e.g. 3,000" },
    {
      name: "conversions",
      label: "Conversions",
      kind: "count",
      hint: "Purchases, leads, sign-ups: whatever you count as a result.",
      placeholder: "e.g. 120",
    },
  ],
  "break-even-roas": [
    {
      name: "margin",
      label: "Profit margin",
      kind: "percent",
      hint: "The share of revenue left after the cost of goods and per-order costs, before ad spend.",
      placeholder: "e.g. 40",
    },
    {
      name: "orderValue",
      label: "Average order value",
      kind: "money",
      hint: "Optional. Adds the most a conversion can cost before it loses money.",
      placeholder: "e.g. 60",
      optional: true,
    },
  ],
};

export type Values = Record<string, string>;

/** A field's problem in one sentence, or null when it is empty or usable. */
export function fieldError(field: Field, raw: string): string | null {
  const parsed = parseAmount(raw);
  if (parsed.kind === "invalid") return "Enter a number, such as 1250 or 1,250.50.";
  if (parsed.kind === "negative") return `${field.label} can’t be negative.`;
  if (field.kind === "percent" && parsed.kind === "ok" && parsed.value > 100)
    return "A margin can’t be more than 100%.";
  return null;
}

export interface Reading {
  label: string;
  value: string;
  detail: string;
  /** The formula with the person's numbers in it. */
  worked: string;
}

export type Result =
  /** Something required is still empty. */
  | { kind: "waiting"; message: string }
  /** A field has a problem; its own message says what. */
  | { kind: "blocked"; message: string }
  /** The inputs are valid but the ratio does not exist (a zero denominator). */
  | { kind: "undefined"; label: string; message: string }
  | { kind: "value"; reading: Reading; extra?: Reading };

const money = (value: number, currency: CurrencyCode) =>
  formatCurrency(value, currency, { decimals: Number.isInteger(value) ? 0 : 2 });

const plain = (value: number) =>
  new Intl.NumberFormat("en-GB", { maximumFractionDigits: 4 }).format(value);

const BLOCKED: Result = {
  kind: "blocked",
  message: "Correct the highlighted field to see a result.",
};

export function calculate(tool: ToolId, values: Values, currency: CurrencyCode): Result {
  const fields = FIELDS[tool];
  if (fields.some((field) => fieldError(field, values[field.name] ?? "") !== null))
    return BLOCKED;
  const read = (name: string): ParsedInput => parseAmount(values[name] ?? "");
  const number = (name: string) => {
    const parsed = read(name);
    return parsed.kind === "ok" ? parsed.value : null;
  };

  if (tool === "roas") {
    const revenue = number("revenue");
    const spend = number("spend");
    if (revenue === null || spend === null)
      return { kind: "waiting", message: "Enter revenue and ad spend to see your ROAS." };
    const result = roas(revenue, spend);
    if (result === null)
      return {
        kind: "undefined",
        label: "ROAS",
        message:
          "ROAS needs ad spend above zero: with nothing spent, there is no return to measure.",
      };
    return {
      kind: "value",
      reading: {
        label: "ROAS",
        value: formatMultiple(result),
        detail: `${formatCurrency(result, currency, { decimals: 2 })} of revenue for every ${money(1, currency)} of ad spend, or ${plain(Math.round(result * 1000) / 10)}% as a percentage.`,
        worked: `${money(revenue, currency)} ÷ ${money(spend, currency)} = ${formatMultiple(result)}`,
      },
    };
  }

  if (tool === "cpa") {
    const spend = number("spend");
    const conversions = number("conversions");
    if (spend === null || conversions === null)
      return { kind: "waiting", message: "Enter ad spend and conversions to see your CPA." };
    const result = cpa(spend, conversions);
    if (result === null)
      return {
        kind: "undefined",
        label: "CPA",
        message:
          spend === 0
            ? "With no spend and no conversions, there is no cost per conversion to work out."
            : `No conversions, so there is no cost per conversion: all ${money(spend, currency)} of spend went without a recorded result.`,
      };
    return {
      kind: "value",
      reading: {
        label: "CPA",
        value: formatCurrency(result, currency, { decimals: 2 }),
        detail: `Each conversion cost ${formatCurrency(result, currency, { decimals: 2 })} in ad spend.`,
        worked: `${money(spend, currency)} ÷ ${plain(conversions)} = ${formatCurrency(result, currency, { decimals: 2 })}`,
      },
    };
  }

  const margin = number("margin");
  if (margin === null)
    return {
      kind: "waiting",
      message: "Enter your profit margin to see your break-even ROAS.",
    };
  const result = breakEvenRoas(margin);
  if (result === null)
    return {
      kind: "undefined",
      label: "Break-even ROAS",
      message:
        "At a 0% margin no ROAS pays for the ads: each sale leaves nothing to cover them.",
    };
  const value = formatMultiple(result);
  const reading: Reading = {
    label: "Break-even ROAS",
    value,
    detail: `Below ${value}, the margin on the sales your ads bring in doesn’t cover what the ads cost; above it, it does.`,
    worked: `1 ÷ ${plain(margin)}% = 1 ÷ ${plain(margin / 100)} = ${value}`,
  };
  const orderValue = number("orderValue");
  const cpaLimit = orderValue === null ? null : breakEvenCpa(orderValue, margin);
  if (orderValue === null || cpaLimit === null) return { kind: "value", reading };
  return {
    kind: "value",
    reading,
    extra: {
      label: "Break-even CPA",
      value: formatCurrency(cpaLimit, currency, { decimals: 2 }),
      detail: `At a ${money(orderValue, currency)} order value, a conversion can cost up to ${formatCurrency(cpaLimit, currency, { decimals: 2 })} before it loses money.`,
      worked: `${money(orderValue, currency)} × ${plain(margin)}% = ${formatCurrency(cpaLimit, currency, { decimals: 2 })}`,
    },
  };
}
