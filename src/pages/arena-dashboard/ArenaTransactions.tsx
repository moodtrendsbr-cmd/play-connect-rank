import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Receipt } from "lucide-react";

const ArenaTransactions = () => {
  const { arena } = useOutletContext<{ arena: any }>();
  const [txs, setTxs] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!arena) return;
    const load = async () => {
      let query = supabase
        .from("financial_transactions")
        .select("*")
        .eq("arena_id", arena.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (filter !== "all") query = query.eq("source_type", filter);
      const { data } = await query;
      setTxs(data || []);
      setLoading(false);
    };
    load();
  }, [arena, filter]);

  const sourceLabel: Record<string, string> = {
    enrollment: "Inscrição",
    booking: "Reserva",
    arena_billing_cycle: "Mensalidade",
    marketplace_order: "Marketplace",
    sponsorship: "Patrocínio",
  };

  const statusVariant: Record<string, any> = {
    paid: "default",
    pending: "secondary",
    refunded: "destructive",
    canceled: "outline",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6" /> Transações
          </h1>
          <p className="text-sm text-muted-foreground">Histórico financeiro da arena.</p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as fontes</SelectItem>
            <SelectItem value="enrollment">Inscrições</SelectItem>
            <SelectItem value="booking">Reservas</SelectItem>
            <SelectItem value="arena_billing_cycle">Mensalidades</SelectItem>
            <SelectItem value="marketplace_order">Marketplace</SelectItem>
            <SelectItem value="sponsorship">Patrocínios</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : txs.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma transação.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {txs.map((t) => (
            <Card key={t.id}>
              <CardContent className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">{sourceLabel[t.source_type]}</Badge>
                    <Badge variant={statusVariant[t.status]} className="text-xs">{t.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {new Date(t.paid_at || t.created_at).toLocaleString("pt-BR")}
                    {t.payment_reference && ` · ref: ${t.payment_reference.substring(0, 12)}...`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-primary">R$ {Number(t.total_amount).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{t.payment_provider || "—"}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ArenaTransactions;
