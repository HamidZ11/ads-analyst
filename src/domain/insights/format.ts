import {
  formatChange,
  formatCurrency,
  formatMultiple,
  formatNumber,
  formatPercent,
} from "../format";
import type { CurrencyCode } from "../types";
import type { ValueFormat } from "./model";

/** Writes an insight value in its format; null and non-finite values read "—". */
export function formatInsightValue(
  value: number | null,
  format: ValueFormat,
  currency: CurrencyCode,
): string {
  switch (format) {
    case "money":
      return formatCurrency(value, currency, { decimals: 0 });
    case "cost":
      return formatCurrency(value, currency, { decimals: 2 });
    case "count":
      return formatNumber(value);
    case "percent":
      return formatPercent(value, 2);
    case "share":
      return formatPercent(value, 0);
    case "multiple":
      return formatMultiple(value, 2);
    case "change":
      return formatChange(value);
  }
}

/** An unsigned relative change for prose: 0.314 → "31.4%". */
export function formatMagnitude(change: number): string {
  return formatPercent(Math.abs(change), 1);
}

/** A rule threshold for prose: 0.25 → "25%". */
export function formatThreshold(fraction: number): string {
  return formatPercent(fraction, 0);
}
