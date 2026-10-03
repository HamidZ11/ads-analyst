import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { buildChart, spark } from "./chart-geo";
import { tone, toneAlways, type LabKey, type LabMetric, type LabModel } from "./data";
import { LabSidebar } from "./lab-sidebar";

const W = 750;
const H = 340;
const SHADES = ["#2563eb", "#5b8def", "#8fb0f5", "#bcd1fa", "#dbe6fc"];

function Spark({ m, w = 92, h = 34 }: { m: LabMetric; w?: number; h?: number }) {
  const s = spark(m.cur, w, h);
  return (
    <svg
      aria-hidden
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="shrink-0 overflow-visible"
    >
      <path d={s.area} fill="#2563eb" fillOpacity={0.08} />
      <path d={s.line} fill="none" stroke="#2563eb" strokeWidth={1.75} strokeLinecap="round" />
      <circle
        cx={s.last.x}
        cy={s.last.y}
        r={3}
        fill="#2563eb"
        stroke="#fff"
        strokeWidth={1.5}
      />
    </svg>
  );
}

function Kpi({
  m,
  context,
  primary = false,
  children,
}: {
  m: LabMetric;
  context: string;
  primary?: boolean;
  children?: React.ReactNode;
}) {
  const up = m.change !== null && m.change > 0;
  const Arrow = up ? ArrowUpRight : ArrowDownRight;
  return (
    <div
      className={`flex flex-col rounded-lg border p-4 ${
        primary ? "border-accent-border bg-[#f3f7fe]" : "border-border bg-white"
      }`}
    >
      <div className="flex items-center justify-between">
        <p
          className={`text-[13px] font-medium ${primary ? "text-accent-strong" : "text-ink-secondary"}`}
        >
          {m.label}
        </p>
        <p
          className={`flex items-center gap-0.5 text-xs font-medium tabular ${primary ? toneAlways(m.change, m.higherIsBetter) : tone(m.change, m.higherIsBetter)}`}
        >
          {m.change === null ? null : <Arrow aria-hidden size={12} strokeWidth={2.25} />}
          {m.change === null ? "—" : `${Math.abs(m.change * 100).toFixed(1)}%`}
        </p>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p
          className={`font-semibold tracking-[-0.03em] text-ink ${primary ? "text-[40px] leading-[40px]" : "text-[28px] leading-[32px]"}`}
        >
          {m.full(m.value)}
        </p>
        <Spark m={m} w={primary ? 112 : 84} />
      </div>
      <div className="mt-3 border-t border-black/5 pt-2.5 text-xs text-ink-muted">
        {children ?? context}
      </div>
    </div>
  );
}

function TargetBar({
  value,
  target,
  lowerIsBetter = false,
}: {
  value: number;
  target: number;
  lowerIsBetter?: boolean;
}) {
  const scale = target * 1.25;
  const w = Math.min(100, (value / scale) * 100);
  const good = lowerIsBetter ? value <= target : value >= target;
  return (
    <div className="relative mt-1.5 h-1.5 rounded-full bg-white/80 ring-1 ring-black/5 ring-inset">
      <div
        className={`h-full rounded-full ${good ? "bg-accent" : "bg-accent"}`}
        style={{ width: `${w}%` }}
      />
      <span
        className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-ink"
        style={{ left: "80%" }}
      />
    </div>
  );
}

function Panel({
  title,
  sub,
  action,
  children,
  className = "",
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-border bg-white ${className}`}>
      <div className="flex items-start justify-between px-4 pt-3.5">
        <div>
          <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-ink">{title}</h3>
          {sub ? <p className="mt-0.5 text-xs text-ink-muted">{sub}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ConceptA({ m }: { m: LabModel }) {
  const r = m.metrics.roas;
  const c = m.metrics.conversions;
  const cpa = m.metrics.cpa;
  const spend = m.metrics.spend;
  const g = buildChart({ cur: r.cur, pre: r.pre, target: r.target }, W, H);
  const i = r.bestIdx;
  const daysAbove = r.cur.filter((v) => v >= (r.target ?? Infinity)).length;
  const tabs: LabKey[] = ["roas", "spend", "revenue", "conversions", "cpa", "ctr"];
  const top = m.delivering.slice(0, 6);
  const concentration = [...m.delivering.slice(0, 5)];
  const rest = m.delivering.slice(5).reduce((s, x) => s + x.spend, 0);

  return (
    <div className="flex w-[1440px] border border-border-strong bg-canvas">
      <LabSidebar tone="grey" m={m} />
      <main className="min-w-0 flex-1 px-8 py-6">
        <header className="flex items-end justify-between">
          <div>
            <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.02em] text-ink">
              Overview
            </h1>
            <p className="mt-1 text-[13px] text-ink-muted">
              <span className="font-medium text-ink-secondary">{m.client.name}</span> · Meta Ads
              · {m.accountId}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-right text-[13px] leading-5">
              <span className="block font-medium text-ink-secondary tabular">
                {m.rangeLabel}
              </span>
              <span className="block text-xs text-ink-muted">vs {m.prevLabel}</span>
            </p>
            <div className="flex rounded-md border border-border bg-white p-0.5 text-xs font-medium">
              {["7D", "14D", "30D"].map((p) => (
                <span
                  key={p}
                  className={`flex h-7 items-center rounded-sm px-3 ${p === "14D" ? "bg-accent-soft text-accent-strong" : "text-ink-muted"}`}
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        </header>

        <div className="mt-5 grid grid-cols-[1.45fr_1fr_1fr_1fr] gap-4">
          <Kpi m={r} context="" primary>
            <div className="flex items-baseline justify-between">
              <span>
                Target <span className="font-medium text-ink tabular">{r.targetText}</span>
              </span>
              <span className="font-medium text-negative tabular">
                {r.full((r.target ?? 0) - r.value)} short
              </span>
            </div>
            <TargetBar value={r.value} target={r.target ?? 1} />
          </Kpi>
          <Kpi
            m={spend}
            context={`${m.fmtMoney(spend.avg)} per day · prev ${m.fmtMoney(spend.prev)}`}
          />
          <Kpi m={c} context={`${c.avg.toFixed(1)} per day · prev ${c.prev}`} />
          <Kpi m={cpa} context="">
            <div className="flex items-baseline justify-between">
              <span>
                Target <span className="font-medium text-ink tabular">{cpa.targetText}</span>
              </span>
              <span className="font-medium text-positive tabular">
                {m.fmtMoney2((cpa.target ?? 0) - cpa.value)} under
              </span>
            </div>
            <TargetBar value={cpa.value} target={cpa.target ?? 1} lowerIsBetter />
          </Kpi>
        </div>

        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_366px] gap-4">
          <section className="flex flex-col rounded-lg border border-border bg-white">
            <div className="flex items-start justify-between px-5 pt-4">
              <div>
                <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">
                  Return on ad spend
                </h2>
                <p className="mt-0.5 text-xs text-ink-muted tabular">Daily · {m.curShort}</p>
              </div>
              <div className="flex rounded-md border border-border bg-white p-0.5 text-xs font-medium">
                {tabs.map((k) => (
                  <span
                    key={k}
                    className={`flex h-7 items-center rounded-sm px-2.5 ${k === "roas" ? "bg-accent-soft text-accent-strong" : "text-ink-muted"}`}
                  >
                    {m.metrics[k].short === "Cost per purchase"
                      ? "Cost / purchase"
                      : m.metrics[k].short}
                  </span>
                ))}
              </div>
            </div>
            <ul className="flex gap-5 px-5 pt-3 text-xs text-ink-muted">
              <li className="flex items-center gap-1.5">
                <span className="h-0.5 w-3.5 rounded-full bg-accent" />
                {m.curShort}
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-0.5 w-3.5 rounded-full bg-chart-muted" />
                {m.prevLabel} · day by day
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-3.5 border-t border-dashed border-ink-muted" />
                Target {r.targetText}
              </li>
            </ul>

            <div className="relative mx-5 mt-5 mr-[72px] ml-[68px] h-[340px]">
              {g.ticks.map((t) => (
                <div key={t.v} className="absolute inset-x-0" style={{ top: `${t.top}%` }}>
                  <div className={`h-px ${t.v === 0 ? "bg-border-strong" : "bg-chart-grid"}`} />
                  <span className="absolute top-0 right-full mr-3 -translate-y-1/2 text-[11px] text-ink-faint tabular">
                    {r.tick(t.v)}
                  </span>
                </div>
              ))}
              {g.targetTop !== null ? (
                <div
                  className="absolute inset-x-0 border-t border-dashed border-ink-muted"
                  style={{ top: `${g.targetTop}%` }}
                >
                  <span className="absolute -top-6 right-0 rounded-sm bg-white px-1.5 text-[11px] font-medium text-ink-secondary">
                    Target {r.targetText}
                  </span>
                </div>
              ) : null}
              <svg
                aria-hidden
                className="absolute inset-0 h-full w-full overflow-visible"
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="none"
              >
                <path
                  d={g.pre.line}
                  fill="none"
                  stroke="#a7b4c6"
                  strokeWidth={1.75}
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                />
                <path d={g.cur.area} fill="#2563eb" fillOpacity={0.07} />
                <path
                  d={g.cur.line}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div
                className="absolute inset-y-0 w-px bg-border-strong"
                style={{ left: `${g.cur.pts[i].x}%` }}
              />
              <span
                className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-muted ring-2 ring-white"
                style={{ left: `${g.pre.pts[i].x}%`, top: `${g.pre.pts[i].y}%` }}
              />
              <span
                className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-2 ring-white"
                style={{ left: `${g.cur.pts[i].x}%`, top: `${g.cur.pts[i].y}%` }}
              />
              <div
                className="absolute z-10 w-[196px] translate-x-3 rounded-md border border-border bg-white p-2.5 text-xs shadow-md"
                style={{ left: `${g.cur.pts[i].x}%`, top: "28%" }}
              >
                <p className="text-ink-muted">{r.dates[i]}</p>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-ink-secondary">
                    <span className="h-0.5 w-3 rounded-full bg-accent" />
                    This period
                  </span>
                  <span className="text-[13px] font-semibold text-ink tabular">
                    {r.full(r.cur[i])}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-ink-secondary">
                    <span className="h-0.5 w-3 rounded-full bg-chart-muted" />
                    {r.preDates[i]}
                  </span>
                  <span className="text-ink-secondary tabular">{r.full(r.pre[i])}</span>
                </div>
                <p className="mt-1.5 border-t border-border pt-1.5 text-ink-muted">
                  Best day of the period
                </p>
              </div>
              <span
                className="absolute left-full ml-3 -translate-y-1/2 rounded-sm bg-accent px-1.5 py-0.5 text-xs font-semibold text-white tabular"
                style={{ top: `${g.cur.pts[g.cur.pts.length - 1].y}%` }}
              >
                {r.full(r.cur[r.cur.length - 1])}
              </span>
              <span
                className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-2 ring-white"
                style={{ left: "100%", top: `${g.cur.pts[g.cur.pts.length - 1].y}%` }}
              />
            </div>
            <div className="relative mt-2.5 mr-[72px] ml-[68px] h-4 text-[11px] text-ink-faint tabular">
              {r.dates.map((d, idx) =>
                idx % 2 === 0 ? (
                  <span
                    key={d}
                    className="absolute -translate-x-1/2"
                    style={{ left: `${(idx / (r.dates.length - 1)) * 100}%` }}
                  >
                    {d}
                  </span>
                ) : null,
              )}
            </div>
            <dl className="mt-auto grid grid-cols-4 divide-x divide-border border-t border-border bg-surface-subtle">
              {[
                ["Period average", r.full(r.avg), `${r.full(r.prev)} previous`],
                ["Best day", r.full(r.cur[r.bestIdx]), r.dates[r.bestIdx]],
                ["Lowest day", r.full(r.cur[r.worstIdx]), r.dates[r.worstIdx]],
                ["Days at target", `${daysAbove} of ${r.cur.length}`, `target ${r.targetText}`],
              ].map(([k, v, s]) => (
                <div key={k} className="px-5 py-3">
                  <dt className="text-xs text-ink-muted">{k}</dt>
                  <dd className="mt-0.5 text-[16px] font-semibold tracking-[-0.01em] text-ink tabular">
                    {v}
                  </dd>
                  <dd className="text-xs text-ink-muted tabular">{s}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="flex flex-col gap-4">
            <Panel title="Target status" sub="Against the client's targets">
              <ul className="space-y-3.5 px-4 pt-3 pb-4">
                {[
                  {
                    n: "Return on ad spend",
                    mt: r,
                    text: `${r.full(r.value)} of ${r.targetText}`,
                    note: `${r.full((r.target ?? 0) - r.value)} short`,
                    cls: "text-negative",
                    low: false,
                  },
                  {
                    n: "Cost per purchase",
                    mt: cpa,
                    text: `${cpa.full(cpa.value)} vs ${cpa.targetText}`,
                    note: `${m.fmtMoney2((cpa.target ?? 0) - cpa.value)} under`,
                    cls: "text-positive",
                    low: true,
                  },
                ].map((row) => (
                  <li key={row.n}>
                    <div className="flex items-baseline justify-between text-[13px]">
                      <span className="font-medium text-ink">{row.n}</span>
                      <span className={`text-xs font-medium tabular ${row.cls}`}>
                        {row.note}
                      </span>
                    </div>
                    <div className="relative mt-1.5 h-1.5 rounded-full bg-surface-active">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{
                          width: `${Math.min(100, (row.mt.value / ((row.mt.target ?? 1) * 1.25)) * 100)}%`,
                        }}
                      />
                      <span
                        className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-ink"
                        style={{ left: "80%" }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-ink-muted tabular">{row.text}</p>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel
              title="Spend concentration"
              sub={`${m.fmtMoney(m.totalSpend)} · ${m.delivering.length} campaigns`}
            >
              <div className="px-4 pt-3 pb-4">
                <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-sm">
                  {concentration.map((x, idx) => (
                    <span
                      key={x.id}
                      style={{
                        width: `${(x.spend / m.totalSpend) * 100}%`,
                        background: SHADES[idx],
                      }}
                    />
                  ))}
                  <span
                    className="bg-surface-active"
                    style={{ width: `${(rest / m.totalSpend) * 100}%` }}
                  />
                </div>
                <ul className="mt-3 space-y-2">
                  {concentration.map((x, idx) => (
                    <li key={x.id} className="flex items-center gap-2 text-[13px]">
                      <span
                        className="size-2 shrink-0 rounded-sm"
                        style={{ background: SHADES[idx] }}
                      />
                      <span className="min-w-0 flex-1 truncate text-ink">{x.name}</span>
                      <span className="font-medium text-ink tabular">
                        {m.fmtMoney(x.spend)}
                      </span>
                      <span className="w-9 text-right text-xs text-ink-muted tabular">
                        {Math.round((x.spend / m.totalSpend) * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Panel>

            <Panel title="Largest movers" sub={`vs ${m.prevLabel}`} className="flex-1">
              <ul className="divide-y divide-border px-4 pt-1 pb-2">
                {m.movers.slice(0, 5).map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] text-ink">{x.name}</p>
                      <p className="text-xs text-ink-muted">
                        {x.measure} · {x.text}
                      </p>
                    </div>
                    <p
                      className={`text-[13px] font-semibold tabular ${tone(x.change, x.measure === "Spend" ? null : true)}`}
                    >
                      {x.deltaText}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_366px] gap-4">
          <Panel
            title="Top campaigns"
            sub="By spend this period"
            action={
              <span className="flex items-center gap-1 text-[13px] font-medium text-accent">
                All {m.campaigns.length} campaigns <ArrowRight size={14} />
              </span>
            }
          >
            <table className="mt-3 w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-y border-border bg-surface-subtle text-xs text-ink-muted">
                  <th className="h-9 pl-4 text-left font-medium">Campaign</th>
                  {["Spend", "Change", "Purchases", "Change", "Cost per purchase", "ROAS"].map(
                    (h, k) => (
                      <th
                        key={`${h}${k}`}
                        className="h-9 px-3 text-right font-medium last:pr-4"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {top.map((x) => (
                  <tr key={x.id} className="border-b border-border last:border-0">
                    <td className="h-11 max-w-[260px] pl-4">
                      <span className="flex items-center gap-2">
                        <span className="size-1.5 shrink-0 rounded-full bg-positive" />
                        <span className="truncate font-medium text-ink">{x.name}</span>
                      </span>
                      <span className="block pl-3.5 text-xs text-ink-muted">{x.tier}</span>
                    </td>
                    <td className="px-3 text-right font-medium text-ink tabular">
                      {m.fmtMoney(x.spend)}
                    </td>
                    <td
                      className={`px-3 text-right text-xs font-medium tabular ${tone(x.spendChange, null)}`}
                    >
                      {m.fmtChange(x.spendChange)}
                    </td>
                    <td className="px-3 text-right font-medium text-ink tabular">{x.conv}</td>
                    <td
                      className={`px-3 text-right text-xs font-medium tabular ${tone(x.convChange, true)}`}
                    >
                      {m.fmtChange(x.convChange)}
                    </td>
                    <td className="px-3 text-right text-ink-secondary tabular">
                      {x.cpa === null ? "—" : m.fmtMoney2(x.cpa)}
                    </td>
                    <td className="px-3 pr-4 text-right text-ink-secondary tabular">
                      {x.roas === null ? "—" : `${x.roas.toFixed(2)}x`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel title="Spend by funnel stage" sub="Share of spend and return">
            <ul className="space-y-4 px-4 pt-4 pb-4">
              {m.tierRows.map((t) => (
                <li key={t.name}>
                  <div className="flex items-baseline justify-between text-[13px]">
                    <span className="font-medium text-ink">{t.name}</span>
                    <span className="text-ink-secondary tabular">
                      {m.fmtMoney(t.spend)}{" "}
                      <span className="text-xs text-ink-muted">
                        {Math.round(t.share * 100)}%
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-sm bg-surface-active">
                    <div
                      className="h-full rounded-sm bg-accent"
                      style={{ width: `${t.share * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-ink-muted tabular">
                    ROAS {t.roas === null ? "—" : `${t.roas.toFixed(2)}x`}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <dl className="mt-4 grid grid-cols-6 divide-x divide-border rounded-lg border border-border bg-white">
          {[
            [
              "Campaigns",
              `${m.structure.campaigns.total}`,
              `${m.structure.campaigns.active} active · ${m.structure.campaigns.paused} paused`,
            ],
            ["Ad sets", `${m.structure.adSets}`, "across all campaigns"],
            ["Ads", `${m.structure.ads}`, "in delivery or paused"],
            ["Creatives", `${m.structure.creatives}`, "unique assets"],
            [
              "Data coverage",
              `${m.coverage?.days ?? 0} days`,
              `to ${m.curShort.split(" – ")[1]}`,
            ],
            ["Ad account", m.accountId.replace("act_", ""), "Meta Ads"],
          ].map(([k, v, s]) => (
            <div key={k} className="px-4 py-3">
              <dt className="text-xs text-ink-muted">{k}</dt>
              <dd className="text-[15px] font-semibold text-ink tabular">{v}</dd>
              <dd className="text-xs text-ink-muted">{s}</dd>
            </div>
          ))}
        </dl>
      </main>
    </div>
  );
}
