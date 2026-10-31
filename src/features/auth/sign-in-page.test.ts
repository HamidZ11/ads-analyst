import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SignInForm } from "./sign-in-form";
import { ProductMark } from "@/components/shell/product-mark";

/* The redesign (D-NEW-sign-in-1) changes the page, not the auth: one email
   field, the same action, the same errors and the ?next= return path. */

const form = (props: { linkError: boolean; next: string | null }) =>
  renderToStaticMarkup(createElement(SignInForm, props));

describe("sign-in form after the redesign", () => {
  it("is still one labelled email field and one submit, with no password", () => {
    const html = form({ linkError: false, next: null });
    expect(html.match(/<input/g)?.length).toBe(1);
    expect(html).toMatch(/<label for="email"[^>]*>Work email<\/label>/);
    const input = /<input id="email"[^>]*>/.exec(html)?.[0] ?? "";
    for (const attribute of [
      'type="email"',
      'name="email"',
      'autoComplete="email"',
      'required=""',
    ])
      expect(input, attribute).toContain(attribute);
    expect(html).not.toMatch(/password/i);
    expect(html).toMatch(/<button type="submit"[^>]*>Email me a sign-in link/);
  });

  it("carries a validated return path and shows the expired-link error", () => {
    const html = form({ linkError: true, next: "/campaigns" });
    expect(html).toContain('<input type="hidden" name="next" value="/campaigns"/>');
    expect(html).toContain(
      "That sign-in link has expired or was already used. Request a new one.",
    );
  });

  it("uses the chart mark, not the old A badge", () => {
    const html = renderToStaticMarkup(createElement(ProductMark));
    expect(html).toContain('d="M6 16.5 10.2 12l3 2.6L18 8.5"');
    expect(html).not.toContain("M2 11.5 6.2 2.5");
  });
});

describe("sign-in page", () => {
  const page = readFileSync(join(process.cwd(), "src/app/sign-in/page.tsx"), "utf8");

  it("keeps the session redirect and the safe return path", () => {
    expect(page).toContain("const next = safeReturnPath(params.next);");
    expect(page).toContain('if (session.kind === "app") redirect(next ?? APP_HOME);');
    expect(page).toContain('const linkError = params.error === "link";');
  });

  it("shows the mosaic as decoration from 1024px and links the legal pages", () => {
    expect(page).toMatch(/<div aria-hidden className="hidden p-4 lg:block">/);
    expect(page).toMatch(/className="relative h-full overflow-hidden rounded-lg bg-ink"/);
    expect(page).toMatch(/src="\/sign-in-mosaic\.webp"\s+alt=""/);
    expect(page).toContain('href="/privacy"');
    expect(page).toContain('href="/terms"');
  });
});

describe("dot mosaic", () => {
  it("is the committed WebP at the panel's 2× size, under 200 KB", async () => {
    const file = join(process.cwd(), "public/sign-in-mosaic.webp");
    const meta = await sharp(file).metadata();
    expect(meta.format).toBe("webp");
    expect([meta.width, meta.height]).toEqual([1440, 1800]);
    expect(readFileSync(file).length).toBeLessThan(200_000);
  });

  it("draws hard-edged dots in the palette's colours only", async () => {
    const generator = pathToFileURL(join(process.cwd(), "scripts/gen-mosaic.mjs")).href;
    const { mosaic } = (await import(/* @vite-ignore */ generator)) as {
      mosaic: (options: Record<string, unknown>) => Promise<Buffer>;
    };
    // A synthetic "photo": sky gradient over a warm block, so no real image is needed.
    const photo = await sharp({
      create: { width: 200, height: 250, channels: 3, background: "#5b8def" },
    })
      .composite([
        {
          input: await sharp({
            create: { width: 120, height: 150, channels: 3, background: "#d8b48a" },
          })
            .png()
            .toBuffer(),
          left: 60,
          top: 90,
        },
      ])
      .png()
      .toBuffer();
    const webp = await mosaic({
      input: photo,
      palette: "brand",
      pitch: 10,
      width: 200,
      seed: 7,
      quality: 62,
      brightness: 1,
      saturation: 1.35,
      contrast: 1.12,
      hard: 1,
      lossless: 1,
    });
    const { data, info } = await sharp(webp).raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([200, 250]);
    const colours = new Set<string>();
    for (let i = 0; i < data.length; i += info.channels)
      colours.add([data[i], data[i + 1], data[i + 2]].join(","));
    const allowed = new Set([
      "15,23,42", // ink
      "29,78,216", // accent-strong
      "37,99,235", // accent
      "247,246,242", // cream
      "196,149,95", // tan
      "8,13,23", // the ground: ink at 55%
    ]);
    for (const colour of colours) expect(allowed, colour).toContain(colour);
    expect(colours.has("37,99,235") || colours.has("29,78,216")).toBe(true);
  });
});
