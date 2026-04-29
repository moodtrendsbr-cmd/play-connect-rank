import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RevenueKpis } from "@/hooks/useRevenueKpis";

export function ConversionRateCard({ data, loading }: { data: RevenueKpis | null; loading?: boolean }) {
  const sent = Number(data?.messages_sent ?? 0);
  const conv = Number(data?.conversions ?? 0);
  const rate = sent > 0 ? (conv / sent) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">Conversão WhatsApp</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="h-10 animate-pulse rounded bg-muted" />
        ) : (
          <>
            <div className="text-3xl font-bold tracking-tight">
              <span className="text-[#2BFF88]">{rate.toFixed(1)}%</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {conv} conversões / {sent} mensagens enviadas
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
