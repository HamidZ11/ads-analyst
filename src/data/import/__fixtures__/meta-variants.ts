import {
  DAYS_14,
  ECOM_ADS,
  ECOM_HEADERS,
  LEAD_ADS,
  ecommerceRows,
  metricsFor,
  type Cell,
  type Row,
} from "./meta-exports";

/**
 * Variations on the synthetic Ads Manager export that real files show: other
 * delimiters and decimal marks, a byte order mark, symbols and grouped
 * thousands in amounts, totals and blank rows, local date orders, report-wide
 * reporting ranges, exports at other levels or without a daily breakdown, and
 * Results instead of a named conversion column. No real account data.
 */

export function toDelimited(
  headers: readonly string[],
  rows: readonly Row[],
  delimiter: "," | ";" | "\t" = ",",
  { bom = false, eol = "\n" } = {},
): string {
  const quote = (value: Cell) => {
    const text = String(value);
    return text.includes(delimiter) || /["\r\n]/.test(text)
      ? `"${text.replace(/"/g, '""')}"`
      : text;
  };
  const body = [
    headers.map(quote).join(delimiter),
    ...rows.map((r) => headers.map((h) => quote(r[h] ?? "")).join(delimiter)),
  ].join(eol);
  return `${bom ? "﻿" : ""}${body}${eol}`;
}

const MONEY_HEADERS = [
  "Amount spent (GBP)",
  "CPC (cost per link click) (GBP)",
  "CPM (cost per 1,000 impressions) (GBP)",
  "Cost per result (GBP)",
  "Purchases conversion value (GBP)",
];

/** Rewrites every amount and ratio with a transform (decimal comma, symbols, grouping). */
export function mapAmounts(rows: readonly Row[], fn: (value: string) => string): Row[] {
  return rows.map((row) => {
    const next = { ...row };
    for (const header of [...MONEY_HEADERS, "CTR (link click-through rate)", "Frequency"])
      if (next[header] !== undefined && next[header] !== "")
        next[header] = fn(String(next[header]));
    return next;
  });
}

/** 1,234.56 → 1.234,56 (European spreadsheet). */
export const commaDecimal = (value: string) => {
  const [whole, fraction] = value.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return fraction === undefined ? grouped : `${grouped},${fraction}`;
};

/** 1234.56 → 1,234.56 (grouped thousands, as a spreadsheet may write them). */
export const groupedPoint = (value: string) => {
  const [whole, fraction] = value.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
};

/** Every date column rewritten, e.g. to 17/09/2026. */
export function mapDates(rows: readonly Row[], fn: (iso: string) => string): Row[] {
  return rows.map((row) => {
    const next = { ...row };
    for (const header of ["Reporting starts", "Reporting ends", "Day"])
      if (next[header]) next[header] = fn(String(next[header]));
    return next;
  });
}

export const dayFirst = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export const monthFirst = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
};

/** The report-wide reporting range on every row, with a Day column for the day. */
export const reportRangeRows = () =>
  ecommerceRows().map((row) => ({
    ...row,
    "Reporting starts": DAYS_14[0],
    "Reporting ends": DAYS_14.at(-1)!,
  }));

/** A totals row as a report footer: the range and the sums, no campaign, ad set or ad. */
export function withTotalsRow(rows: readonly Row[], label = ""): Row[] {
  const spend = rows.reduce((s, r) => s + Number(r["Amount spent (GBP)"]), 0);
  const impressions = rows.reduce((s, r) => s + Number(r.Impressions), 0);
  return [
    ...rows,
    {
      "Reporting starts": DAYS_14[0],
      "Reporting ends": DAYS_14.at(-1)!,
      "Campaign name": label,
      "Amount spent (GBP)": spend.toFixed(2),
      Impressions: impressions,
    },
  ];
}

/** Without the Day column and with only the report-wide range: no daily breakdown. */
export const NOT_DAILY_HEADERS = ECOM_HEADERS.filter((h) => h !== "Day");
export const notDailyRows = (): Row[] =>
  ECOM_ADS.map((spec) => {
    const totals = DAYS_14.reduce(
      (t, _, i) => {
        const m = metricsFor(spec, i);
        return { spend: t.spend + m.spend, impressions: t.impressions + m.impressions };
      },
      { spend: 0, impressions: 0 },
    );
    return {
      ...ecommerceRows([spec], [DAYS_14[0]])[0],
      "Reporting starts": DAYS_14[0],
      "Reporting ends": DAYS_14.at(-1)!,
      "Amount spent (GBP)": totals.spend.toFixed(2),
      Impressions: totals.impressions,
    };
  });

/** Campaign-level and ad-set-level exports: the lower levels' columns are absent. */
export const CAMPAIGN_LEVEL_HEADERS = ECOM_HEADERS.filter(
  (h) => !/^Ad (set )?(name|ID|delivery)$/.test(h),
);
export const AD_SET_LEVEL_HEADERS = ECOM_HEADERS.filter(
  (h) => !/^Ad (name|ID|delivery)$/.test(h),
);

/** Results with Result indicator only: no Purchases column. */
export const RESULTS_ONLY_HEADERS = ECOM_HEADERS.filter(
  (h) => h !== "Purchases" && h !== "Purchases conversion value (GBP)",
);

/** "Result type" instead of "Result indicator", with the label Ads Manager shows. */
export const RESULT_TYPE_HEADERS = RESULTS_ONLY_HEADERS.map((h) =>
  h === "Result indicator" ? "Result type" : h,
);
export const resultTypeRows = (label = "Website purchases"): Row[] =>
  ecommerceRows().map((row) => ({ ...row, "Result type": label }));

/** Mixed: the Lookalike campaign's Results count leads. */
export const mixedResultRows = (): Row[] =>
  ecommerceRows().map((row) =>
    row["Campaign ID"] === "120210000000000003"
      ? { ...row, Results: 2, "Result indicator": "actions:lead" }
      : row,
  );

/** ROAS columns sit beside the value column and are never read as revenue. */
export const ROAS_HEADERS = [...ECOM_HEADERS, "Purchase ROAS (return on ad spend)"];
export const roasRows = (): Row[] =>
  ecommerceRows().map((row) => ({
    ...row,
    "Purchase ROAS (return on ad spend)": Number(row["Amount spent (GBP)"])
      ? (
          Number(row["Purchases conversion value (GBP)"] || 0) /
          Number(row["Amount spent (GBP)"])
        ).toFixed(2)
      : "",
  }));

/** The same export in another account currency. */
export const inCurrency = (code: string) => ({
  headers: ECOM_HEADERS.map((h) => h.replace("(GBP)", `(${code})`)),
  rows: ecommerceRows().map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k.replace("(GBP)", `(${code})`), v]),
    ),
  ),
});

export { DAYS_14, ECOM_ADS, ECOM_HEADERS, LEAD_ADS, ecommerceRows };
