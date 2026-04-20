import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Wallet, Clock } from "lucide-react";

const OrganizerFinance = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [stats, setStats] = useState({ total: 0, settled: 0, pending: 0 });
  const [byTournament, setByTournament] = useState<any[]>([]);
  const [splits, setSplits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // Fonte canônica: view derivada de transaction_splits
      const { data: balance } = await supabase
        .from("v_organizer_balances_canonical" as any)
        .select("*")
        .eq("organizer_id", user.id)
        .maybeSingle();

      // Detalhe e agregação por torneio: ainda lê splits diretos
      const { data: mySplits } = await supabase
        .from("transaction_splits")
        .select("*, financial_transactions(source_type, source_id, total_amount, paid_at, status, refunded_amount)")
        .eq("recipient_type", "organizer")
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);

      const list = mySplits || [];
      const b: any = balance || {};
      const total = Number(b.gross_total || 0);
      const settled = Number(b.settled_total || 0);
      const pending = Number(b.pending_total || 0);

      // Per tournament aggregation (only enrollment-source splits)
      const enrollmentSplits = list.filter(
        (s: any) => s.financial_transactions?.source_type === "enrollment"
      );
      const enrIds = enrollmentSplits.map((s: any) => s.financial_transactions.source_id);
      let tournamentMap: Record<string, { name: string; revenue: number }> = {};
      if (enrIds.length > 0) {
        const { data: enrolls } = await supabase
          .from("enrollments")
          .select("id, tournament_id, tournaments(name)")
          .in("id", enrIds);
        const enrToTournament: Record<string, any> = {};
        (enrolls || []).forEach((e: any) => { enrToTournament[e.id] = e; });

        enrollmentSplits.forEach((s: any) => {
          const enr = enrToTournament[s.financial_transactions.source_id];
          if (!enr) return;
          const tid = enr.tournament_id;
          if (!tournamentMap[tid]) {
            tournamentMap[tid] = { name: enr.tournaments?.name || "Torneio", revenue: 0 };
          }
          tournamentMap[tid].revenue += Number(s.amount);
        });
      }

      setStats({ total, settled, pending });
      setByTournament(Object.values(tournamentMap).sort((a, b) => b.revenue - a.revenue));
      setSplits(list.slice(0, 30));
      setLoading(false);
    };
    load();
  }, [user, tenant]);

  if (loading) return <p className="text-muted-foreground p-6">Carregando...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <DollarSign className="h-6 w-6" /> Financeiro do Organizador
        </h1>
        <p className="text-sm text-muted-foreground">Receita dos seus torneios e splits a receber. <span className="text-xs">(fonte canônica: <code>v_organizer_balances_canonical</code>)</span></p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Total</p>
            <p className="text-2xl font-bold mt-1">R$ {stats.total.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="h-3 w-3" /> Liquidado</p>
            <p className="text-2xl font-bold mt-1 text-primary">R$ {stats.settled.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> A receber</p>
            <p className="text-2xl font-bold mt-1 text-secondary">R$ {stats.pending.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Receita por Torneio</CardTitle></CardHeader>
        <CardContent>
          {byTournament.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem inscrições pagas ainda.</p>
          ) : (
            <div className="space-y-2">
              {byTournament.map((t, i) => (
                <div key={i} className="flex justify-between text-sm border-b border-border pb-2 last:border-0">
                  <span className="text-muted-foreground truncate">{t.name}</span>
                  <span className="font-medium">R$ {t.revenue.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Últimos Splits</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {splits.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem splits.</p>
          ) : splits.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
              <div className="text-xs">
                <Badge variant={s.status === "settled" ? "default" : "secondary"} className="mr-2">{s.status}</Badge>
                <span className="text-muted-foreground">{s.financial_transactions?.source_type}</span>
              </div>
              <span className="font-medium text-sm">R$ {Number(s.amount).toFixed(2)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default OrganizerFinance;
