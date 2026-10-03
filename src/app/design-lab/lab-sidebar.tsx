import {
  Building2,
  ChevronsUpDown,
  Images,
  LayoutDashboard,
  Lightbulb,
  Megaphone,
  MessageCircleQuestion,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { LabModel } from "./data";

const NAV: Array<{ group: string; items: Array<[string, LucideIcon]> }> = [
  {
    group: "Analyse",
    items: [
      ["Overview", LayoutDashboard],
      ["Campaigns", Megaphone],
      ["Creatives", Images],
      ["Insights", Lightbulb],
      ["Ask Analyst", MessageCircleQuestion],
    ],
  },
  {
    group: "Workspace",
    items: [
      ["Clients", Building2],
      ["Settings", Settings],
    ],
  },
];

type Tone = "grey" | "white" | "blue";

const ROOT: Record<Tone, string> = {
  grey: "bg-canvas border-r border-border",
  white: "bg-white border-r border-border",
  blue: "bg-[#e9effb] border-r border-[#d3dff5]",
};

const ACTIVE: Record<Tone, string> = {
  grey: "bg-white text-ink before:absolute before:top-2 before:bottom-2 before:left-0 before:w-0.5 before:rounded-full before:bg-accent",
  white: "bg-surface-hover text-ink",
  blue: "bg-white text-accent-strong border border-[#d3dff5]",
};

/** Static sidebar for the lab screens; each concept picks a tone. */
export function LabSidebar({ tone, m }: { tone: Tone; m: LabModel }) {
  return (
    <aside className={`flex w-60 shrink-0 flex-col ${ROOT[tone]}`}>
      <div className="px-4 pt-5">
        <div className="flex items-center gap-2.5 px-1">
          <svg aria-hidden width="20" height="20" viewBox="0 0 20 20">
            <path d="M2 17.5h16" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
            <path
              d="M3 12.5 7.5 8.5l3.5 2.5L16 4.5"
              fill="none"
              stroke="#2563eb"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="16" cy="4.5" r="2.5" fill="#2563eb" />
          </svg>
          <div className="leading-tight">
            <p className="text-[14px] font-semibold tracking-[-0.01em] text-ink">Ad Analyst</p>
            <p className="text-xs text-ink-muted">{m.agency}</p>
          </div>
        </div>
        <button
          type="button"
          className="mt-4 flex h-11 w-full items-center gap-2.5 rounded-md px-1.5 text-left hover:bg-black/5"
        >
          <span className="flex size-6 items-center justify-center rounded-md bg-ink text-[11px] font-semibold text-white">
            LS
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[14px] font-medium text-ink">
              {m.client.name}
            </span>
            <span className="block text-xs text-ink-muted">Ecommerce · {m.currency}</span>
          </span>
          <ChevronsUpDown aria-hidden size={14} className="text-ink-faint" />
        </button>
      </div>
      <nav className="flex-1 px-3 pt-4">
        {NAV.map((g, gi) => (
          <div key={g.group} className={gi > 0 ? "mt-6" : ""}>
            <p className="mb-1.5 px-2.5 text-xs font-medium text-ink-faint">{g.group}</p>
            <ul className="flex flex-col gap-0.5">
              {g.items.map(([label, Icon]) => {
                const active = label === "Overview";
                return (
                  <li key={label}>
                    <span
                      className={`relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium ${
                        active ? ACTIVE[tone] : "text-ink-secondary"
                      }`}
                    >
                      <Icon
                        aria-hidden
                        size={16}
                        strokeWidth={active ? 2 : 1.5}
                        className={active ? "text-ink" : "text-ink-muted"}
                      />
                      {label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-black/5 px-5 py-3 text-xs">
        <p className="flex items-center gap-1.5 font-medium text-ink-secondary">
          <span aria-hidden className="size-1.5 rounded-full bg-positive" />
          Meta Ads · demo dataset
        </p>
        <p className="mt-0.5 text-ink-muted">
          {m.coverage?.days ?? 0} days to {m.curShort.split(" – ")[1]}
        </p>
      </div>
    </aside>
  );
}
