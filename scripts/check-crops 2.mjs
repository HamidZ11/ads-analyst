// Cross-engine check of the marketing site's product crops (D-075).
//
// Usage: pnpm check:browsers [url]   (default http://localhost:3000/)
// Needs a running server and Playwright's browsers (`pnpm exec playwright
// install webkit chromium firefox`). Not part of `pnpm check`, which has no
// server or browsers.
//
// For WebKit, Chromium and Firefox at 1440, 1280 and 390px (and WebKit as an
// emulated iPhone 13), with JavaScript on and off, in a fresh context each time, every visible ProductCrop must be
// fully opaque, scaled by a positive factor and drawn over its own frame. With
// JavaScript the scale must match the frame (frame width ÷ crop width); without
// it the hero crops must already be within 6% under that, and every other crop
// must show unscaled rather than blank.

import { chromium, devices, firefox, webkit } from "playwright";

const url = process.argv[2] ?? "http://localhost:3000/";
const engines = { webkit, chromium, firefox };
const viewports = [
  { name: "1440px", options: { viewport: { width: 1440, height: 900 } } },
  { name: "1280px", options: { viewport: { width: 1280, height: 900 } } },
  { name: "390px", options: { viewport: { width: 390, height: 844 } } },
];
/** WebKit only: an emulated iPhone (mobile viewport, touch, iOS Safari user agent). */
const iphone = { name: "iPhone 13", options: devices["iPhone 13"] };

function inspect() {
  const frames = [...document.querySelectorAll('[role="img"][style*="aspect-ratio"]')].filter(
    (frame) => frame.offsetParent !== null && frame.clientWidth > 0,
  );
  return frames.map((frame) => {
    const surface = frame.firstElementChild;
    const [cropWidth] = frame.style.aspectRatio.split("/").map((part) => Number(part.trim()));
    const matrix = new DOMMatrixReadOnly(getComputedStyle(surface).transform);
    const f = frame.getBoundingClientRect();
    const s = surface.getBoundingClientRect();
    const overlapWidth = Math.max(0, Math.min(f.right, s.right) - Math.max(f.left, s.left));
    const overlapHeight = Math.max(0, Math.min(f.bottom, s.bottom) - Math.max(f.top, s.top));
    return {
      label: frame.getAttribute("aria-label").slice(0, 40),
      hero: Boolean(frame.closest('[aria-label="Ad Analyst Overview"]')),
      scale: matrix.a,
      expected: frame.clientWidth / cropWidth,
      opacity: Number(getComputedStyle(surface).opacity),
      covered: (overlapWidth * overlapHeight) / (f.width * f.height),
    };
  });
}

let failures = 0;
for (const [name, engine] of Object.entries(engines)) {
  const browser = await engine.launch();
  for (const viewport of name === "webkit" ? [...viewports, iphone] : viewports) {
    for (const javaScriptEnabled of [true, false]) {
      const context = await browser.newContext({ ...viewport.options, javaScriptEnabled });
      const page = await context.newPage();
      await page.goto(url, { waitUntil: "load" });
      await page.waitForTimeout(javaScriptEnabled ? 1500 : 300);
      const crops = await page.evaluate(inspect);
      const where = `${name} ${viewport.name} js=${javaScriptEnabled ? "on" : "off"}`;
      if (crops.length === 0) {
        failures++;
        console.log(`FAIL ${where}: no visible crops`);
      }
      for (const crop of crops) {
        const problems = [];
        if (crop.opacity < 1) problems.push(`opacity ${crop.opacity}`);
        if (!(crop.scale > 0)) problems.push(`scale ${crop.scale}`);
        // Unscaled, a crop narrower than its frame leaves white beside it; that
        // is the accepted fallback, so only the scaled crops must fill it.
        const minimum = javaScriptEnabled || crop.hero ? 0.9 : 0.5;
        if (crop.covered < minimum)
          problems.push(`covers ${Math.round(crop.covered * 100)}% of frame`);
        if (javaScriptEnabled && Math.abs(crop.scale - crop.expected) > 0.01)
          problems.push(`scale ${crop.scale.toFixed(4)}, expected ${crop.expected.toFixed(4)}`);
        if (!javaScriptEnabled && crop.hero) {
          if (crop.scale > crop.expected + 0.005 || crop.scale < crop.expected * 0.94)
            problems.push(
              `first-paint scale ${crop.scale.toFixed(4)}, expected just under ${crop.expected.toFixed(4)}`,
            );
        }
        if (!javaScriptEnabled && !crop.hero && crop.scale !== 1)
          problems.push(`unhydrated scale ${crop.scale}, expected 1`);
        if (problems.length) {
          failures++;
          console.log(`FAIL ${where} ${crop.label}: ${problems.join("; ")}`);
        } else {
          console.log(`ok   ${where} ${crop.label}: scale ${crop.scale.toFixed(4)}`);
        }
      }
      await context.close();
    }
  }
  await browser.close();
}

if (failures) {
  console.log(`\n${failures} crop check(s) failed.`);
  process.exit(1);
}
console.log("\nAll crops visible and scaled in every engine.");
