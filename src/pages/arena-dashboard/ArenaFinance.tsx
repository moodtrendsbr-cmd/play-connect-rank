import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Wallet, Clock } from "lucide-react";
import { FinanceTabs } from "@/components/arena/FinanceTabs";

const ArenaFinance = () => {
  const { arena } = useOutletContext<{ arena: any }>();
  const [stats, setStats] = useState({ total: 0, settled: 0, pending: 0, upcoming: 0, count: 0 });
  const [bySource, setBySource] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!arena) return;
    const load = async () => {
      const { data: txs } = await supabase
        .from("financial_transactions")
        .select("id, total_amount, source_type, status")
        .eq("arena_id", arena.id);

      const txList = txs || [];
      const txIds = txList.map((t) => t.id);

      let arenaSplitsTotal = 0;
      let arenaSplitsPending = 0;
      let arenaSplitsSettled = 0;
      let arenaSplitsUpcoming = 0;
      if (txIds.length > 0) {
        const { data: splits } = await supabase
          .from("transaction_splits")
          .select("amount, status, recipient_type, recipient_id, expected_settlement_at")
          .in("transaction_id", txIds)
          .eq("recipient_type", "arena")
          .eq("recipient_id", arena.id);
        const now = Date.now();
        (splits || []).forEach((s: any) => {
          arenaSplitsTotal += Number(s.amount);
          if (s.status === "settled") arenaSplitsSettled += Number(s.amount);
          else if (s.status === "calculated" || s.status === "pending") {
            arenaSplitsPending += Number(s.amount);
            if (s.expected_settlement_at && new Date(s.expected_settlement_at).getTime() <= now + 7 * 86400000) {
              arenaSplitsUpcoming += Number(s.amount);
            }
          }
        });
      }

      const sourceMap: Record<string, number> = {};
      txList.forEach((t: any) => {
        sourceMap[t.source_type] = (sourceMap[t.source_type] || 0) + Number(t.total_amount);
      });

      setStats({
        total: arenaSplitsTotal,
        settled: arenaSplitsSettled,
        pending: arenaSplitsPending,
        upcoming: arenaSplitsUpcoming,
        count: txList.length,
      });
      setBySource(sourceMap);
      setLoading(false);
    };
    load();
  }, [arena]);

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;

  const sourceLabel: Record<string, string> = {
    enrollment: "Inscrições",
    booking: "Reservas",
    arena_billing_cycle: "Mensalidades",
    marketplace_order: "Marketplace",
    sponsorship: "Patrocínios",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <DollarSign className="h-6 w-6" /> Receita
        </h1>
        <p className="text-sm text-muted-foreground">Receita gerada e valores a receber.</p>
      </div>
      <FinanceTabs />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Total Recebido</p>
            <p className="text-2xl font-bold mt-1">R$ {stats.total.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="h-3 w-3" /> Já Liquidado</p>
            <p className="text-2xl font-bold mt-1 text-primary">R$ {stats.settled.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> A Liquidar</p>
            <p className="text-2xl font-bold mt-1 text-secondary">R$ {stats.pending.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Próx. 7 dias</p>
            <p className="text-2xl font-bold mt-1 text-secondary">R$ {stats.upcoming.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Transações</p>
            <p className="text-2xl font-bold mt-1">{stats.count}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Receita por Fonte</CardTitle></CardHeader>
        <CardContent>
          {Object.keys(bySource).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem receita registrada ainda.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(bySource).map(([src, amt]) => (
                <div key={src} className="flex justify-between text-sm border-b border-border pb-2 last:border-0">
                  <span className="text-muted-foreground">{sourceLabel[src] || src}</span>
                  <span className="font-medium">R$ {Number(amt).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ArenaFinance;
