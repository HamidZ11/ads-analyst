import { safeRatio } from "@/domain/metrics";

/* The free calculators' arithmetic (D-095). Pure, deterministic and
   shared by the pages and their tests. Ratios use the product's own
   `safeRatio`, so a calculator and the app agree on what is undefined: a ratio
   with a zero denominator is unavailable (null), never zero or Infinity. */

/** What a typed value turned out to be. Empty is not an error: nothing is shown yet. */
export type ParsedInput =
  | { kind: "empty" }
  | { kind: "invalid" }
  | { kind: "negative" }
  | { kind: "ok"; value: number };

const PLAIN_NUMBER = /^-?(\d+(\.\d*)?|\.\d+)$/;

/**
 * Reads a number as people type it: spaces, thousands separators and a leading
 * £, $ or € are ignored ("£1,250.50" is 1250.5). Anything else (letters,
 * exponents, two decimal points) is invalid rather than guessed at, so NaN and
 * Infinity never reach a formula.
 */
export function parseAmount(raw: string): ParsedInput {
  const text = raw.replace(/[\s,]/g, "").replace(/^(-?)[£$€]/, "$1");
  if (text === "") return { kind: "empty" };
  if (!PLAIN_NUMBER.test(text)) return { kind: "invalid" };
  const value = Number(text);
  if (!Number.isFinite(value)) return { kind: "invalid" };
  if (value < 0) return { kind: "negative" };
  // -0 reads as 0.
  return { kind: "ok", value: Math.abs(value) };
}

/** Return on ad spend as a multiple: attributed revenue ÷ ad spend. Null without spend. */
export function roas(revenue: number, spend: number): number | null {
  if (revenue < 0 || spend < 0) return null;
  return safeRatio(revenue, spend);
}

/** Cost per conversion (CPA): ad spend ÷ conversions. Null without conversions. */
export function cpa(spend: number, conversions: number): number | null {
  if (spend < 0 || conversions < 0) return null;
  return safeRatio(spend, conversions);
}

/**
 * Break-even ROAS: 1 ÷ margin, where margin is the share of revenue left after
 * the cost of the goods and other per-order costs, before ad spend, given as a
 * percentage (40 means 40%). Null outside (0, 100]: at 0% no ROAS covers the
 * ads, and a margin cannot exceed the revenue it is a share of.
 */
export function breakEvenRoas(marginPercent: number): number | null {
  if (!Number.isFinite(marginPercent) || marginPercent <= 0 || marginPercent > 100) return null;
  return safeRatio(100, marginPercent);
}

/**
 * Break-even cost per conversion: the margin earned on one order of the given
 * value, which is the most a conversion can cost before it loses money.
 * Null when the margin is outside (0, 100] or the order value is negative.
 */
export function breakEvenCpa(orderValue: number, marginPercent: number): number | null {
  if (!Number.isFinite(orderValue) || orderValue < 0) return null;
  if (!Number.isFinite(marginPercent) || marginPercent <= 0 || marginPercent > 100) return null;
  return (orderValue * marginPercent) / 100;
}
