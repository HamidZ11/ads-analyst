import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Eye,
  MousePointer2,
  MousePointerClick,
  ShoppingBag,
  Target,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { KpiTile } from "@/components/ui/kpi-tile";
import { formatCurrency, formatMetric, formatMultiple } from "@/domain/format";
import { conversionVocabulary, primaryMetricKeys } from "@/domain/labels";
import { METRIC_DEFINITIONS } from "@/domain/metrics";
import { rangeLength } from "@/domain/periods";
import type { Client, MetricKey } from "@/domain/types";
import { getKpiReadings, type ClientPeriodSummary } from "@/features/analytics/queries";
import type { Workspace } from "@/features/workspace/server";

function kpiLabel(key: MetricKey, client: Client): string {
  const vocab = conversionVocabulary(client.type);
  if (key === "conversions") return vocab.plural;
  if (key === "cpa") return vocab.costLabel;
  return METRIC_DEFINITIONS[key].label;
}

function kpiValue(key: MetricKey, value: number | null, client: Client): string {
  if (key === "spend" || key === "revenue")
    return formatCurrency(value, client.currency, { compact: true });
  if (key === "conversions")
    return formatMetric(key, value, client.currency, { compact: true });
  return formatMetric(key, value, client.currency);
}

function kpiIcon(key: MetricKey, client: Client): LucideIcon {
  switch (key) {
    case "spend":
      return Wallet;
    case "revenue":
      return Banknote;
    case "conversions":
      return client.type === "ecommerce"
        ? ShoppingBag
        : client.type === "saas"
          ? UserPlus
          : Users;
    case "cpa":
      return Target;
    case "roas":
      return TrendingUp;
    case "ctr":
      return MousePointerClick;
    case "cpc":
      return MousePointer2;
    case "cpm":
    case "impressions":
      return Eye;
    default:
      return TrendingUp;
  }
}

function kpiHint(key: MetricKey, client: Client): string | undefined {
  if (key === "cpa") return `Target ${formatCurrency(client.targetCpa, client.currency)}`;
  if (key === "roas" && client.targetRoas !== null)
    return `Target ${formatMultiple(client.targetRoas, 1)}`;
  return undefined;
}

export function OverviewKpis({
  workspace,
  summary,
}: {
  workspace: Workspace;
  summary: ClientPeriodSummary;
}) {
  const { client, periods, comparison } = workspace;
  const readings = getKpiReadings(summary, primaryMetricKeys(client));
  const splitIndex = rangeLength(periods.previous);

  return (
    <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {readings.map((reading) => (
        <KpiTile
          key={reading.key}
          label={kpiLabel(reading.key, client)}
          value={kpiValue(reading.key, reading.current, client)}
          change={reading.change}
          higherIsBetter={METRIC_DEFINITIONS[reading.key].higherIsBetter}
          comparison={comparison}
          series={reading.series}
          splitIndex={splitIndex}
          hint={kpiHint(reading.key, client)}
          icon={kpiIcon(reading.key, client)}
        />
      ))}
    </section>
  );
}
