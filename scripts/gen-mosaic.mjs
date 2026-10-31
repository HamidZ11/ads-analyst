// Turns a photograph into the sign-in panel's round-dot colour mosaic
// (D-NEW-sign-in-1).
//
// Usage:
//   node scripts/gen-mosaic.mjs <photo.jpg> <out.webp> [--palette brand|cool]
//     [--pitch 12] [--width 1440] [--seed 7] [--quality 62]
//     [--brightness 1] [--saturation 1.35] [--contrast 1.12] [--hard 0|1] [--lossless 0|1]
//
// Defaults: 1440 × 1800 (the panel at 2×), 120 × 150 dots, hard-edged dots
// in the palette's own colours, lossless WebP: under 200 KB.
//
// The photo is cover-cropped to the panel's 4:5 shape and averaged into a grid
// of cells, one dot per cell. Each cell takes the nearest colour from a small
// palette built from the design tokens, chosen in OKLab with damped
// Floyd–Steinberg error diffusion so gradients turn into mixed dots rather
// than bands. Dots are anti-aliased circles with seeded jitter in position and
// size, on the palette's darkest colour, and the result is encoded as WebP.
// Only the output is committed; the source photo stays outside the repo.

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

/* Palettes from the tokens: brand blue (accent, accent-strong), near-black
   navy (ink), warm cream (the marketing ivory) and one warm tan accent. */
const PALETTES = {
  brand: ["#0f172a", "#1d4ed8", "#2563eb", "#f7f6f2", "#c4955f"],
  // The same, plus the deepest accent for richer blue shadows.
  cool: ["#0f172a", "#1e40af", "#2563eb", "#f7f6f2", "#c4955f"],
};

function parseArgs(argv) {
  const [input, output, ...rest] = argv;
  const options = {
    palette: "brand",
    pitch: 12,
    width: 1440,
    seed: 7,
    quality: 62,
    brightness: 1,
    saturation: 1.35,
    contrast: 1.12,
    hard: 1,
    lossless: 1,
  };
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i].replace(/^--/, "");
    options[key] = key === "palette" ? rest[i + 1] : Number(rest[i + 1]);
  }
  if (!input || !output || !PALETTES[options.palette]) {
    console.error(
      "Usage: node scripts/gen-mosaic.mjs <photo> <out.webp> [--palette brand|cool]",
    );
    process.exit(1);
  }
  return { input, output, ...options };
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** sRGB 0–255 to OKLab. */
function oklab([r, g, b]) {
  const lin = (c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [lr, lg, lb] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export async function mosaic({
  input,
  palette: paletteName,
  pitch,
  width,
  seed,
  quality,
  brightness,
  saturation,
  contrast,
  hard,
  lossless,
}) {
  const height = Math.round((width * 5) / 4);
  const cols = Math.round(width / pitch);
  const rows = Math.round(height / pitch);
  const palette = PALETTES[paletteName].map((hex) => {
    const rgb = hexToRgb(hex);
    return { rgb, lab: oklab(rgb) };
  });

  // One averaged colour per cell, with a little extra contrast and saturation
  // so sky, stone and shadow separate cleanly into the palette.
  const { data } = await sharp(input)
    .resize(cols, rows, { fit: "cover", position: "attention", kernel: "lanczos3" })
    .modulate({ brightness, saturation })
    .linear(contrast, -128 * (contrast - 1))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const source = Array.from({ length: cols * rows }, (_, i) =>
    oklab([data[i * 3], data[i * 3 + 1], data[i * 3 + 2]]),
  );

  // Calm areas: where the photo has little local detail (open sky), the cell
  // takes its 5×5 neighbourhood's average, no dither error and little jitter,
  // so flat regions become even dots and the subject carries the texture.
  const calm = new Float64Array(cols * rows);
  const lab = source.map((c, i) => {
    const x = i % cols;
    const y = Math.floor(i / cols);
    let n = 0;
    const mean = [0, 0, 0];
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const s = source[ny * cols + nx];
        for (let k = 0; k < 3; k++) mean[k] += s[k];
        n++;
      }
    for (let k = 0; k < 3; k++) mean[k] /= n;
    let spread = 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const s =
          source[
            Math.min(rows - 1, Math.max(0, y + dy)) * cols +
              Math.min(cols - 1, Math.max(0, x + dx))
          ];
        spread = Math.max(spread, Math.hypot(s[0] - c[0], s[1] - c[1], s[2] - c[2]));
      }
    // OKLab distance: under ~0.02 is flat, over ~0.06 is an edge or texture.
    calm[i] = 1 - Math.min(1, Math.max(0, (spread - 0.02) / 0.04));
    return calm[i] > 0.5 ? mean : [...c];
  });

  // Damped Floyd–Steinberg in OKLab; no error is carried through calm cells.
  const choice = new Uint8Array(cols * rows);
  const DAMP = 0.5;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const c = lab[i];
      let best = 0;
      let bestDistance = Infinity;
      palette.forEach((p, k) => {
        const d = (c[0] - p.lab[0]) ** 2 + (c[1] - p.lab[1]) ** 2 + (c[2] - p.lab[2]) ** 2;
        if (d < bestDistance) {
          bestDistance = d;
          best = k;
        }
      });
      choice[i] = best;
      const error = c.map((v, k) => (v - palette[best].lab[k]) * DAMP * (1 - calm[i]));
      const spread = (dx, dy, w) => {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= cols || ny >= rows) return;
        const n = lab[ny * cols + nx];
        for (let k = 0; k < 3; k++) n[k] += error[k] * w;
      };
      spread(1, 0, 7 / 16);
      spread(-1, 1, 3 / 16);
      spread(0, 1, 5 / 16);
      spread(1, 1, 1 / 16);
    }
  }

  // Draw the dots: anti-aliased circles with seeded jitter, on the darkest colour.
  const random = mulberry32(seed);
  const pixels = Buffer.alloc(width * height * 3);
  // The ground is a deeper navy than the navy dots, so dots read in shadow too.
  const ground = palette[0].rgb.map((c) => Math.round(c * 0.55));
  for (let p = 0; p < width * height; p++) pixels.set(ground, p * 3);
  const cellW = width / cols;
  const cellH = height / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const colour = palette[choice[y * cols + x]].rgb;
      const jitter = 0.24 * (1 - 0.75 * calm[y * cols + x]);
      const cx = (x + 0.5 + (random() - 0.5) * jitter) * cellW;
      const cy = (y + 0.5 + (random() - 0.5) * jitter) * cellH;
      const r = Math.min(cellW, cellH) * (0.44 + (random() - 0.5) * 0.08);
      for (let py = Math.floor(cy - r - 1); py <= Math.ceil(cy + r + 1); py++) {
        if (py < 0 || py >= height) continue;
        for (let px = Math.floor(cx - r - 1); px <= Math.ceil(cx + r + 1); px++) {
          if (px < 0 || px >= width) continue;
          const d = Math.hypot(px + 0.5 - cx, py + 0.5 - cy);
          // Hard-edged dots keep the image to the palette's own colours, which
          // lossless WebP stores far more compactly than anti-aliased edges.
          const coverage = hard ? (d <= r ? 1 : 0) : Math.max(0, Math.min(1, r + 0.5 - d));
          if (coverage <= 0) continue;
          const o = (py * width + px) * 3;
          for (let k = 0; k < 3; k++)
            pixels[o + k] = Math.round(pixels[o + k] + (colour[k] - pixels[o + k]) * coverage);
        }
      }
    }
  }

  return sharp(pixels, { raw: { width, height, channels: 3 } })
    .webp(
      lossless
        ? { lossless: true, effort: 6 }
        : { quality, effort: 6, smartSubsample: true, preset: "drawing" },
    )
    .toBuffer();
}

if (resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parseArgs(process.argv.slice(2));
  const webp = await mosaic(options);
  writeFileSync(options.output, webp);
  console.log(`Wrote ${options.output} (${(webp.length / 1024).toFixed(1)} KB)`);
}
