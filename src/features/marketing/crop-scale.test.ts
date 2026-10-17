import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/* The hero's first-paint scale steps (landing.module.css, D-075) must never
   exceed the true scale anywhere in their range, or the Overview would spill
   past its frame before hydration; and they should stay close to it. */

const css = readFileSync(join(process.cwd(), "src/app/(marketing)/landing.module.css"), "utf8");
const steps = [
  { from: 0, scale: Number(/\.canvas \{\s*--crop-scale: ([\d.]+);/.exec(css)?.[1]) },
  ...[
    ...css.matchAll(
      /@media \(min-width: (\d+)px\) \{\s*\.canvas \{\s*--crop-scale: ([\d.]+);/g,
    ),
  ].map(([, from, scale]) => ({ from: Number(from), scale: Number(scale) })),
];

/** The hero frame's true scale at a viewport width (no scrollbar, or a 17px one). */
function trueScale(viewport: number, scrollbar = 0) {
  // The container is the body width less two gutters of clamp(20px, 5.56vw, 80px), capped at 1280px.
  const gutter = Math.min(80, Math.max(20, 0.0556 * viewport));
  const container = Math.min(1280, viewport - scrollbar - 2 * gutter);
  if (viewport >= 1024) return Math.min(1072, 0.9 * container) / 1136;
  // Phones: the field runs edge to edge with 16px padding; the frame is capped at 350 × 1.15.
  return Math.min(viewport - 32, 350 * 1.15) / 350;
}

describe("hero crop scale steps", () => {
  it("cover every width from 320px up, in order", () => {
    expect(steps.length).toBeGreaterThan(15);
    expect(steps.map((step) => step.from)).toEqual(
      [...steps.map((step) => step.from)].sort((a, b) => a - b),
    );
  });

  it("never exceed the true scale, and stay within 6% under it", () => {
    for (let viewport = 320; viewport <= 1920; viewport++) {
      const step = steps.filter((s) => s.from <= viewport).at(-1)!;
      for (const scrollbar of viewport >= 1024 ? [0, 17] : [0]) {
        const exact = trueScale(viewport, scrollbar);
        expect(step.scale, `${viewport}px`).toBeLessThanOrEqual(exact + 1e-9);
        expect(step.scale, `${viewport}px`).toBeGreaterThan(exact * 0.94);
      }
    }
  });
});
