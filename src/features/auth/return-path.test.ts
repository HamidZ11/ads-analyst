import { describe, expect, it } from "vitest";
import { BILLING_RETURN_PATH, safeReturnPath, signInHref } from "./return-path";

describe("the post-sign-in return path", () => {
  it("accepts app pages on this site, with their query and fragment", () => {
    expect(safeReturnPath(BILLING_RETURN_PATH)).toBe("/settings#billing");
    expect(safeReturnPath("/settings")).toBe("/settings");
    expect(safeReturnPath("/clients/import?client=new")).toBe("/clients/import?client=new");
    expect(safeReturnPath("/insights")).toBe("/insights");
  });

  it("refuses every open-redirect shape", () => {
    for (const raw of [
      "https://evil.example/settings",
      "http:/evil.example",
      "//evil.example/settings",
      "///evil.example",
      "/\\evil.example",
      "\\\\evil.example",
      "/\\/evil.example",
      "javascript:alert(1)",
      "data:text/html,hi",
      " /settings",
      "/settings\n//evil.example",
      "/\t/evil.example",
      "%2F%2Fevil.example",
      "/%2F%2Fevil.example",
      "settings",
      "",
    ])
      expect(safeReturnPath(raw), JSON.stringify(raw)).toBeNull();
  });

  it("refuses non-app paths, dot segments that leave the app, and odd inputs", () => {
    for (const raw of [
      "/",
      "/pricing",
      "/sign-in",
      "/auth/callback?code=x",
      "/api/billing/checkout",
      "/settings/../api/billing/portal",
      "/settings/%2e%2e/api/import",
      `/settings?${"x".repeat(300)}`,
    ])
      expect(safeReturnPath(raw), raw).toBeNull();
    for (const raw of [null, undefined, 42, ["/settings"], { href: "/settings" }])
      expect(safeReturnPath(raw)).toBeNull();
  });

  it("builds the sign-in link only for a safe path", () => {
    expect(signInHref(BILLING_RETURN_PATH)).toBe("/sign-in?next=%2Fsettings%23billing");
    expect(signInHref("//evil.example")).toBe("/sign-in");
  });
});
