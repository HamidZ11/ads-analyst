// Browser check of the instant audit (D-083).
//
// Usage: pnpm check:audit [origin]   (default http://localhost:3000)
// Needs a running server and Playwright's browsers. Not part of `pnpm check`.
//
// In WebKit, Chromium and Firefox at 1440, 390 and 360px, in a fresh context:
// a file carrying a marker string is dropped into /audit and every request the
// page makes from then on is recorded. None may carry the marker or any of the
// file's text, and none may be anything but a GET. The report must appear with
// findings, the page must not scroll sideways, a campaign-level export must be
// refused with the Ads tab fix, and the print view must show the report alone.

import { readFileSync } from "node:fs";
import { chromium, firefox, webkit } from "playwright";

const origin = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const MARKER = "Marker Account 7f3c9e";
const sample = readFileSync(new URL("../public/audit-sample.csv", import.meta.url), "utf8");
const marked = sample.replaceAll("Luxe Skin Co. (sample data)", MARKER);
const header = sample.slice(0, sample.indexOf("\n")).split(",");
const campaignLevel = sample
  .split("\n")
  .map((line) =>
    line
      .split(",")
      .filter((_, i) => !/^Ad (set )?(name|ID|delivery)$/.test(header[i]))
      .join(","),
  )
  .join("\n");

const engines = { chromium, webkit, firefox };
const widths = [1440, 390, 360];
let failures = 0;
let ran = 0;
const fail = (where, message) => {
  failures++;
  console.log(`FAIL ${where}: ${message}`);
};

for (const [name, engine] of Object.entries(engines)) {
  let browser;
  try {
    browser = await engine.launch();
  } catch {
    console.log(`skip ${name}: browser not installed`);
    continue;
  }
  ran++;
  for (const width of widths) {
    const where = `${name} ${width}px`;
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${origin}/audit`, { waitUntil: "networkidle" });

    const requests = [];
    page.on("request", (request) =>
      requests.push({
        method: request.method(),
        url: request.url(),
        body: request.postData() ?? "",
      }),
    );
    await page.setInputFiles("#audit-file", {
      name: "export.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(marked),
    });
    await page.getByRole("heading", { name: MARKER }).waitFor({ timeout: 10_000 });
    await page.waitForTimeout(500);

    const leaked = requests.filter(
      (r) =>
        r.method !== "GET" ||
        r.body.length > 0 ||
        r.url.includes("7f3c9e") ||
        r.url.includes("Marker"),
    );
    if (leaked.length) fail(where, `requests after upload: ${JSON.stringify(leaked)}`);
    else
      console.log(
        `ok   ${where}: ${requests.length} request(s) after upload, none carry the file`,
      );

    const findings = await page.locator("article article").count();
    if (findings < 1) fail(where, "no findings rendered");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (overflow > 0) fail(where, `page scrolls sideways by ${overflow}px`);
    else console.log(`ok   ${where}: ${findings} findings, no sideways scroll`);

    await page.emulateMedia({ media: "print" });
    const print = await page.evaluate(() => ({
      nav: getComputedStyle(document.querySelector("header")).display,
      footer: getComputedStyle(document.querySelector("footer")).display,
      intake: getComputedStyle(document.querySelector("#audit-file").closest("div[class]"))
        .display,
      report: getComputedStyle(document.querySelector('[aria-labelledby="audit-title"]'))
        .display,
    }));
    await page.emulateMedia({ media: "screen" });
    if (print.nav !== "none" || print.footer !== "none" || print.report === "none")
      fail(where, `print view ${JSON.stringify(print)}`);
    else console.log(`ok   ${where}: print view shows the report alone`);

    await page.getByRole("button", { name: "Audit another file" }).click();
    await page.setInputFiles("#audit-file", {
      name: "campaigns.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(campaignLevel),
    });
    // Next's route announcer is also an alert; the refusal is the focusable one.
    const alert = page.locator('[role="alert"][tabindex="-1"]');
    await alert.waitFor({ timeout: 10_000 });
    const text = await alert.innerText();
    if (!/campaign level/.test(text) || !/Ads tab/.test(text))
      fail(where, `campaign-level message: ${text}`);
    else console.log(`ok   ${where}: campaign-level export refused with the Ads tab fix`);

    await page.getByRole("button", { name: "Try the sample export" }).click();
    await page
      .getByRole("heading", { name: "Luxe Skin Co. (sample data)" })
      .waitFor({ timeout: 10_000 });
    console.log(`ok   ${where}: sample export audited`);
    await context.close();
  }
  await browser.close();
}

if (ran === 0) {
  console.log("\nNo Playwright browser is installed, so nothing was checked.");
  process.exit(1);
}
if (failures) {
  console.log(`\n${failures} audit check(s) failed.`);
  process.exit(1);
}
console.log("\nThe audit works in every engine and never sends the file.");
