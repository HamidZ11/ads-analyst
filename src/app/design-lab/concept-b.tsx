import { buildChart, spark } from "./chart-geo";
import { tone, toneAlways, type LabKey, type LabMetric, type LabModel } from "./data";
import { LabSidebar } from "./lab-sidebar";

const W = 1040;
const H = 320;

function Spark({ m, w = 120, h = 40 }: { m: LabMetric; w?: number; h?: number }) {
  const s = spark(m.cur, w, h);
  return (
    <svg
      aria-hidden
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="shrink-0 overflow-visible"
    >
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

function Support({ m, note }: { m: LabMetric; note: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-5">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-ink-secondary">{m.label}</p>
        <p className="mt-1 text-[28px] leading-8 font-semibold tracking-[-0.03em] text-ink">
          {m.full(m.value)}
        </p>
        <p className="mt-1 text-xs text-ink-muted tabular">
          <span className={`font-medium ${tone(m.change, m.higherIsBetter)}`}>
            {m.change === null
              ? "—"
              : `${m.change > 0 ? "+" : "−"}${Math.abs(m.change * 100).toFixed(1)}%`}
          </span>{" "}
          · {note}
        </p>
      </div>
      <Spark m={m} />
    </div>
  );
}

export function ConceptB({ m }: { m: LabModel }) {
  const r = m.metrics.roas;
  const { spend, conversions: c, cpa, revenue } = m.metrics;
  const tabs: LabKey[] = ["roas", "spend", "revenue", "conversions", "cpa", "ctr"];
  const g = buildChart({ cur: r.cur, pre: r.pre, target: r.target }, W, H);
  const i = r.bestIdx;
  const top = m.delivering.slice(0, 6);
  const maxSpend = top[0]?.spend ?? 1;
  const gap = (r.target ?? 0) - r.value;

  return (
    <div className="flex w-[1440px] border border-border-strong bg-white">
      <LabSidebar tone="white" m={m} />
      <main className="min-w-0 flex-1 px-10 pt-9 pb-10">
        <header className="flex items-start justify-between">
          <div>
            <h1 className="text-[32px] leading-9 font-semibold tracking-[-0.03em] text-ink">
              Overview
            </h1>
            <p className="mt-1.5 text-[14px] text-ink-muted">
              <span className="font-medium text-ink-secondary">{m.client.name}</span> · Meta Ads
              · {m.accountId}
            </p>
          </div>
          <div className="flex items-end gap-7">
            <p className="text-right text-[13px] leading-5">
              <span className="block font-medium text-ink-secondary tabular">
                {m.rangeLabel}
              </span>
              <span className="block text-xs text-ink-muted">vs {m.prevLabel}</span>
            </p>
            <div className="flex gap-5 text-[13px] font-medium">
              {["7D", "14D", "30D"].map((p) => (
                <span
                  key={p}
                  className={`border-b-2 pb-1.5 ${p === "14D" ? "border-accent text-ink" : "border-transparent text-ink-muted"}`}
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        </header>

        <section className="mt-9 grid grid-cols-[440px_minmax(0,1fr)] gap-14">
          <div className="pt-1">
            <p className="text-[14px] font-medium text-ink-secondary">Return on ad spend</p>
            <p className="mt-2 flex items-baseline gap-4">
              <span className="text-[88px] leading-[88px] font-semibold tracking-[-0.045em] text-ink">
                {r.full(r.value)}
              </span>
              <span
                className={`text-[18px] font-semibold tabular ${toneAlways(r.change, true)}`}
              >
                {m.fmtChange(r.change)}
              </span>
            </p>
            <p className="mt-3 text-[14px] text-ink-muted">
              from <span className="font-medium text-ink tabular">{r.full(r.prev)}</span> in the
              previous 14 days
            </p>
            <div className="mt-6">
              <div className="relative h-1.5 rounded-full bg-surface-active">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${(r.value / ((r.target ?? 1) * 1.25)) * 100}%` }}
                />
                <span
                  className="absolute -top-1.5 h-4.5 w-0.5 rounded-full bg-ink"
                  style={{ left: "80%" }}
                />
              </div>
              <div className="mt-2.5 flex items-baseline justify-between text-[13px]">
                <span className="text-ink-muted">
                  <span className="font-semibold text-negative tabular">{r.full(gap)}</span>{" "}
                  short of target
                </span>
                <span className="text-ink-muted">
                  Target <span className="font-semibold text-ink tabular">{r.targetText}</span>
                </span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-12 border-l border-border pl-12">
            <div className="divide-y divide-border">
              <Support m={spend} note={`${m.fmtMoney(spend.avg)} a day`} />
              <Support
                m={cpa}
                note={`${m.fmtMoney2((cpa.target ?? 0) - cpa.value)} under ${cpa.targetText} target`}
              />
            </div>
            <div className="divide-y divide-border">
              <Support m={c} note={`${c.avg.toFixed(1)} a day`} />
              <Support m={revenue} note={`${r.full(r.value)} return`} />
            </div>
          </div>
        </section>

        <section className="mt-11">
          <div className="flex items-end justify-between border-b border-border">
            <div className="flex gap-8">
              {tabs.map((k) => {
                const t = m.metrics[k];
                const sel = k === "roas";
                return (
                  <div
                    key={k}
                    className={`-mb-px border-b-2 pb-3 ${sel ? "border-accent" : "border-transparent"}`}
                  >
                    <p
                      className={`text-[13px] font-medium ${sel ? "text-ink" : "text-ink-muted"}`}
                    >
                      {t.short}
                    </p>
                    <p
                      className={`mt-0.5 text-[16px] font-semibold tracking-[-0.01em] tabular ${sel ? "text-ink" : "text-ink-secondary"}`}
                    >
                      {t.full(t.value)}
                    </p>
                  </div>
                );
              })}
            </div>
            <ul className="flex gap-5 pb-3 text-xs text-ink-muted">
              <li className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded-full bg-accent" />
                This period
              </li>
              <li className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded-full bg-chart-muted" />
                Previous 14 days
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-4 border-t border-dashed border-ink-muted" />
                Target
              </li>
            </ul>
          </div>

          <div className="relative mt-8 mr-16 ml-12 h-[320px]">
            {g.ticks.map((t) => (
              <div key={t.v} className="absolute inset-x-0" style={{ top: `${t.top}%` }}>
                <div className={`h-px ${t.v === 0 ? "bg-border-strong" : "bg-chart-grid"}`} />
                <span className="absolute top-0 right-full mr-4 -translate-y-1/2 text-[12px] text-ink-faint tabular">
                  {r.tick(t.v)}
                </span>
              </div>
            ))}
            {g.targetTop !== null ? (
              <div
                className="absolute inset-x-0 border-t border-dashed border-ink-muted"
                style={{ top: `${g.targetTop}%` }}
              >
                <span className="absolute -top-6 left-0 text-[12px] font-medium text-ink-secondary">
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
                stroke="#b4bfce"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
              />
              <path d={g.cur.area} fill="#2563eb" fillOpacity={0.05} />
              <path
                d={g.cur.line}
                fill="none"
                stroke="#2563eb"
                strokeWidth={2.5}
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
              />
            </svg>
            <div
              className="absolute inset-y-0 w-px bg-ink/15"
              style={{ left: `${g.cur.pts[i].x}%` }}
            />
            <span
              className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-[3px] ring-white"
              style={{ left: `${g.cur.pts[i].x}%`, top: `${g.cur.pts[i].y}%` }}
            />
            <span
              className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-muted ring-2 ring-white"
              style={{ left: `${g.pre.pts[i].x}%`, top: `${g.pre.pts[i].y}%` }}
            />
            <div
              className="absolute z-10 w-[200px] -translate-x-1/2 rounded-md border border-border bg-white p-3 text-xs shadow-md"
              style={{ left: `${g.cur.pts[i].x}%`, top: `${g.cur.pts[i].y + 8}%` }}
            >
              <p className="font-medium text-ink-muted">{r.dates[i]}</p>
              <p className="mt-1 text-[20px] leading-6 font-semibold tracking-[-0.02em] text-ink tabular">
                {r.full(r.cur[i])}
              </p>
              <p className="mt-0.5 text-ink-muted tabular">
                {r.full(r.pre[i])} on {r.preDates[i]}
              </p>
            </div>
            <span
              className="absolute -translate-y-1/2 text-[14px] font-semibold text-ink tabular"
              style={{
                left: "calc(100% + 16px)",
                top: `${g.cur.pts[g.cur.pts.length - 1].y}%`,
              }}
            >
              {r.full(r.cur[r.cur.length - 1])}
            </span>
          </div>
          <div className="relative mt-3 mr-16 ml-12 h-4 text-[12px] text-ink-faint tabular">
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
        </section>

        <section className="mt-12 grid grid-cols-2 gap-x-16 border-t border-border pt-8">
          <div>
            <div className="flex items-baseline justify-between">
              <h2 className="text-[18px] font-semibold tracking-[-0.015em] text-ink">
                Top campaigns
              </h2>
              <span className="text-[13px] font-medium text-accent">
                View all {m.campaigns.length}
              </span>
            </div>
            <ul className="mt-3 divide-y divide-border">
              {top.map((x) => (
                <li key={x.id} className="flex items-center gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-ink">{x.name}</p>
                    <div className="mt-1.5 h-[3px] rounded-full bg-surface-active">
                      <div
                        className="h-full rounded-full bg-ink-secondary"
                        style={{ width: `${(x.spend / maxSpend) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-24 text-right">
                    <p className="text-[14px] font-semibold text-ink tabular">
                      {m.fmtMoney(x.spend)}
                    </p>
                    <p className="text-xs text-ink-muted tabular">
                      {x.roas === null ? "—" : `${x.roas.toFixed(2)}x ROAS`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <h2 className="text-[18px] font-semibold tracking-[-0.015em] text-ink">
                What changed
              </h2>
              <span className="text-xs text-ink-muted">vs {m.prevLabel}</span>
            </div>
            <ul className="mt-3 divide-y divide-border">
              {m.movers.map((x) => (
                <li key={x.id} className="flex items-center gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-ink">{x.name}</p>
                    <p className="mt-0.5 text-xs text-ink-muted tabular">
                      {x.measure} · {x.text}
                    </p>
                  </div>
                  <p
                    className={`w-24 text-right text-[18px] font-semibold tracking-[-0.02em] tabular ${tone(x.change, x.measure === "Spend" ? null : true)}`}
                  >
                    {x.deltaText}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <p className="mt-9 text-xs text-ink-muted tabular">
          {m.structure.campaigns.total} campaigns ({m.structure.campaigns.active} active) ·{" "}
          {m.structure.adSets} ad sets · {m.structure.ads} ads · {m.structure.creatives}{" "}
          creatives · {m.coverage?.days} days of data
        </p>
      </main>
    </div>
  );
}
