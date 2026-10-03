/**
 * Synthetic Meta Ads Manager exports for tests. Header labels follow Ads
 * Manager's "Export table data" CSV for the Ads level with the Day breakdown.
 * Every account, name and number here is invented; no real client data.
 */

export type Cell = string | number;
export type Row = Record<string, Cell>;

export function toCsv(headers: readonly string[], rows: readonly Row[], eol = "\n"): string {
  const quote = (value: Cell) => {
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return (
    [
      headers.map(quote).join(","),
      ...rows.map((r) => headers.map((h) => quote(r[h] ?? "")).join(",")),
    ].join(eol) + eol
  );
}

export const DAYS_14 = Array.from({ length: 14 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 8, 17 + i));
  return d.toISOString().slice(0, 10);
}); // 2026-09-17 … 2026-09-30

export interface AdSpec {
  campaignId: string;
  campaign: string;
  objective: string;
  adSetId: string;
  adSet: string;
  adId: string;
  ad: string;
  /** Daily spend before the day factor. */
  spend: number;
  ctr: number;
  cvr: number;
  aov: number;
  /** Multiplier on conversion rate for the second week (trend). */
  secondWeek?: number;
}

/** Three campaigns, four ad sets, five ads; the Lookalike campaign never converts. */
export const ECOM_ADS: readonly AdSpec[] = [
  {
    campaignId: "120210000000000001",
    campaign: "Prospecting | Broad | Spring Serum",
    objective: "OUTCOME_SALES",
    adSetId: "120210000000000011",
    adSet: "Broad · UK · 25–54",
    adId: "120210000000000111",
    ad: "Serum – UGC, Before/After – Video 15s",
    spend: 60,
    ctr: 0.015,
    cvr: 0.04,
    aov: 48,
  },
  {
    campaignId: "120210000000000001",
    campaign: "Prospecting | Broad | Spring Serum",
    objective: "OUTCOME_SALES",
    adSetId: "120210000000000012",
    adSet: "Broad · UK · 18–34",
    adId: "120210000000000121",
    ad: 'Serum – "Glow" Static',
    spend: 30,
    ctr: 0.012,
    cvr: 0.035,
    aov: 46,
  },
  {
    campaignId: "120210000000000002",
    campaign: "Retargeting | Site Visitors 30D",
    objective: "OUTCOME_SALES",
    adSetId: "120210000000000021",
    adSet: "Visitors 30D excl. buyers",
    adId: "120210000000000211",
    ad: "Catalogue – Carousel",
    spend: 25,
    ctr: 0.025,
    cvr: 0.08,
    aov: 52,
  },
  {
    campaignId: "120210000000000002",
    campaign: "Retargeting | Site Visitors 30D",
    objective: "OUTCOME_SALES",
    adSetId: "120210000000000021",
    adSet: "Visitors 30D excl. buyers",
    adId: "120210000000000212",
    ad: "Free Delivery – Static",
    spend: 15,
    ctr: 0.02,
    cvr: 0.07,
    aov: 50,
  },
  {
    campaignId: "120210000000000003",
    campaign: "Prospecting | Lookalike 3% | Night Cream",
    objective: "OUTCOME_SALES",
    adSetId: "120210000000000031",
    adSet: "LAL 3% Purchasers",
    adId: "120210000000000311",
    ad: "Night Cream – Texture – Video 6s",
    spend: 40,
    ctr: 0.01,
    cvr: 0,
    aov: 55,
  },
];

export const ECOM_HEADERS = [
  "Reporting starts",
  "Reporting ends",
  "Day",
  "Account ID",
  "Account name",
  "Campaign name",
  "Campaign ID",
  "Campaign delivery",
  "Objective",
  "Ad set name",
  "Ad set ID",
  "Ad set delivery",
  "Ad name",
  "Ad ID",
  "Ad delivery",
  "Amount spent (GBP)",
  "Impressions",
  "Reach",
  "Frequency",
  "Link clicks",
  "CTR (link click-through rate)",
  "CPC (cost per link click) (GBP)",
  "CPM (cost per 1,000 impressions) (GBP)",
  "Results",
  "Result indicator",
  "Cost per result (GBP)",
  "Purchases",
  "Purchases conversion value (GBP)",
  "Attribution setting",
] as const;

export interface Metrics {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
}

/** Deterministic daily metrics for an ad: weekday wobble, rounded like Ads Manager. */
export function metricsFor(spec: AdSpec, dayIndex: number): Metrics {
  const factor = 1 + (((dayIndex * 7 + spec.adId.length) % 5) - 2) * 0.04;
  const spend = Math.round(spec.spend * factor * 100) / 100;
  const impressions = Math.round((spend / 9.5) * 1000);
  const clicks = Math.round(impressions * spec.ctr);
  const cvr = spec.cvr * (dayIndex >= 7 ? (spec.secondWeek ?? 1) : 1);
  const conversions = Math.round(clicks * cvr);
  return {
    spend,
    impressions,
    clicks,
    conversions,
    revenue: Math.round(conversions * spec.aov * 100) / 100,
  };
}

export function ecommerceRows(
  ads: readonly AdSpec[] = ECOM_ADS,
  days: readonly string[] = DAYS_14,
  account = { id: "1234567890", name: "Bloom Botanicals" },
): Row[] {
  return days.flatMap((day, i) =>
    ads.map((spec) => {
      const m = metricsFor(spec, i);
      return {
        "Reporting starts": day,
        "Reporting ends": day,
        Day: day,
        "Account ID": account.id,
        "Account name": account.name,
        "Campaign name": spec.campaign,
        "Campaign ID": spec.campaignId,
        "Campaign delivery": "active",
        Objective: spec.objective,
        "Ad set name": spec.adSet,
        "Ad set ID": spec.adSetId,
        "Ad set delivery": "active",
        "Ad name": spec.ad,
        "Ad ID": spec.adId,
        "Ad delivery": "active",
        "Amount spent (GBP)": m.spend.toFixed(2),
        Impressions: m.impressions,
        Reach: Math.round(m.impressions * 0.8),
        Frequency: "1.25",
        "Link clicks": m.clicks || "",
        "CTR (link click-through rate)": m.impressions
          ? ((m.clicks / m.impressions) * 100).toFixed(2)
          : "",
        "CPC (cost per link click) (GBP)": m.clicks ? (m.spend / m.clicks).toFixed(2) : "",
        "CPM (cost per 1,000 impressions) (GBP)": m.impressions
          ? ((m.spend / m.impressions) * 1000).toFixed(2)
          : "",
        Results: m.conversions || "",
        "Result indicator": "actions:offsite_conversion.fb_pixel_purchase",
        "Cost per result (GBP)": m.conversions ? (m.spend / m.conversions).toFixed(2) : "",
        Purchases: m.conversions || "",
        "Purchases conversion value (GBP)": m.revenue ? m.revenue.toFixed(2) : "",
        "Attribution setting": "7-day click or 1-day view",
      };
    }),
  );
}

export function totalsOf(
  ads: readonly AdSpec[] = ECOM_ADS,
  days: readonly string[] = DAYS_14,
): Metrics {
  const t = { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
  days.forEach((_, i) =>
    ads.forEach((spec) => {
      const m = metricsFor(spec, i);
      t.spend += m.spend;
      t.impressions += m.impressions;
      t.clicks += m.clicks;
      t.conversions += m.conversions;
      t.revenue += m.revenue;
    }),
  );
  return t;
}

/** 1. A normal ecommerce export. */
export const ecommerceCsv = (eol = "\n") => toCsv(ECOM_HEADERS, ecommerceRows(), eol);

/** 2. A lead-generation export: Leads, no value column, no Result indicator. */
export const LEAD_ADS: readonly AdSpec[] = [
  {
    campaignId: "120220000000000001",
    campaign: "Leads | Local 5mi | Free Consultation",
    objective: "OUTCOME_LEADS",
    adSetId: "120220000000000011",
    adSet: "Radius 5mi 25–55",
    adId: "120220000000000111",
    ad: "Consultation – Testimonial – Static",
    spend: 20,
    ctr: 0.014,
    cvr: 0.06,
    aov: 0,
  },
  {
    campaignId: "120220000000000002",
    campaign: "Leads | Retargeting | Visitors",
    objective: "OUTCOME_LEADS",
    adSetId: "120220000000000021",
    adSet: "Visitors 30D",
    adId: "120220000000000211",
    ad: "Book Now – Video 10s",
    spend: 10,
    ctr: 0.022,
    cvr: 0.1,
    aov: 0,
  },
];
export const LEAD_HEADERS = [
  "Day",
  "Campaign name",
  "Campaign ID",
  "Ad set name",
  "Ad set ID",
  "Ad name",
  "Ad ID",
  "Amount spent (GBP)",
  "Impressions",
  "Link clicks",
  "Leads",
  "Cost per lead (GBP)",
] as const;
export const leadCsv = () =>
  toCsv(
    LEAD_HEADERS,
    DAYS_14.flatMap((day, i) =>
      LEAD_ADS.map((spec) => {
        const m = metricsFor(spec, i);
        return {
          Day: day,
          "Campaign name": spec.campaign,
          "Campaign ID": spec.campaignId,
          "Ad set name": spec.adSet,
          "Ad set ID": spec.adSetId,
          "Ad name": spec.ad,
          "Ad ID": spec.adId,
          "Amount spent (GBP)": m.spend.toFixed(2),
          Impressions: m.impressions,
          "Link clicks": m.clicks,
          Leads: m.conversions || "",
          "Cost per lead (GBP)": m.conversions ? (m.spend / m.conversions).toFixed(2) : "",
        };
      }),
    ),
  );

/** 8. Alternative common labels: Date, Campaign, Spend, Clicks (all), Website purchases, a Currency column. */
export const ALT_HEADERS = [
  "Date",
  "Campaign",
  "Ad set",
  "Ad",
  "Currency",
  "Spend",
  "Impressions",
  "Clicks (all)",
  "Website purchases",
  "Website purchases conversion value",
] as const;
export const altCsv = (currency = "USD") =>
  toCsv(
    ALT_HEADERS,
    DAYS_14.slice(0, 7).flatMap((day, i) =>
      ECOM_ADS.slice(0, 3).map((spec) => {
        const m = metricsFor(spec, i);
        return {
          Date: day,
          Campaign: spec.campaign,
          "Ad set": spec.adSet,
          Ad: spec.ad,
          Currency: currency,
          Spend: m.spend.toFixed(2),
          Impressions: m.impressions,
          "Clicks (all)": m.clicks,
          "Website purchases": m.conversions,
          "Website purchases conversion value": m.revenue.toFixed(2),
        };
      }),
    ),
  );
