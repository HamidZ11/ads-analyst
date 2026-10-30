// Cross-engine check that the site works under its Content Security Policy
// (D-096).
//
// Usage: pnpm check:csp [origin]   (default http://localhost:3000)
// Needs a running server and Playwright's browsers. In demo mode the app pages
// render; otherwise they redirect to sign-in and the demo-only steps (client
// navigation and Ask Analyst) are skipped. Run it against a production build
// (`pnpm build && pnpm start`): development adds 'unsafe-eval' and HMR.
//
// For WebKit, Chromium and Firefox, every marketing page, sign-in, every app
// page and an unknown URL must arrive with a nonce-based policy, hydrate (React
// has attached itself to the DOM) and raise no CSP violation. Then a client-side
// navigation, an Ask Analyst question (a same-origin POST) and the 404 page are
// exercised with violations still being counted.

import { chromium, firefox, webkit } from "playwright";

const origin = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const engines = { webkit, chromium, firefox };
const health = await fetch(`${origin}/api/health`).then((r) => r.json());
const demo = health.mode === "demo";
console.log(`mode: ${health.mode}${demo ? "" : " (demo-only steps skipped)"}`);
const PAGES = [
  "/",
  "/audit",
  "/tools",
  "/tools/roas-calculator",
  "/tools/cpa-calculator",
  "/tools/break-even-roas-calculator",
  "/pricing",
  "/privacy",
  "/terms",
  "/sign-in",
  "/overview",
  "/campaigns",
  "/creatives",
  "/insights",
  "/ask",
  "/report",
  "/clients",
  "/clients/import",
  "/settings",
  // A shared report link (D-NEW-share-1). No such link exists here, so it
  // renders the share page's own not-found frame, which is the public part.
  "/r/hZ0aT8m3Qx1v2Kc9LwP4yB7nR5sD6eF0gH1iJ2kL3mN",
  "/no-such-page",
];

/** Runs in every document before its own scripts; not itself subject to the page's CSP. */
function recordViolations() {
  window.__cspViolations = [];
  document.addEventListener("securitypolicyviolation", (event) => {
    window.__cspViolations.push(`${event.effectiveDirective} ${event.blockedURI || "inline"}`);
  });
}

const hydrated = () =>
  [document.body, ...document.body.querySelectorAll("*")]
    .slice(0, 200)
    .some((node) => Object.keys(node).some((key) => key.startsWith("__reactFiber")));

let failures = 0;
const fail = (message) => {
  failures += 1;
  console.log(`  ✗ ${message}`);
};

for (const [name, engine] of Object.entries(engines)) {
  const browser = await engine.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(recordViolations);
  const page = await context.newPage();
  const consoleCsp = [];
  page.on("console", (message) => {
    if (/content.security.policy|refused to (execute|load|apply)/i.test(message.text()))
      consoleCsp.push(message.text().slice(0, 160));
  });
  console.log(name);

  for (const path of PAGES) {
    const response = await page.goto(`${origin}${path}`, { waitUntil: "load" });
    const policy = response.headers()["content-security-policy"] ?? "";
    if (!/script-src 'nonce-[^']+' 'strict-dynamic'/.test(policy))
      fail(`${path}: no nonce-based policy (${policy.slice(0, 60) || "none"})`);
    await page.waitForFunction(hydrated, null, { timeout: 10_000 }).catch(() => {});
    if (!(await page.evaluate(hydrated))) fail(`${path}: did not hydrate`);
    const violations = await page.evaluate(() => window.__cspViolations);
    if (violations.length) fail(`${path}: ${violations.join(", ")}`);
    else console.log(`  ✓ ${path} (${response.status()})`);
  }

  if (demo) {
    // Client-side navigation: a soft navigation keeps the document.
    await page.goto(`${origin}/overview`, { waitUntil: "load" });
    await page.waitForFunction(hydrated);
    await page.evaluate(() => (window.__sameDocument = true));
    await page.getByRole("link", { name: "Campaigns", exact: true }).first().click();
    await page.waitForURL(`${origin}/campaigns`);
    if (!(await page.evaluate(() => window.__sameDocument === true)))
      fail("client navigation reloaded the page");
    else console.log("  ✓ client navigation /overview → /campaigns");

    // Ask Analyst: a same-origin POST from a hydrated client component.
    await page.goto(`${origin}/ask`, { waitUntil: "load" });
    await page.waitForFunction(hydrated);
    await page
      .getByLabel("Ask about campaigns, creatives or performance")
      .fill("Why did CPA change?");
    await page.getByRole("button", { name: "Send question" }).click();
    const answered = await page
      .getByRole("article", { name: "Analytical answer" })
      .first()
      .waitFor({ timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    const askViolations = await page.evaluate(() => window.__cspViolations);
    if (!answered) fail("Ask Analyst gave no answer");
    else if (askViolations.length) fail(`Ask Analyst: ${askViolations.join(", ")}`);
    else console.log("  ✓ Ask Analyst answered");
  }

  if (consoleCsp.length) fail(`console: ${[...new Set(consoleCsp)].join(" | ")}`);
  await browser.close();
}

console.log(failures ? `\n${failures} CSP check(s) failed` : "\nAll CSP checks passed");
process.exit(failures ? 1 : 0);
