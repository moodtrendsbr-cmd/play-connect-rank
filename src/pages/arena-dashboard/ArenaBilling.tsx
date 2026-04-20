import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Receipt, RefreshCw, Check } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-muted text-muted-foreground" },
  paid: { label: "Pago", className: "bg-primary/20 text-primary" },
  overdue: { label: "Vencido", className: "bg-destructive/20 text-destructive" },
  canceled: { label: "Cancelado", className: "bg-muted text-muted-foreground" },
};

const ArenaBilling = () => {
  const { arena } = useOutletContext<{ arena: any }>();
  const [cycles, setCycles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [payOpen, setPayOpen] = useState(false);
  const [activeCycle, setActiveCycle] = useState<any>(null);
  const [method, setMethod] = useState("manual");
  const [reference, setReference] = useState("");

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("arena_billing_cycles")
      .select("*, arena_student_subscriptions(arena_students(full_name), arena_membership_plans(name))")
      .eq("arena_id", arena.id)
      .order("due_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setCycles(data || []);
    setLoading(false);
  };

  useEffect(() => { if (arena) load(); }, [arena, filter]);

  const refreshOverdue = async () => {
    const { error } = await supabase.rpc("arena_mark_overdue_cycles", { _arena_id: arena.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Cobranças vencidas atualizadas"); load();
  };

  const openPay = (c: any) => { setActiveCycle(c); setMethod("manual"); setReference(""); setPayOpen(true); };

  const confirmPay = async () => {
    const { error } = await supabase.rpc("arena_mark_cycle_paid", {
      _cycle_id: activeCycle.id, _payment_method: method, _payment_reference: reference || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Cobrança marcada como paga"); setPayOpen(false); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-foreground">Cobranças</h1>
          <p className="text-sm text-muted-foreground">Ciclos de mensalidades</p>
        </div>
        <Button size="sm" variant="outline" onClick={refreshOverdue} className="gap-2"><RefreshCw className="h-4 w-4" /> Vencidos</Button>
      </div>

      <Select value={filter} onValueChange={setFilter}>
        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="pending">Pendentes</SelectItem>
          <SelectItem value="overdue">Vencidos</SelectItem>
          <SelectItem value="paid">Pagos</SelectItem>
          <SelectItem value="canceled">Cancelados</SelectItem>
        </SelectContent>
      </Select>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : cycles.length === 0 ? (
        <Card className="bg-card border-border"><CardContent className="p-8 text-center">
          <Receipt className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma cobrança encontrada.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {cycles.map((c) => {
            const badge = STATUS_BADGE[c.status] || STATUS_BADGE.pending;
            const sub = c.arena_student_subscriptions;
            return (
              <Card key={c.id} className="bg-card border-border">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground text-sm">{sub?.arena_students?.full_name} — {sub?.arena_membership_plans?.name}</p>
                    <p className="text-xs text-muted-foreground">Vence {format(new Date(c.due_at), "dd/MM/yyyy")} • R$ {Number(c.amount).toFixed(2)}</p>
                    {c.paid_at && <p className="text-xs text-muted-foreground">Pago em {format(new Date(c.paid_at), "dd/MM/yyyy")}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.className}`}>{badge.label}</span>
                    {c.status !== "paid" && c.status !== "canceled" && (
                      <Button size="sm" variant="outline" onClick={() => openPay(c)} className="gap-1 h-7 text-xs"><Check className="h-3 w-3" /> Pagar</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Marcar como pago</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Método</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                  <SelectItem value="card">Cartão</SelectItem>
                  <SelectItem value="transfer">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Referência (opcional)</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Comprovante, ID, etc" /></div>
            <Button onClick={confirmPay} className="w-full">Confirmar pagamento</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ArenaBilling;
