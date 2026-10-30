import { describe, expect, it } from "vitest";
import { ecommerceCsv, leadCsv } from "@/data/import/__fixtures__/meta-exports";
import { inspectHeaders, parseCsv, proposeMapping } from "@/data/import";
import { planImport } from "@/features/import/service";
import { buildClientReport } from "@/features/report/report-model";
import { buildContext } from "@/features/workspace/context";
import { addUser, as, createTestDatabase, sqlGateway } from "./test-database";
import { snapshotRepository } from "./snapshot";

/**
 * Client report notes and the workspace name, against the real migrations in
 * PGlite, as the authenticated and anon roles. A note belongs to one client
 * and period; only members of that client's workspace can read or write it.
 */

const ANA = "00000000-0000-4000-8000-00000000000a";
const BEN = "00000000-0000-4000-8000-00000000000b";
const CAL = "00000000-0000-4000-8000-00000000000c";
const START = "2026-09-27";
const END = "2026-10-03";

function payload(csv: string, name: string, type: "ecommerce" | "lead_generation") {
  const parsed = parseCsv(csv);
  if (!parsed.ok) throw new Error("bad fixture");
  const plan = planImport(
    {
      fileName: "export.csv",
      fileBytes: csv.length,
      csv,
      mapping: proposeMapping(inspectHeaders(parsed.table.headers), type).mapping,
      destination: {
        kind: "new",
        client: {
          name,
          type,
          currency: "GBP",
          timezone: "Europe/London",
          targetCpa: null,
          targetRoas: null,
        },
      },
    },
    { now: new Date("2026-10-03T10:00:00Z"), clients: [], accountIdFor: () => null },
  );
  if (!plan.ok) throw new Error(plan.message);
  return plan.payload;
}

async function seeded() {
  const db = await createTestDatabase();
  await addUser(db, ANA, "ana@agency.test");
  await addUser(db, BEN, "ben@other.test");
  await addUser(db, CAL, "cal@agency.test");
  const ana = sqlGateway(db, ANA);
  const ben = sqlGateway(db, BEN);
  const cal = sqlGateway(db, CAL);
  const [anaWs] = await ana.ensureWorkspaces("Ana's workspace");
  const [benWs] = await ben.ensureWorkspaces("Ben's workspace");
  const bloom = await ana.importMetaCsv(
    anaWs.id,
    payload(ecommerceCsv(), "Bloom Botanicals", "ecommerce"),
  );
  const fern = await ana.importMetaCsv(
    anaWs.id,
    payload(leadCsv(), "Fern Dental", "lead_generation"),
  );
  const bens = await ben.importMetaCsv(
    benWs.id,
    payload(ecommerceCsv(), "Other Shop", "ecommerce"),
  );
  // Cal is an ordinary member of Ana's workspace (no invite flow exists yet).
  await db.query(
    "insert into public.workspace_members (workspace_id, user_id, role) values ($1, $2, 'member')",
    [anaWs.id, CAL],
  );
  return {
    db,
    ana,
    ben,
    cal,
    anaWs,
    benWs,
    bloom: bloom.clientId,
    fern: fern.clientId,
    bens: bens.clientId,
  };
}

describe("client report notes", () => {
  it("saves, reads, updates and clears a note for one client and period", async () => {
    const { ana, bloom } = await seeded();
    expect(await ana.reportNote(bloom, START, END)).toBeNull();
    expect(await ana.saveReportNote(bloom, START, END, "  Shift budget to the serum.  ")).toBe(
      true,
    );
    expect((await ana.reportNote(bloom, START, END))?.body).toBe("Shift budget to the serum.");
    expect(await ana.saveReportNote(bloom, START, END, "Pause the sale campaign.")).toBe(true);
    expect((await ana.reportNote(bloom, START, END))?.body).toBe("Pause the sale campaign.");
    expect(await ana.saveReportNote(bloom, START, END, "   ")).toBe(true);
    expect(await ana.reportNote(bloom, START, END)).toBeNull();
  });

  it("keeps notes apart per client and per period", async () => {
    const { ana, bloom, fern } = await seeded();
    await ana.saveReportNote(bloom, START, END, "Bloom, this week.");
    await ana.saveReportNote(bloom, "2026-09-20", "2026-10-03", "Bloom, two weeks.");
    expect((await ana.reportNote(bloom, START, END))?.body).toBe("Bloom, this week.");
    expect((await ana.reportNote(bloom, "2026-09-20", "2026-10-03"))?.body).toBe(
      "Bloom, two weeks.",
    );
    expect(await ana.reportNote(fern, START, END)).toBeNull();
  });

  it("lets every member of the workspace read and write, and nobody else", async () => {
    const { db, ana, ben, cal, bloom, bens } = await seeded();
    await ana.saveReportNote(bloom, START, END, "Ana's plan.");
    // A member of the same workspace shares the note.
    expect((await cal.reportNote(bloom, START, END))?.body).toBe("Ana's plan.");
    expect(await cal.saveReportNote(bloom, START, END, "Cal's edit.")).toBe(true);
    // Another workspace can neither read nor write it, and learns nothing.
    expect(await ben.reportNote(bloom, START, END)).toBeNull();
    expect(await ben.saveReportNote(bloom, START, END, "Ben was here.")).toBe(false);
    expect((await ana.reportNote(bloom, START, END))?.body).toBe("Cal's edit.");
    // Nor can Ana write into Ben's client.
    expect(await ana.saveReportNote(bens, START, END, "Not mine.")).toBe(false);
    // Direct table reads are confined by RLS.
    const rows = (user: string | null) =>
      as(
        db,
        user,
        async () => (await db.query("select * from public.client_report_notes")).rows.length,
      );
    expect(await rows(ANA)).toBe(1);
    expect(await rows(BEN)).toBe(0);
    await expect(rows(null)).rejects.toThrow(/permission denied/);
  });

  it("refuses direct writes, anonymous calls and bad input", async () => {
    const { db, ana, anaWs, bloom } = await seeded();
    await expect(
      as(db, ANA, () =>
        db.query(
          "insert into public.client_report_notes (workspace_id, client_id, period_start, period_end, body) values ($1, $2, $3, $4, 'x')",
          [anaWs.id, bloom, START, END],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
    await ana.saveReportNote(bloom, START, END, "Plan.");
    await expect(
      as(db, ANA, () => db.query("update public.client_report_notes set body = 'changed'")),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(db, ANA, () => db.query("delete from public.client_report_notes")),
    ).rejects.toThrow(/permission denied/);
    for (const call of [
      "select public.client_report_note($1, $2, $3)",
      "select public.save_client_report_note($1, $2, $3, 'x')",
    ])
      await expect(as(db, null, () => db.query(call, [bloom, START, END]))).rejects.toThrow(
        /permission denied/,
      );
    await expect(ana.saveReportNote(bloom, START, END, "x".repeat(4001))).rejects.toMatchObject(
      {
        kind: "invalid",
      },
    );
    await expect(ana.saveReportNote(bloom, END, START, "Backwards.")).rejects.toMatchObject({
      kind: "invalid",
    });
    await expect(
      ana.saveReportNote(bloom, "2025-01-01", END, "Too long a period."),
    ).rejects.toMatchObject({
      kind: "invalid",
    });
    expect(await ana.saveReportNote(bloom, START, END, "x".repeat(4000))).toBe(true);
  });

  it("goes when its client goes", async () => {
    const { db, ana, bloom } = await seeded();
    await ana.saveReportNote(bloom, START, END, "Plan.");
    await db.query("delete from public.clients where id = $1", [bloom]);
    expect((await db.query("select * from public.client_report_notes")).rows).toHaveLength(0);
  });
});

describe("workspace name", () => {
  it("lets the owner rename the workspace, and nobody else", async () => {
    const { ana, ben, cal, anaWs } = await seeded();
    expect(await ana.renameWorkspace(anaWs.id, "  Northfield Digital  ")).toBe(true);
    expect((await ana.ensureWorkspaces("unused"))[0].name).toBe("Northfield Digital");
    // An ordinary member and an outsider are refused without an error.
    expect(await cal.renameWorkspace(anaWs.id, "Cal's agency")).toBe(false);
    expect(await ben.renameWorkspace(anaWs.id, "Ben's now")).toBe(false);
    expect((await ana.ensureWorkspaces("unused"))[0].name).toBe("Northfield Digital");
    await expect(ana.renameWorkspace(anaWs.id, "   ")).rejects.toMatchObject({
      kind: "invalid",
    });
    await expect(ana.renameWorkspace(anaWs.id, "x".repeat(121))).rejects.toMatchObject({
      kind: "invalid",
    });
  });
});

describe("client report for an imported client", () => {
  it("is built from the workspace snapshot, headed by the workspace name, with no other client's data", async () => {
    const { ana, anaWs, bloom } = await seeded();
    await ana.renameWorkspace(anaWs.id, "Northfield Digital");
    const [ws] = await ana.ensureWorkspaces("unused");
    const snapshot = await ana.snapshot(ws.id, bloom);
    const context = buildContext({
      mode: "supabase",
      user: { id: ANA, email: "ana@agency.test" },
      workspace: { id: ws.id, name: ws.name },
      repository: snapshotRepository(snapshot),
      requestedClientId: snapshot.client_id,
      preset: "7d",
      canImport: true,
      now: new Date("2026-10-03T10:00:00Z"),
    });
    const report = buildClientReport({
      ...context,
      client: context.client!,
      dataSource: context.dataSource!,
    });
    expect(report.agencyName).toBe("Northfield Digital");
    expect(report.clientName).toBe("Bloom Botanicals");
    expect(report.demo).toBe(false);
    expect(report.metrics.find((m) => m.key === "spend")?.current).toBeGreaterThan(0);
    const own = new Set(context.repository.listCampaigns(bloom).map((c) => c.id));
    for (const row of report.campaigns) expect(own.has(row.id)).toBe(true);
  });
});
