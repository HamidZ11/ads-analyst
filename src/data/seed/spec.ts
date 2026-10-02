import type {
  AdAccount,
  CampaignObjective,
  Client,
  Creative,
  EntityStatus,
} from "@/domain/types";

/**
 * A value that changes over the seeded window. Either a constant, or linear
 * keyframes of `[dayIndex, value]` where day 0 is the first seeded day and the
 * last index is the anchor (most recent) day. Values between keyframes are
 * interpolated; values outside the first/last keyframe are clamped.
 */
export type Curve = number | ReadonlyArray<readonly [day: number, value: number]>;

export interface AdSeedSpec {
  id: string;
  name: string;
  creativeId: string;
  status: EntityStatus;
  /** Inclusive day-index window in which the ad delivered. Defaults to the full window. */
  activeDays?: readonly [start: number, end: number];
  /** Daily spend in the account currency. */
  spend: Curve;
  /** Cost per 1,000 impressions. */
  cpm: Curve;
  /** Click-through rate as a fraction. */
  ctr: Curve;
  /** Conversions per click as a fraction. */
  cvr: Curve;
  /** Revenue per conversion. Zero for lead-generation. */
  aov: Curve;
}

export interface AdSetSeedSpec {
  id: string;
  name: string;
  audience: string;
  status: EntityStatus;
  ads: readonly AdSeedSpec[];
}

export interface CampaignSeedSpec {
  id: string;
  name: string;
  objective: CampaignObjective;
  status: EntityStatus;
  adSets: readonly AdSetSeedSpec[];
}

export interface ClientSeedSpec {
  client: Client;
  adAccount: AdAccount;
  creatives: readonly Creative[];
  campaigns: readonly CampaignSeedSpec[];
  /**
   * Conversion-rate multipliers by day of week (Sun … Sat). Ecommerce buyers
   * skew to evenings and weekends; B2B skews to weekdays.
   */
  weeklyConversionPattern: readonly [number, number, number, number, number, number, number];
}

export function curveAt(curve: Curve, day: number): number {
  if (typeof curve === "number") return curve;
  if (curve.length === 0) return 0;
  if (day <= curve[0][0]) return curve[0][1];
  const last = curve[curve.length - 1];
  if (day >= last[0]) return last[1];
  for (let i = 1; i < curve.length; i++) {
    const [d1, v1] = curve[i];
    if (day <= d1) {
      const [d0, v0] = curve[i - 1];
      const t = d1 === d0 ? 1 : (day - d0) / (d1 - d0);
      return v0 + (v1 - v0) * t;
    }
  }
  return last[1];
}
