import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollText } from "lucide-react";

const TYPES = ["all", "refund_full", "refund_partial", "cancellation", "manual_credit", "manual_debit", "split_correction"];

const typeLabel: Record<string, string> = {
  refund_full: "Reembolso total",
  refund_partial: "Reembolso parcial",
  cancellation: "Cancelamento",
  manual_credit: "Crédito manual",
  manual_debit: "Débito manual",
  split_correction: "Correção de split",
};

const typeVariant: Record<string, any> = {
  refund_full: "destructive",
  refund_partial: "destructive",
  cancellation: "outline",
  manual_credit: "default",
  manual_debit: "secondary",
  split_correction: "secondary",
};

const AdminAdjustments = () => {
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let query = supabase
        .from("financial_adjustments")
        .select("*, financial_transactions(source_type, total_amount, payment_reference)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (filter !== "all") query = query.eq("adjustment_type", filter);
      const { data } = await query;
      setItems(data || []);
      setLoading(false);
    };
    load();
  }, [filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScrollText className="h-6 w-6" /> Ajustes Financeiros
          </h1>
          <p className="text-sm text-muted-foreground">Trilha de auditoria append-only de reembolsos, cancelamentos e correções.</p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TYPES.map((t) => (
              <SelectItem key={t} value={t}>{t === "all" ? "Todos os tipos" : typeLabel[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum ajuste registrado.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {items.map((a) => (
            <Card key={a.id}>
              <CardContent className="py-3">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={typeVariant[a.adjustment_type]} className="text-xs">{typeLabel[a.adjustment_type]}</Badge>
                    {a.financial_transactions?.source_type && (
                      <Badge variant="outline" className="text-xs">{a.financial_transactions.source_type}</Badge>
                    )}
                  </div>
                  <p className="text-lg font-bold text-primary shrink-0">R$ {Number(a.amount).toFixed(2)}</p>
                </div>
                <p className="text-sm text-foreground mb-1">{a.reason}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleString("pt-BR")}
                  {a.external_reference && ` · ref: ${a.external_reference}`}
                  {` · tx: ${a.transaction_id.substring(0, 8)}...`}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminAdjustments;
