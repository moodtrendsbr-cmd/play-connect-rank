import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RevenueKpis } from "@/hooks/useRevenueKpis";

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

export function RevenueCard({ data, loading, days = 30 }: { data: RevenueKpis | null; loading?: boolean; days?: number }) {
  const total = Number(data?.revenue_total ?? 0);
  const orkym = Number(data?.revenue_orkym ?? 0);
  const share = total > 0 ? (orkym / total) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">Receita ({days}d)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="h-10 animate-pulse rounded bg-muted" />
        ) : (
          <>
            <div className="text-3xl font-bold tracking-tight">{fmtBRL(total)}</div>
            <div className="text-sm">
              Via ORKYM: <span className="font-semibold text-[#2BFF88]">{fmtBRL(orkym)}</span>{" "}
              <span className="text-muted-foreground">({share.toFixed(1)}%)</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
