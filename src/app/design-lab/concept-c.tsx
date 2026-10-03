import { CreativeThumbnail } from "@/components/ui/creative-thumbnail";
import { buildChart } from "./chart-geo";
import { tone, type LabKey, type LabModel } from "./data";
import { LabSidebar } from "./lab-sidebar";

const W = 680;
const H = 380;
const LINE = "border-[#dde5f4]";
const SHADES = ["#2563eb", "#5b8def", "#8fb0f5", "#bcd1fa", "#dbe6fc"];

function Card({
  title,
  right,
  children,
  className = "",
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border ${LINE} bg-white ${className}`}>
      <div className="flex items-center justify-between px-4 pt-3.5">
        <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export function ConceptC({ m }: { m: LabModel }) {
  const r = m.metrics.roas;
  const { cpa } = m.metrics;
  const g = buildChart({ cur: r.cur, pre: r.pre, target: r.target }, W, H);
  const b = r.bestIdx;
  const w = r.worstIdx;
  const strip: LabKey[] = ["roas", "spend", "conversions", "revenue", "cpa", "ctr"];
  const gap = (r.target ?? 0) - r.value;
  const top5 = m.delivering.slice(0, 5);
  const ranked = m.movers.slice(0, 6);
  const cpaRows = m.delivering.slice(0, 6);
  const last = g.cur.pts[g.cur.pts.length - 1];

  return (
    <div className={`flex w-[1440px] border border-border-strong bg-[#f3f6fc]`}>
      <LabSidebar tone="blue" m={m} />
      <main className="min-w-0 flex-1 px-6 pt-4 pb-6">
        <header className="flex h-10 items-center justify-between">
          <p className="text-[13px] text-ink-muted">
            {m.agency} <span className="px-1 text-ink-faint">/</span> {m.client.name}{" "}
            <span className="px-1 text-ink-faint">/</span>
            <span className="font-semibold text-ink"> Overview</span>
          </p>
          <div className="flex items-center gap-4">
            <p className="flex items-center gap-1.5 text-xs text-ink-muted">
              <span className="size-1.5 rounded-full bg-positive" />
              Data to {m.curShort.split(" – ")[1]}
            </p>
            <p className="text-[13px] font-medium text-ink-secondary tabular">{m.rangeLabel}</p>
            <div
              className={`flex rounded-md border ${LINE} bg-white p-0.5 text-xs font-medium`}
            >
              {["7D", "14D", "30D"].map((p) => (
                <span
                  key={p}
                  className={`flex h-7 items-center rounded-sm px-3 ${p === "14D" ? "bg-accent text-white" : "text-ink-muted"}`}
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        </header>

        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_300px] gap-4">
          <section className={`overflow-hidden rounded-lg border ${LINE} bg-white`}>
            <div className="flex items-start justify-between px-6 pt-5">
              <div>
                <p className="text-[13px] font-medium text-ink-secondary">Return on ad spend</p>
                <p className="mt-1.5 flex items-center gap-3">
                  <span className="text-[56px] leading-[56px] font-semibold tracking-[-0.04em] text-ink">
                    {r.full(r.value)}
                  </span>
                  <span
                    className={`rounded-md px-2 py-1 text-[13px] font-semibold tabular ${r.change !== null && r.change > 0 ? "bg-positive-soft text-positive" : "bg-negative-soft text-negative"}`}
                  >
                    {m.fmtChange(r.change)}
                  </span>
                </p>
              </div>
              <div className="flex gap-3 pt-1">
                <div className="w-[150px] rounded-md bg-accent-soft px-3 py-2.5">
                  <p className="text-xs font-medium text-accent-strong">Target</p>
                  <p className="mt-0.5 text-[20px] leading-6 font-semibold tracking-[-0.02em] text-ink tabular">
                    {r.targetText}
                  </p>
                  <p className="text-xs font-medium text-negative tabular">
                    {r.full(gap)} short
                  </p>
                </div>
                <div className="w-[150px] rounded-md bg-surface-subtle px-3 py-2.5">
                  <p className="text-xs font-medium text-ink-muted">Previous 14 days</p>
                  <p className="mt-0.5 text-[20px] leading-6 font-semibold tracking-[-0.02em] text-ink tabular">
                    {r.full(r.prev)}
                  </p>
                  <p className="text-xs text-ink-muted tabular">{m.prevLabel}</p>
                </div>
              </div>
            </div>

            <div className={`mt-5 grid grid-cols-6 border-y ${LINE}`}>
              {strip.map((k) => {
                const t = m.metrics[k];
                const sel = k === "roas";
                return (
                  <div
                    key={k}
                    className={`relative border-r px-4 py-3 last:border-r-0 ${LINE} ${sel ? "bg-accent-soft" : ""}`}
                  >
                    {sel ? <span className="absolute inset-x-0 top-0 h-0.5 bg-accent" /> : null}
                    <p
                      className={`truncate text-xs font-medium ${sel ? "text-accent-strong" : "text-ink-muted"}`}
                    >
                      {t.short}
                    </p>
                    <p className="mt-0.5 text-[18px] leading-6 font-semibold tracking-[-0.02em] text-ink tabular">
                      {t.full(t.value)}
                    </p>
                    <p
                      className={`text-xs font-medium tabular ${tone(t.change, t.higherIsBetter)}`}
                    >
                      {m.fmtChange(t.change)}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="px-6 pt-4 pb-5">
              <div className="flex items-center justify-between">
                <h2 className="text-[14px] font-semibold text-ink">Daily return on ad spend</h2>
                <ul className="flex gap-4 text-xs text-ink-muted">
                  <li className="flex items-center gap-1.5">
                    <span className="h-0.5 w-3.5 rounded-full bg-accent" />
                    This period
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="h-0.5 w-3.5 rounded-full bg-chart-muted" />
                    Previous · day by day
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-3.5 border-t border-dashed border-ink" />
                    Target
                  </li>
                </ul>
              </div>
              <div className="relative mt-5 mr-[76px] ml-11 h-[380px]">
                {g.ticks.map((t) => (
                  <div key={t.v} className="absolute inset-x-0" style={{ top: `${t.top}%` }}>
                    <div className={`h-px ${t.v === 0 ? "bg-[#c9d4e8]" : "bg-[#e6ecf7]"}`} />
                    <span className="absolute top-0 right-full mr-3 -translate-y-1/2 text-[11px] text-ink-faint tabular">
                      {r.tick(t.v)}
                    </span>
                  </div>
                ))}
                {g.targetTop !== null ? (
                  <div
                    className="absolute inset-x-0 border-t border-dashed border-ink"
                    style={{ top: `${g.targetTop}%` }}
                  >
                    <span className="absolute -top-6 right-0 rounded-sm bg-ink px-1.5 py-0.5 text-[11px] font-medium text-white">
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
                    stroke="#b9c6dc"
                    strokeWidth={1.75}
                    vectorEffect="non-scaling-stroke"
                    strokeLinecap="round"
                  />
                  <path d={g.cur.area} fill="#2563eb" fillOpacity={0.13} />
                  <path
                    d={g.cur.line}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth={2.75}
                    vectorEffect="non-scaling-stroke"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div
                  className="absolute inset-y-0 w-px bg-accent/30"
                  style={{ left: `${g.cur.pts[b].x}%` }}
                />
                <span
                  className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-[3px] ring-accent"
                  style={{ left: `${g.cur.pts[b].x}%`, top: `${g.cur.pts[b].y}%` }}
                />
                <div
                  className="absolute z-10 w-[168px] -translate-x-1/2 rounded-md bg-ink p-2.5 text-xs text-white"
                  style={{
                    left: `${g.cur.pts[b].x}%`,
                    top: `${Math.max(0, g.cur.pts[b].y - 30)}%`,
                  }}
                >
                  <p className="text-white/60">{r.dates[b]} · best day</p>
                  <p className="mt-0.5 text-[20px] leading-6 font-semibold tracking-[-0.02em] tabular">
                    {r.full(r.cur[b])}
                  </p>
                  <p className="mt-0.5 text-white/60 tabular">
                    {r.full(r.pre[b])} on {r.preDates[b]}
                  </p>
                </div>
                <span
                  className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-2 ring-ink-muted"
                  style={{ left: `${g.cur.pts[w].x}%`, top: `${g.cur.pts[w].y}%` }}
                />
                <span
                  className="absolute -translate-x-1/2 text-[11px] font-medium text-ink-muted tabular"
                  style={{ left: `${g.cur.pts[w].x}%`, top: `calc(${g.cur.pts[w].y}% + 12px)` }}
                >
                  Low {r.full(r.cur[w])}
                </span>
                <span
                  className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-[3px] ring-white"
                  style={{ left: `${last.x}%`, top: `${last.y}%` }}
                />
                <span
                  className="absolute -translate-y-1/2 rounded-md bg-accent px-2 py-1 text-[13px] font-semibold text-white tabular"
                  style={{ left: "calc(100% + 14px)", top: `${last.y}%` }}
                >
                  {r.full(r.cur[r.cur.length - 1])}
                </span>
              </div>
              <div className="relative mt-2.5 mr-[76px] ml-11 h-4 text-[11px] text-ink-faint tabular">
                {r.dates.map((d, k) =>
                  k % 2 === 0 ? (
                    <span
                      key={d}
                      className="absolute -translate-x-1/2"
                      style={{ left: `${(k / (r.dates.length - 1)) * 100}%` }}
                    >
                      {d}
                    </span>
                  ) : null,
                )}
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-3">
            <section className="rounded-lg border border-accent-border bg-accent-soft p-4">
              <h3 className="text-[13px] font-semibold text-accent-strong">Target gap</h3>
              <p className="mt-2 text-[34px] leading-9 font-semibold tracking-[-0.03em] text-negative tabular">
                −{r.full(gap)}
              </p>
              <p className="text-xs text-ink-secondary">ROAS vs {r.targetText} target</p>
              <div className="relative mt-3 h-1.5 rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${(r.value / ((r.target ?? 1) * 1.25)) * 100}%` }}
                />
                <span
                  className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-ink"
                  style={{ left: "80%" }}
                />
              </div>
              <div className="mt-4 flex items-baseline justify-between border-t border-accent-border/70 pt-3 text-[13px]">
                <span className="text-ink-secondary">Cost per purchase</span>
                <span className="font-semibold text-positive tabular">
                  {m.fmtMoney2((cpa.target ?? 0) - cpa.value)} under
                </span>
              </div>
              <p className="text-xs text-ink-muted tabular">
                {cpa.full(cpa.value)} vs {cpa.targetText} target
              </p>
            </section>

            <Card
              title="Ranked changes"
              right={<span className="text-xs text-ink-muted">vs {m.prevLabel}</span>}
            >
              <ol className="px-4 pt-2 pb-2">
                {ranked.map((x, k) => (
                  <li
                    key={x.id}
                    className="flex items-center gap-2.5 border-b border-[#e9eef8] py-2 last:border-0"
                  >
                    <span className="w-3.5 text-xs text-ink-faint tabular">{k + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-ink">{x.name}</p>
                      <p className="text-xs text-ink-muted">{x.measure}</p>
                    </div>
                    <span
                      className={`text-[13px] font-semibold tabular ${tone(x.change, x.measure === "Spend" ? null : true)}`}
                    >
                      {x.deltaText}
                    </span>
                  </li>
                ))}
              </ol>
            </Card>

            <Card title="Spend concentration" className="flex-1">
              <ul className="space-y-2.5 px-4 pt-3 pb-4">
                {top5.map((x, k) => (
                  <li key={x.id}>
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="truncate pr-2 text-ink-secondary">{x.name}</span>
                      <span className="font-semibold text-ink tabular">
                        {Math.round((x.spend / m.totalSpend) * 100)}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-sm bg-[#e9eef8]">
                      <div
                        className="h-full rounded-sm"
                        style={{
                          width: `${(x.spend / top5[0].spend) * 100}%`,
                          background: SHADES[k],
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4">
          <Card
            title="Cost per purchase by campaign"
            right={<span className="text-xs text-ink-muted">target {cpa.targetText}</span>}
          >
            <ul className="space-y-2.5 px-4 pt-3 pb-4">
              {cpaRows.map((x) => {
                const over = x.cpa !== null && x.cpa > (cpa.target ?? 0);
                const frac = x.cpa === null ? 0 : Math.min(1, x.cpa / ((cpa.target ?? 1) * 2));
                return (
                  <li
                    key={x.id}
                    className="grid grid-cols-[112px_1fr_56px] items-center gap-2 text-xs"
                  >
                    <span className="truncate text-ink-secondary">
                      {x.name.split(" · ").pop()}
                    </span>
                    <div className="relative h-2 rounded-sm bg-[#e9eef8]">
                      <div
                        className="h-full rounded-sm bg-accent"
                        style={{ width: `${frac * 100}%` }}
                      />
                      <span
                        className="absolute -top-1 h-4 w-0.5 bg-ink"
                        style={{ left: "50%" }}
                      />
                    </div>
                    <span
                      className={`text-right font-semibold tabular ${over ? "text-negative" : "text-ink"}`}
                    >
                      {x.cpa === null ? "—" : m.fmtMoney2(x.cpa)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card
            title="Top creatives by ROAS"
            right={<span className="text-xs text-ink-muted">≥ £100 spend</span>}
          >
            <ul className="px-4 pt-2 pb-3">
              {m.creatives.map((x) => (
                <li
                  key={x.creative.id}
                  className="flex items-center gap-3 border-b border-[#e9eef8] py-2 last:border-0"
                >
                  <CreativeThumbnail
                    thumbnail={x.creative.thumbnail}
                    type={x.creative.type}
                    frame="square"
                    size="sm"
                    className="w-9 shrink-0 rounded-sm"
                  />
                  <p className="min-w-0 flex-1 truncate text-[13px] text-ink">
                    {x.creative.name}
                  </p>
                  <div className="text-right tabular">
                    <p className="text-[13px] font-semibold text-ink">
                      {x.current.derived.roas?.toFixed(2)}x
                    </p>
                    <p className="text-xs text-ink-muted">
                      {m.fmtMoney(x.current.totals.spend)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Spend by funnel stage">
            <ul className="space-y-3.5 px-4 pt-3.5 pb-4">
              {m.tierRows.map((t) => (
                <li key={t.name}>
                  <div className="flex items-baseline justify-between text-[13px]">
                    <span className="font-medium text-ink">{t.name}</span>
                    <span className="text-xs text-ink-muted tabular">
                      ROAS{" "}
                      <span className="font-semibold text-ink">
                        {t.roas === null ? "—" : `${t.roas.toFixed(2)}x`}
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-sm bg-[#e9eef8]">
                      <div
                        className="h-full rounded-sm bg-accent"
                        style={{ width: `${t.share * 100}%` }}
                      />
                    </div>
                    <span className="w-24 text-right text-xs text-ink-secondary tabular">
                      {m.fmtMoney(t.spend)} · {Math.round(t.share * 100)}%
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <section className={`mt-4 overflow-hidden rounded-lg border ${LINE} bg-white`}>
          <div className="flex items-center justify-between px-4 py-3">
            <h3 className="text-[13px] font-semibold text-ink">Campaigns</h3>
            <span className="text-xs font-medium text-accent">
              View all {m.campaigns.length} →
            </span>
          </div>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className={`border-y ${LINE} bg-[#f7f9fd] text-xs text-ink-muted`}>
                <th className="h-8 pl-4 text-left font-medium">Campaign</th>
                {[
                  "Spend",
                  "Change",
                  "Purchases",
                  "Change",
                  "Cost per purchase",
                  "ROAS",
                  "CTR",
                ].map((h, k) => (
                  <th key={`${h}${k}`} className="h-8 px-3 text-right font-medium last:pr-4">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {top5.map((x) => (
                <tr key={x.id} className="border-b border-[#e9eef8] last:border-0">
                  <td className="h-9 pl-4">
                    <span className="font-medium text-ink">{x.name}</span>{" "}
                    <span className="text-xs text-ink-faint">{x.tier}</span>
                  </td>
                  <td className="px-3 text-right font-semibold text-ink tabular">
                    {m.fmtMoney(x.spend)}
                  </td>
                  <td
                    className={`px-3 text-right text-xs font-medium tabular ${tone(x.spendChange, null)}`}
                  >
                    {m.fmtChange(x.spendChange)}
                  </td>
                  <td className="px-3 text-right font-semibold text-ink tabular">{x.conv}</td>
                  <td
                    className={`px-3 text-right text-xs font-medium tabular ${tone(x.convChange, true)}`}
                  >
                    {m.fmtChange(x.convChange)}
                  </td>
                  <td
                    className={`px-3 text-right tabular ${x.cpa !== null && x.cpa > (cpa.target ?? 0) ? "font-semibold text-negative" : "text-ink-secondary"}`}
                  >
                    {x.cpa === null ? "—" : m.fmtMoney2(x.cpa)}
                  </td>
                  <td className="px-3 text-right text-ink-secondary tabular">
                    {x.roas === null ? "—" : `${x.roas.toFixed(2)}x`}
                  </td>
                  <td className="px-3 pr-4 text-right text-ink-secondary tabular">
                    {x.ctr === null ? "—" : `${(x.ctr * 100).toFixed(2)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
