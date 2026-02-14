import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { AlertCircle } from "lucide-react";

const MOOD_COMMISSION_PERCENT = 10;

const ManageTournament = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [tournament, setTournament] = useState<any>(null);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [hasMpAccount, setHasMpAccount] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data: t } = await supabase.from("tournaments").select("*").eq("id", id).single();
      setTournament(t);

      const { data: e } = await supabase
        .from("enrollments")
        .select("*, profiles:user_id(full_name, whatsapp)")
        .eq("tournament_id", id!);
      setEnrollments(e || []);

      // Check if organizer has MP account
      if (t) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("mp_collector_id")
          .eq("user_id", t.organizer_id)
          .single();
        setHasMpAccount(!!(profile as any)?.mp_collector_id);
      }
    };
    if (id) fetchData();
  }, [id]);

  const paid = enrollments.filter((e) => e.status === "paid");
  const pending = enrollments.filter((e) => e.status === "pending");
  const expired = enrollments.filter((e) => e.status === "expired");

  const sendReminder = (enrollment: any) => {
    toast({ title: "Lembrete enviado", description: `Lembrete enviado para ${enrollment.profiles?.full_name || "atleta"}.` });
  };

  if (!tournament) return <div className="flex min-h-screen items-center justify-center bg-background text-foreground">Carregando...</div>;

  const available = tournament.max_slots - paid.length - pending.length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-16 items-center">
          <Link to="/dashboard" className="text-2xl font-display text-primary text-glow">🏐 MOOD PLAY</Link>
        </div>
      </header>

      <main className="container max-w-3xl py-8">
        <h1 className="mb-2 text-4xl font-display text-foreground">GERENCIAR TORNEIO</h1>
        <p className="text-lg text-muted-foreground mb-8">{tournament.name}</p>

        <div className="mb-8 grid gap-4 grid-cols-2 sm:grid-cols-4">
          <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{tournament.max_slots}</p><p className="text-xs text-muted-foreground">Vagas totais</p></CardContent></Card>
          <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-primary">{paid.length}</p><p className="text-xs text-muted-foreground">Confirmadas</p></CardContent></Card>
          <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-secondary">{pending.length}</p><p className="text-xs text-muted-foreground">Pendentes</p></CardContent></Card>
          <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{available > 0 ? available : 0}</p><p className="text-xs text-muted-foreground">Disponíveis</p></CardContent></Card>
        </div>

        {/* Financial Summary */}
        {tournament.entry_fee > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="font-sans text-base">💰 Resumo Financeiro</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(() => {
                const totalRevenue = paid.length * Number(tournament.entry_fee);
                const commission = Math.round(totalRevenue * MOOD_COMMISSION_PERCENT) / 100;
                const netAmount = totalRevenue - commission;
                return (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total arrecadado ({paid.length} inscrições)</span>
                      <span className="font-medium">R$ {totalRevenue.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Comissão Mood ({MOOD_COMMISSION_PERCENT}%)</span>
                      <span className="text-destructive">- R$ {commission.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t border-border pt-2">
                      <span className="font-medium text-foreground">Valor líquido</span>
                      <span className="font-bold text-primary">R$ {netAmount.toFixed(2)}</span>
                    </div>
                    {!hasMpAccount && (
                      <div className="flex items-start gap-2 rounded-md bg-secondary/10 p-3 text-sm text-secondary mt-2">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        <p>Conta Mercado Pago não vinculada. O valor ficará no seu saldo para saque manual. <Link to="/profile" className="underline font-medium">Vincular conta MP</Link></p>
                      </div>
                    )}
                  </>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* Paid */}
        <h2 className="text-2xl font-display text-foreground mb-4">✅ PAGOS</h2>
        {paid.length === 0 ? <p className="text-muted-foreground mb-6">Nenhum pagamento confirmado.</p> : (
          <div className="space-y-2 mb-8">
            {paid.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <span>{e.profiles?.full_name || "Atleta"}</span>
                <Badge className="bg-primary/20 text-primary">✅ Pago</Badge>
              </div>
            ))}
          </div>
        )}

        {/* Pending */}
        <h2 className="text-2xl font-display text-foreground mb-4">⏳ PENDENTES</h2>
        {pending.length === 0 ? <p className="text-muted-foreground mb-6">Nenhum pendente.</p> : (
          <div className="space-y-2 mb-8">
            {pending.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <span>{e.profiles?.full_name || "Atleta"}</span>
                  <p className="text-xs text-muted-foreground">Vence: {e.expires_at ? new Date(e.expires_at).toLocaleDateString("pt-BR") : "—"}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => sendReminder(e)}>Enviar lembrete</Button>
              </div>
            ))}
          </div>
        )}

        {/* Expired */}
        <h2 className="text-2xl font-display text-foreground mb-4">❌ EXPIRADOS</h2>
        {expired.length === 0 ? <p className="text-muted-foreground mb-6">Nenhum expirado.</p> : (
          <div className="space-y-2 mb-8">
            {expired.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-lg border border-border p-3 opacity-60">
                <span>{e.profiles?.full_name || "Atleta"}</span>
                <Badge variant="destructive">Expirado</Badge>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-4">
          <Button asChild><Link to={`/tournaments/${id}/brackets`}>Gerar Chaves</Link></Button>
          <Button variant="outline" asChild><Link to={`/tournaments/${id}/results`}>Lançar Resultados</Link></Button>
        </div>
      </main>
    </div>
  );
};

export default ManageTournament;
