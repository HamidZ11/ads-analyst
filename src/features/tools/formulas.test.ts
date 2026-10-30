import { describe, expect, it } from "vitest";
import { breakEvenCpa, breakEvenRoas, cpa, parseAmount, roas } from "./formulas";
import { calculate, FIELDS, fieldError } from "./results";

describe("parseAmount", () => {
  it("reads plain numbers, thousands separators, spaces and a leading currency symbol", () => {
    expect(parseAmount("1250")).toEqual({ kind: "ok", value: 1250 });
    expect(parseAmount("1,250.50")).toEqual({ kind: "ok", value: 1250.5 });
    expect(parseAmount(" 3 000 ")).toEqual({ kind: "ok", value: 3000 });
    expect(parseAmount("£3,000")).toEqual({ kind: "ok", value: 3000 });
    expect(parseAmount("$12.5")).toEqual({ kind: "ok", value: 12.5 });
    expect(parseAmount("€0.75")).toEqual({ kind: "ok", value: 0.75 });
    expect(parseAmount(".5")).toEqual({ kind: "ok", value: 0.5 });
    expect(parseAmount("12.")).toEqual({ kind: "ok", value: 12 });
    expect(parseAmount("0")).toEqual({ kind: "ok", value: 0 });
  });

  it("treats an empty field as empty, not as zero or an error", () => {
    expect(parseAmount("")).toEqual({ kind: "empty" });
    expect(parseAmount("   ")).toEqual({ kind: "empty" });
    // A currency symbol on its own: the number has not been typed yet.
    expect(parseAmount("£")).toEqual({ kind: "empty" });
  });

  it("flags negative numbers separately, and reads -0 as 0", () => {
    expect(parseAmount("-5")).toEqual({ kind: "negative" });
    expect(parseAmount("-£5")).toEqual({ kind: "negative" });
    expect(parseAmount("-0")).toEqual({ kind: "ok", value: 0 });
  });

  it("never lets NaN or Infinity through", () => {
    for (const raw of [
      "abc",
      "12abc",
      "1.2.3",
      "1e5",
      "Infinity",
      "NaN",
      "--5",
      "5-",
      ".",
      "9".repeat(400),
    ])
      expect(parseAmount(raw).kind, raw).toBe("invalid");
  });
});

describe("roas", () => {
  it("divides revenue by spend", () => {
    expect(roas(12_000, 3_000)).toBe(4);
    expect(roas(1_000, 3_000)).toBeCloseTo(0.3333, 4);
    expect(roas(0, 500)).toBe(0);
  });

  it("is unavailable without spend or with negative inputs", () => {
    expect(roas(500, 0)).toBeNull();
    expect(roas(0, 0)).toBeNull();
    expect(roas(-1, 100)).toBeNull();
    expect(roas(100, -1)).toBeNull();
    expect(roas(Number.NaN, 100)).toBeNull();
    expect(roas(100, Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("cpa", () => {
  it("divides spend by conversions", () => {
    expect(cpa(3_000, 120)).toBe(25);
    expect(cpa(100, 3)).toBeCloseTo(33.3333, 4);
    expect(cpa(0, 10)).toBe(0);
    // Platforms can report modelled, fractional conversions.
    expect(cpa(100, 2.5)).toBe(40);
  });

  it("is unavailable without conversions or with negative inputs", () => {
    expect(cpa(3_000, 0)).toBeNull();
    expect(cpa(0, 0)).toBeNull();
    expect(cpa(-1, 10)).toBeNull();
    expect(cpa(10, -1)).toBeNull();
    expect(cpa(Number.NaN, 10)).toBeNull();
  });
});

describe("breakEvenRoas", () => {
  it("is 1 divided by the margin as a fraction", () => {
    expect(breakEvenRoas(40)).toBe(2.5);
    expect(breakEvenRoas(25)).toBe(4);
    expect(breakEvenRoas(50)).toBe(2);
    expect(breakEvenRoas(100)).toBe(1);
    expect(breakEvenRoas(33.3)).toBeCloseTo(3.003, 3);
    expect(breakEvenRoas(0.5)).toBe(200);
  });

  it("is unavailable at or below 0% and above 100%", () => {
    expect(breakEvenRoas(0)).toBeNull();
    expect(breakEvenRoas(-10)).toBeNull();
    expect(breakEvenRoas(100.01)).toBeNull();
    expect(breakEvenRoas(Number.NaN)).toBeNull();
    expect(breakEvenRoas(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("breakEvenCpa", () => {
  it("is the margin earned on one order", () => {
    expect(breakEvenCpa(60, 40)).toBe(24);
    expect(breakEvenCpa(0, 40)).toBe(0);
    expect(breakEvenCpa(80, 100)).toBe(80);
  });

  it("is unavailable for a margin outside (0, 100] or a negative order value", () => {
    expect(breakEvenCpa(60, 0)).toBeNull();
    expect(breakEvenCpa(60, 120)).toBeNull();
    expect(breakEvenCpa(-60, 40)).toBeNull();
    expect(breakEvenCpa(Number.NaN, 40)).toBeNull();
  });
});

describe("calculator results", () => {
  it("shows ROAS with the formula worked through on the person's numbers", () => {
    const result = calculate("roas", { revenue: "12,000", spend: "3000" }, "GBP");
    expect(result).toMatchObject({
      kind: "value",
      reading: {
        label: "ROAS",
        value: "4.00x",
        worked: "£12,000 ÷ £3,000 = 4.00x",
      },
    });
    if (result.kind === "value")
      expect(result.reading.detail).toBe(
        "£4.00 of revenue for every £1 of ad spend, or 400% as a percentage.",
      );
  });

  it("formats money in the chosen currency", () => {
    const usd = calculate("cpa", { spend: "3000", conversions: "120" }, "USD");
    const eur = calculate("cpa", { spend: "3000", conversions: "120" }, "EUR");
    expect(usd).toMatchObject({
      reading: { value: "$25.00", worked: "$3,000 ÷ 120 = $25.00" },
    });
    expect(eur).toMatchObject({
      reading: { value: "€25.00", worked: "€3,000 ÷ 120 = €25.00" },
    });
  });

  it("waits until every required field has a value", () => {
    expect(calculate("roas", {}, "GBP").kind).toBe("waiting");
    expect(calculate("roas", { revenue: "100" }, "GBP").kind).toBe("waiting");
    expect(calculate("cpa", { conversions: "4" }, "GBP").kind).toBe("waiting");
    expect(calculate("break-even-roas", { orderValue: "60" }, "GBP").kind).toBe("waiting");
  });

  it("blocks on any invalid field, including an invalid optional one", () => {
    expect(calculate("roas", { revenue: "abc", spend: "100" }, "GBP").kind).toBe("blocked");
    expect(calculate("cpa", { spend: "-100", conversions: "4" }, "GBP").kind).toBe("blocked");
    expect(calculate("break-even-roas", { margin: "140" }, "GBP").kind).toBe("blocked");
    expect(calculate("break-even-roas", { margin: "40", orderValue: "x" }, "GBP").kind).toBe(
      "blocked",
    );
  });

  it("explains a missing ratio instead of showing zero, NaN or infinity", () => {
    const noSpend = calculate("roas", { revenue: "500", spend: "0" }, "GBP");
    expect(noSpend).toMatchObject({ kind: "undefined", label: "ROAS" });
    const noConversions = calculate("cpa", { spend: "1,200", conversions: "0" }, "GBP");
    expect(noConversions).toMatchObject({ kind: "undefined", label: "CPA" });
    if (noConversions.kind === "undefined")
      expect(noConversions.message).toContain("all £1,200 of spend went without");
    expect(calculate("cpa", { spend: "0", conversions: "0" }, "GBP")).toMatchObject({
      kind: "undefined",
    });
    expect(calculate("break-even-roas", { margin: "0" }, "GBP")).toMatchObject({
      kind: "undefined",
    });
    for (const result of [noSpend, noConversions])
      expect(JSON.stringify(result)).not.toMatch(/NaN|Infinity|∞/);
  });

  it("gives break-even ROAS, and break-even CPA only with an order value", () => {
    const alone = calculate("break-even-roas", { margin: "40" }, "GBP");
    expect(alone).toMatchObject({
      kind: "value",
      reading: { value: "2.50x", worked: "1 ÷ 40% = 1 ÷ 0.4 = 2.50x" },
    });
    expect(alone.kind === "value" && alone.extra).toBeFalsy();
    const withOrder = calculate("break-even-roas", { margin: "40", orderValue: "60" }, "EUR");
    expect(withOrder).toMatchObject({
      extra: { label: "Break-even CPA", value: "€24.00", worked: "€60 × 40% = €24.00" },
    });
  });

  it("names the field and the problem in each field message", () => {
    const [revenue] = FIELDS.roas;
    expect(fieldError(revenue, "")).toBeNull();
    expect(fieldError(revenue, "12")).toBeNull();
    expect(fieldError(revenue, "-12")).toBe("Revenue from ads can’t be negative.");
    expect(fieldError(revenue, "12abc")).toBe("Enter a number, such as 1250 or 1,250.50.");
    const [margin] = FIELDS["break-even-roas"];
    expect(fieldError(margin, "100")).toBeNull();
    expect(fieldError(margin, "101")).toBe("A margin can’t be more than 100%.");
  });
});
