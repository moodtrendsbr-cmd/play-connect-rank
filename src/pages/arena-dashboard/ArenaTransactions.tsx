import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Receipt, Undo2 } from "lucide-react";
import RefundDialog from "@/components/finance/RefundDialog";

const ArenaTransactions = () => {
  const { arena } = useOutletContext<{ arena: any }>();
  const [txs, setTxs] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [refundTx, setRefundTx] = useState<any | null>(null);

  const load = async () => {
    if (!arena) return;
    setLoading(true);
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

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [arena, filter]);

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
    partially_refunded: "destructive",
    canceled: "outline",
    failed: "outline",
    disputed: "destructive",
  };

  const statusLabel: Record<string, string> = {
    paid: "pago",
    pending: "pendente",
    refunded: "reembolsado",
    partially_refunded: "reemb. parcial",
    canceled: "cancelado",
    failed: "falhou",
    disputed: "disputado",
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
          {txs.map((t) => {
            const refundable = t.status === "paid" || t.status === "partially_refunded";
            const remaining = Number(t.total_amount) - Number(t.refunded_amount || 0);
            return (
              <Card key={t.id}>
                <CardContent className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">{sourceLabel[t.source_type]}</Badge>
                      <Badge variant={statusVariant[t.status]} className="text-xs">{statusLabel[t.status] || t.status}</Badge>
                      {Number(t.refunded_amount) > 0 && (
                        <Badge variant="destructive" className="text-xs">R$ {Number(t.refunded_amount).toFixed(2)} reemb.</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {new Date(t.paid_at || t.created_at).toLocaleString("pt-BR")}
                      {t.payment_reference && ` · ref: ${t.payment_reference.substring(0, 12)}...`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">R$ {Number(t.total_amount).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{t.payment_provider || "—"}</p>
                    </div>
                    {refundable && remaining > 0 && (
                      <Button size="sm" variant="outline" onClick={() => setRefundTx(t)} className="gap-1">
                        <Undo2 className="h-3 w-3" /> Reembolsar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {refundTx && (
        <RefundDialog
          open={!!refundTx}
          onOpenChange={(v) => !v && setRefundTx(null)}
          transactionId={refundTx.id}
          totalAmount={Number(refundTx.total_amount)}
          refundedAmount={Number(refundTx.refunded_amount || 0)}
          onSuccess={load}
        />
      )}
    </div>
  );
};

export default ArenaTransactions;
