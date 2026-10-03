import { METRIC_DEFINITIONS } from "./metrics";
import type { CurrencyCode, DateRange, IsoDate, MetricKey } from "./types";

const LOCALE_BY_CURRENCY: Record<CurrencyCode, string> = {
  GBP: "en-GB",
  USD: "en-US",
  EUR: "en-IE",
};

const EM_DASH = "—";

export interface NumberFormatOptions {
  /** Abbreviate large values: 12,400 → 12.4k, 3,200,000 → 3.2M. */
  compact?: boolean;
  decimals?: number;
}

function compactParts(value: number): { scaled: number; suffix: string } {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return { scaled: value / 1_000_000, suffix: "M" };
  if (abs >= 10_000) return { scaled: value / 1_000, suffix: "k" };
  return { scaled: value, suffix: "" };
}

export function formatNumber(value: number | null, options: NumberFormatOptions = {}): string {
  if (value === null || !Number.isFinite(value)) return EM_DASH;
  const { compact = false, decimals } = options;
  if (compact) {
    const { scaled, suffix } = compactParts(value);
    const digits = suffix ? 1 : (decimals ?? 0);
    return `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: digits, minimumFractionDigits: suffix ? 1 : 0 }).format(scaled)}${suffix}`;
  }
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: decimals ?? 0,
    minimumFractionDigits: decimals ?? 0,
  }).format(value);
}

export function formatCurrency(
  value: number | null,
  currency: CurrencyCode,
  options: NumberFormatOptions = {},
): string {
  if (value === null || !Number.isFinite(value)) return EM_DASH;
  const locale = LOCALE_BY_CURRENCY[currency];
  const { compact = false, decimals = 0 } = options;
  if (compact) {
    const { scaled, suffix } = compactParts(value);
    const digits = suffix ? 1 : decimals;
    const formatted = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    }).format(scaled);
    return `${formatted}${suffix}`;
  }
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value);
}

/** Formats a fraction (0.0213) as a percentage ("2.13%"). */
export function formatPercent(value: number | null, decimals = 1): string {
  if (value === null || !Number.isFinite(value)) return EM_DASH;
  return `${new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value * 100)}%`;
}

/** Formats a multiple such as ROAS ("3.52x"). */
export function formatMultiple(value: number | null, decimals = 2): string {
  if (value === null || !Number.isFinite(value)) return EM_DASH;
  return `${new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value)}x`;
}

/** Signed relative change ("+12.4%", "−3.1%"); uses a true minus sign. */
export function formatChange(change: number | null, decimals = 1): string {
  if (change === null || !Number.isFinite(change)) return EM_DASH;
  const pct = Math.abs(change * 100);
  const body = new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(pct);
  if (change > 0) return `+${body}%`;
  if (change < 0) return `−${body}%`;
  return `${body}%`;
}

export function formatMetric(
  key: MetricKey,
  value: number | null,
  currency: CurrencyCode,
  options: NumberFormatOptions = {},
): string {
  const def = METRIC_DEFINITIONS[key];
  const decimals = options.decimals ?? def.decimals;
  switch (def.format) {
    case "currency":
      return formatCurrency(value, currency, { ...options, decimals });
    case "percent":
      return formatPercent(value, decimals);
    case "multiple":
      return formatMultiple(value, decimals);
    case "count":
      return formatNumber(value, { ...options, decimals });
  }
}

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatDate(date: IsoDate, options: { year?: boolean } = {}): string {
  const [y, m, d] = date.split("-").map(Number);
  const base = `${d} ${MONTHS_SHORT[m - 1]}`;
  return options.year ? `${base} ${y}` : base;
}

export function formatDateRange(range: DateRange): string {
  if (range.start === range.end) return formatDate(range.end, { year: true });
  const sameYear = range.start.slice(0, 4) === range.end.slice(0, 4);
  return `${formatDate(range.start, { year: !sameYear })} – ${formatDate(range.end, { year: true })}`;
}
