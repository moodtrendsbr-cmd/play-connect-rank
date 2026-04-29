import { useRevenueKpis, type RevenueKpisScope } from "@/hooks/useRevenueKpis";
import { RevenueCard } from "./RevenueCard";
import { ConversionRateCard } from "./ConversionRateCard";
import { MessagePerformanceCard } from "./MessagePerformanceCard";

/**
 * Phase 13 — Conversational Revenue Engine panel.
 * Renders KPIs + per-trigger-type performance for the given scope.
 */
export function RevenueDashboardPanel({
  scope, days = 30, showPerformance = true,
}: { scope: RevenueKpisScope; days?: number; showPerformance?: boolean }) {
  const { data, perf, loading } = useRevenueKpis(scope, days);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RevenueCard data={data} loading={loading} days={days} />
        {scope.type !== "company" && <ConversionRateCard data={data} loading={loading} />}
      </div>
      {showPerformance && scope.type !== "company" && (
        <MessagePerformanceCard rows={perf} loading={loading} />
      )}
    </div>
  );
}
