import type { DailyMetrics, DateRange, IsoDate } from "./types";

export type DatePreset = "today" | "yesterday" | "7d" | "14d" | "30d" | "custom";

export interface DatePresetDefinition {
  id: DatePreset;
  label: string;
  /** Number of days covered, when the preset is a trailing window. */
  days?: number;
  /** Whether the shell can apply this preset in the current phase. */
  available: boolean;
}

export const DATE_PRESETS: readonly DatePresetDefinition[] = [
  { id: "today", label: "Today", days: 1, available: true },
  { id: "yesterday", label: "Yesterday", days: 1, available: true },
  { id: "7d", label: "7D", days: 7, available: true },
  { id: "14d", label: "14D", days: 14, available: true },
  { id: "30d", label: "30D", days: 30, available: true },
  { id: "custom", label: "Custom", available: false },
];

export const DEFAULT_DATE_PRESET: DatePreset = "7d";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): value is IsoDate {
  return ISO_DATE_PATTERN.test(value) && !Number.isNaN(toUtcMillis(value));
}

export function parseDatePreset(value: string | undefined | null): DatePreset {
  const match = DATE_PRESETS.find((p) => p.id === value && p.available);
  return match ? match.id : DEFAULT_DATE_PRESET;
}

function toUtcMillis(date: IsoDate): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtcMillis(ms: number): IsoDate {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const DAY_MS = 86_400_000;

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromUtcMillis(toUtcMillis(date) + days * DAY_MS);
}

/** Signed number of days from `from` to `to`. */
export function diffDays(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtcMillis(to) - toUtcMillis(from)) / DAY_MS);
}

/** Inclusive number of days in the range. */
export function rangeLength(range: DateRange): number {
  return diffDays(range.start, range.end) + 1;
}

export function eachDay(range: DateRange): IsoDate[] {
  const length = rangeLength(range);
  if (length <= 0) return [];
  return Array.from({ length }, (_, i) => addDays(range.start, i));
}

export function isWithinRange(date: IsoDate, range: DateRange): boolean {
  return date >= range.start && date <= range.end;
}

/** 0 = Sunday … 6 = Saturday, matching `Date#getUTCDay`. */
export function dayOfWeek(date: IsoDate): number {
  return new Date(toUtcMillis(date)).getUTCDay();
}

/** Today's calendar date as observed in the given IANA timezone. */
export function todayInTimezone(timeZone: string, now: Date = new Date()): IsoDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Resolve a preset to a concrete range ending at (or before) `anchor`. */
export function rangeForPreset(preset: DatePreset, anchor: IsoDate): DateRange {
  switch (preset) {
    case "today":
      return { start: anchor, end: anchor };
    case "yesterday": {
      const y = addDays(anchor, -1);
      return { start: y, end: y };
    }
    case "7d":
    case "14d":
    case "30d": {
      const days = DATE_PRESETS.find((p) => p.id === preset)?.days ?? 7;
      return { start: addDays(anchor, -(days - 1)), end: anchor };
    }
    case "custom":
      // Custom ranges arrive with the full date engine; fall back to the default.
      return rangeForPreset(DEFAULT_DATE_PRESET, anchor);
  }
}

/** The equally long period immediately preceding `range`. */
export function previousRange(range: DateRange): DateRange {
  const length = rangeLength(range);
  return {
    start: addDays(range.start, -length),
    end: addDays(range.start, -1),
  };
}

export function sliceByRange<T extends Pick<DailyMetrics, "date">>(
  rows: readonly T[],
  range: DateRange,
): T[] {
  return rows.filter((row) => isWithinRange(row.date, range));
}

export interface PeriodPair {
  preset: DatePreset;
  current: DateRange;
  previous: DateRange;
}

export function periodPairForPreset(preset: DatePreset, anchor: IsoDate): PeriodPair {
  const current = rangeForPreset(preset, anchor);
  return { preset, current, previous: previousRange(current) };
}

/** Human label for the comparison baseline, e.g. "previous 7 days". */
export function comparisonLabel(pair: PeriodPair): string {
  const days = rangeLength(pair.current);
  if (pair.preset === "today") return "yesterday";
  if (pair.preset === "yesterday") return "the day before";
  return `previous ${days} days`;
}
