import { CreativeThumbnail } from "@/components/ui/creative-thumbnail";
import { Delta } from "@/components/ui/delta";
import { PageHeader } from "@/components/ui/page-header";
import { formatCurrency, formatDateRange } from "@/domain/format";
import type {
  CreativeThumbnail as ThumbnailRef,
  CreativeType,
  CurrencyCode,
} from "@/domain/types";
import { cn } from "@/lib/cn";
import { StaticPresets } from "../campaigns-lab/lab-frame";
import type { CreativesLab } from "./data";

export const MATERIALITY = 0.05;

/** Artwork in a fixed box so rows and entries keep one rhythm regardless of the asset's aspect. */
export function Artwork({
  thumbnail,
  type,
  width,
  height,
  className,
}: {
  thumbnail: ThumbnailRef;
  type: CreativeType;
  width: number;
  height: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border/60 bg-surface-subtle",
        className,
      )}
      style={{ width, height }}
    >
      <span className="block" style={{ width }}>
        <CreativeThumbnail
          thumbnail={thumbnail}
          type={type}
          frame="square"
          size={width >= 96 ? "lg" : "sm"}
          className="rounded-none"
        />
      </span>
    </span>
  );
}

export function Change({
  change,
  higherIsBetter,
  className,
}: {
  change: number | null;
  higherIsBetter: boolean | null;
  className?: string;
}) {
  return (
    <Delta
      change={change}
      higherIsBetter={higherIsBetter}
      neutralBelow={MATERIALITY}
      className={className}
    />
  );
}

/** "£110.83 over target" / "£6.24 under target", in the client's currency. */
export function TargetLine({
  cpa,
  target,
  currency,
  className,
}: {
  cpa: number | null;
  target: number;
  currency: CurrencyCode;
  className?: string;
}) {
  if (target <= 0 || cpa === null) return null;
  const diff = cpa - target;
  if (Math.abs(diff) < 0.005)
    return <p className={cn("text-xs font-medium text-ink-muted", className)}>On target</p>;
  return (
    <p
      className={cn(
        "text-xs font-medium",
        diff > 0 ? "text-negative" : "text-positive",
        className,
      )}
    >
      {formatCurrency(Math.abs(diff), currency, { decimals: 2 })} {diff > 0 ? "over" : "under"}{" "}
      target
    </p>
  );
}

export function LabHeader({ lab }: { lab: CreativesLab }) {
  const { workspace, client, rows, campaignCount, comparison } = lab;
  return (
    <PageHeader
      title="Creatives"
      description={`${client.name} · ${rows.length} creatives across ${campaignCount} campaigns`}
      actions={
        <>
          <span className="text-xs text-ink-muted md:text-right">
            <span className="block font-medium text-ink-secondary">
              {formatDateRange(workspace.periods.current)}
            </span>
            <span className="mt-0.5 block">vs {comparison}</span>
          </span>
          <StaticPresets selected={workspace.preset} />
        </>
      }
    />
  );
}

/** Underline type tabs with counts, in the Campaigns toolbar idiom (static in the lab). */
export function TypeTabs({
  lab,
  selected = "all",
}: {
  lab: CreativesLab;
  selected?: "all" | CreativeType;
}) {
  const tabs = [
    { value: "all", label: "All", count: lab.rows.length },
    ...lab.types.map((t) => ({ value: t.type, label: t.label, count: t.count })),
  ];
  return (
    <div role="group" aria-label="Filter by type" className="flex gap-6">
      {tabs.map((tab) => (
        <span
          key={tab.value}
          aria-pressed={tab.value === selected}
          className={cn(
            "-mb-px flex h-9 items-center gap-1.5 border-b-2 text-sm font-medium",
            tab.value === selected
              ? "border-accent text-ink"
              : "border-transparent text-ink-muted",
          )}
        >
          {tab.label}
          <span className="text-xs text-ink-faint tabular">{tab.count}</span>
        </span>
      ))}
    </div>
  );
}

export function meta(
  c: { type: CreativeType; adCount: number; campaignCount: number },
  label: string,
) {
  return `${label} · ${c.adCount} ${c.adCount === 1 ? "ad" : "ads"} · ${c.campaignCount} ${c.campaignCount === 1 ? "campaign" : "campaigns"}`;
}
