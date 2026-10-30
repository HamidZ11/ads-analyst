import type { SharedReportPayload, ShareLink, SharePreset } from "@/data/supabase/share";
import { sharedReportRepository } from "@/data/supabase/share";
import { formatDate, formatDateRange } from "@/domain/format";
import {
  comparisonLabel,
  DATE_PRESETS,
  isIsoDate,
  previousRange,
  rangeLength,
  todayInTimezone,
  type PeriodPair,
} from "@/domain/periods";
import type { Client } from "@/domain/types";
import { buildContext } from "@/features/workspace/context";
import { buildClientReport, type ClientReportModel } from "./report-model";

/**
 * Read-only share links for the client report (D-NEW-share-1): one client,
 * one period, an unguessable token that only the link carries, an expiry and
 * revocation. The database side is 20261030160000_report_share_links.sql.
 */

/** Expiry choices offered when creating a link, in days; 30 unless changed. */
export const SHARE_EXPIRY_DAYS = [7, 30, 90] as const;
export const DEFAULT_SHARE_EXPIRY_DAYS = 30;

const SHARE_PRESETS: readonly SharePreset[] = ["today", "yesterday", "7d", "14d", "30d"];

export function isSharePreset(value: unknown): value is SharePreset {
  return SHARE_PRESETS.includes(value as SharePreset);
}

/** 32 random bytes (256 bits) as base64url: 43 characters, safe in a path. */
export function newShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** The form every token takes; anything else is not looked up. */
export const SHARE_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export const sharePath = (token: string) => `/r/${token}`;

/** A real calendar date in ISO form; isIsoDate alone lets "2026-02-30" roll over. */
export const isCalendarDate = (value: string) =>
  isIsoDate(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

/**
 * The period pair a link pins: its stored dates, and the equally long period
 * before them. Null when the dates are not the preset's length (the database
 * refuses those too).
 */
export function sharedPeriods(
  preset: SharePreset,
  start: string,
  end: string,
): PeriodPair | null {
  if (!isCalendarDate(start) || !isCalendarDate(end)) return null;
  const current = { start, end };
  const days = DATE_PRESETS.find((p) => p.id === preset)?.days;
  if (rangeLength(current) !== days) return null;
  return { preset, current, previous: previousRange(current) };
}

/** "2–8 Oct 2026" for a link's period, as the report names it. */
export const sharePeriodLabel = (start: string, end: string) => formatDateRange({ start, end });

/** "29 Nov 2026": the calendar day of a timestamp in the given timezone. */
export const shareDateLabel = (timestamp: string, timeZone = "Europe/London") =>
  formatDate(todayInTimezone(timeZone, new Date(timestamp)), { year: true });

export interface SharedReport {
  model: ClientReportModel;
  note: string | null;
  expiresAt: string;
}

/**
 * The shared report, built by the same `buildClientReport` as /report from the
 * rows the share function returned, for the link's pinned period. "Prepared"
 * is today in the client's timezone, as on /report, since the figures are
 * computed now (D-093).
 */
export function buildSharedReport(
  payload: SharedReportPayload,
  now: Date = new Date(),
): SharedReport | null {
  const periods = sharedPeriods(
    payload.preset,
    String(payload.period_start).slice(0, 10),
    String(payload.period_end).slice(0, 10),
  );
  if (!periods) return null;
  const context = buildContext({
    mode: "supabase",
    user: null,
    workspace: payload.workspace,
    repository: sharedReportRepository(payload),
    requestedClientId: payload.client.id,
    preset: payload.preset,
    canImport: false,
    now,
  });
  const { client, dataSource } = context;
  if (!client || !dataSource) return null;
  const model = buildClientReport({
    ...context,
    client,
    dataSource,
    periods,
    comparison: comparisonLabel(periods),
  });
  return {
    model,
    note: payload.note && payload.note.trim() !== "" ? payload.note : null,
    expiresAt: new Date(payload.expires_at).toISOString(),
  };
}

/** One active link, labelled on the server. Never the token: only its owner saw that once. */
export interface ShareLinkView {
  id: string;
  clientName: string;
  periodLabel: string;
  expiresLabel: string;
  createdLabel: string;
}

/** A link as the lists show it, labelled in its client's timezone. */
export function shareLinkView(
  link: ShareLink,
  clients: readonly Pick<Client, "id" | "name" | "timezone">[],
): ShareLinkView | null {
  const client = clients.find((c) => c.id === link.clientId);
  if (!client) return null;
  return {
    id: link.id,
    clientName: client.name,
    periodLabel: sharePeriodLabel(link.periodStart, link.periodEnd),
    expiresLabel: shareDateLabel(link.expiresAt, client.timezone),
    createdLabel: shareDateLabel(link.createdAt, client.timezone),
  };
}
