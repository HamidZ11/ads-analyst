import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ECOM_HEADERS,
  RESULTS_ONLY_HEADERS,
  ecommerceRows,
  mixedResultRows,
  toDelimited,
} from "@/data/import/__fixtures__/meta-variants";
import { auditExport } from "./audit";
import { buildSampleCsv } from "./sample";

/*
 * The audit's privacy promise (D-083): the visitor's file is read and analysed
 * in the browser and never leaves it. Two proofs:
 *
 * 1. At runtime, every way a page can send data is replaced by a spy, and
 *    running the whole audit (reports and refusals) calls none of them.
 * 2. Statically, every module the audit page can load in the browser is read:
 *    none sends data, stores it or runs on the server, and the only fetch is
 *    the GET for the published sample, which carries nothing of the visitor's.
 *    The route has no route handler or server action beside it.
 */

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

describe("no network request carries the file", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("runs the whole audit without calling any network or storage API", () => {
    const calls: string[] = [];
    const spy = (name: string) =>
      vi.fn((...args: unknown[]) => {
        calls.push(`${name}(${args.map(String).join(", ").slice(0, 80)})`);
        throw new Error(`${name} must not be called`);
      });
    vi.stubGlobal("fetch", spy("fetch"));
    vi.stubGlobal("XMLHttpRequest", spy("XMLHttpRequest"));
    vi.stubGlobal("WebSocket", spy("WebSocket"));
    vi.stubGlobal("EventSource", spy("EventSource"));
    vi.stubGlobal("navigator", { sendBeacon: spy("sendBeacon") });
    vi.stubGlobal("localStorage", { setItem: spy("localStorage.setItem") });
    vi.stubGlobal("sessionStorage", { setItem: spy("sessionStorage.setItem") });
    vi.stubGlobal("indexedDB", { open: spy("indexedDB.open") });

    const files = [
      buildSampleCsv(),
      toDelimited(ECOM_HEADERS, ecommerceRows()),
      toDelimited(RESULTS_ONLY_HEADERS, mixedResultRows()),
      "not,a,meta,export\n1,2,3,4\n",
    ];
    for (const csv of files)
      auditExport({
        bytes: new TextEncoder().encode(csv),
        fileName: "export.csv",
        today: "2026-10-30",
      });
    expect(calls).toEqual([]);
  });

  /** The audit page's browser modules: the client component and everything it imports. */
  function clientGraph(entry: string): Map<string, string> {
    const seen = new Map<string, string>();
    const resolve = (from: string, spec: string): string | null => {
      const base = spec.startsWith("@/")
        ? path.join(SRC, spec.slice(2))
        : spec.startsWith(".")
          ? path.resolve(path.dirname(from), spec)
          : null;
      if (!base) return null;
      for (const candidate of [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        path.join(base, "index.ts"),
        path.join(base, "index.tsx"),
      ])
        if (existsSync(candidate) && !candidate.endsWith(".css") && /\.tsx?$/.test(candidate))
          return candidate;
      return null;
    };
    const visit = (file: string) => {
      if (seen.has(file)) return;
      const source = readFileSync(file, "utf8");
      seen.set(file, source);
      for (const [, typeOnly, spec] of source.matchAll(
        /^(?:import|export)\s+(type\s+)?[^'"]*?from\s+["']([^"']+)["']/gm,
      )) {
        if (typeOnly) continue;
        const next = resolve(file, spec);
        if (next) visit(next);
      }
    };
    visit(entry);
    return seen;
  }

  const graph = clientGraph(path.join(SRC, "features/audit/audit-tool.tsx"));

  it("loads only modules that cannot send, store or serve the file", () => {
    const names = [...graph.keys()].map((f) => path.relative(ROOT, f));
    expect(names).toContain("src/features/audit/audit.ts");
    expect(names).toContain("src/data/import/validate.ts");
    expect(names).toContain("src/domain/insights/rules.ts");
    for (const [file, source] of graph) {
      const name = path.relative(ROOT, file);
      expect(name, "no database or seed code in the browser").not.toMatch(
        /supabase|data\/seed|features\/workspace/,
      );
      expect(source, name).not.toMatch(
        /["']use server["']|XMLHttpRequest|sendBeacon|WebSocket|EventSource|localStorage|sessionStorage|indexedDB|document\.cookie|next\/headers|server-only/,
      );
      for (const [call] of source.matchAll(/\bfetch\([^)]*\)/g))
        expect(`${name}: ${call}`).toBe(
          "src/features/audit/audit-tool.tsx: fetch(SAMPLE_PATH)",
        );
      expect(source, name).not.toMatch(/<form[^>]*action=/);
    }
  });

  it("fetches the sample with a plain GET and no body", () => {
    const tool = graph.get(path.join(SRC, "features/audit/audit-tool.tsx"))!;
    expect(tool).toMatch(/await fetch\(SAMPLE_PATH\);/);
    expect(graph.get(path.join(SRC, "features/audit/sample-path.ts"))).toContain(
      '"/audit-sample.csv"',
    );
  });

  it("has no route handler, server action or API beside the page", () => {
    const dir = path.join(SRC, "app/(marketing)/audit");
    expect(readdirSync(dir)).toEqual(["page.tsx"]);
    expect(existsSync(path.join(SRC, "app/api/audit"))).toBe(false);
    const page = readFileSync(path.join(dir, "page.tsx"), "utf8");
    expect(page).not.toMatch(/["']use server["']|fetch\(/);
  });
});
