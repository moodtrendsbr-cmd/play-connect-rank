import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, RefreshCw, Pause, Play, X, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: { label: "Ativa", className: "bg-primary/20 text-primary" },
  paused: { label: "Pausada", className: "bg-muted text-muted-foreground" },
  canceled: { label: "Cancelada", className: "bg-destructive/20 text-destructive" },
  past_due: { label: "Inadimplente", className: "bg-amber-500/20 text-amber-400" },
};

const ArenaSubscriptions = () => {
  const { arena } = useOutletContext<{ arena: any }>();
  const [subs, setSubs] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [planId, setPlanId] = useState("");

  const load = async () => {
    setLoading(true);
    const [subsRes, stRes, plRes] = await Promise.all([
      supabase.from("arena_student_subscriptions").select("*, arena_students(full_name), arena_membership_plans(name, billing_frequency, amount)").eq("arena_id", arena.id).order("created_at", { ascending: false }),
      supabase.from("arena_students").select("id, full_name").eq("arena_id", arena.id).eq("status", "active").order("full_name"),
      supabase.from("arena_membership_plans").select("id, name, billing_frequency, amount").eq("arena_id", arena.id).eq("is_active", true).order("name"),
    ]);
    setSubs(subsRes.data || []);
    setStudents(stRes.data || []);
    setPlans(plRes.data || []);
    setLoading(false);
  };

  useEffect(() => { if (arena) load(); }, [arena]);

  const create = async () => {
    if (!studentId || !planId) { toast.error("Selecione aluno e plano"); return; }
    const { error } = await supabase.from("arena_student_subscriptions").insert({
      arena_id: arena.id, student_id: studentId, plan_id: planId, status: "active",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Assinatura criada");
    setOpen(false); setStudentId(""); setPlanId(""); load();
  };

  const updateStatus = async (id: string, status: string) => {
    const patch: any = { status };
    if (status === "canceled") patch.canceled_at = new Date().toISOString();
    const { error } = await supabase.from("arena_student_subscriptions").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Assinatura atualizada"); load();
  };

  const generateCycle = async (id: string) => {
    const { error } = await supabase.rpc("arena_generate_billing_cycle", { _subscription_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success("Próximo ciclo gerado"); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-foreground">Assinaturas</h1>
          <p className="text-sm text-muted-foreground">Alunos vinculados a planos</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Nova</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova assinatura</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Aluno</Label>
                <Select value={studentId} onValueChange={setStudentId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{students.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Plano</Label>
                <Select value={planId} onValueChange={setPlanId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} — R$ {Number(p.amount).toFixed(2)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button onClick={create} className="w-full">Criar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : subs.length === 0 ? (
        <Card className="bg-card border-border"><CardContent className="p-8 text-center">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma assinatura ativa.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {subs.map((s) => {
            const badge = STATUS_BADGE[s.status] || STATUS_BADGE.active;
            return (
              <Card key={s.id} className="bg-card border-border">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-foreground">{s.arena_students?.full_name}</p>
                      <p className="text-xs text-muted-foreground">{s.arena_membership_plans?.name} • R$ {Number(s.arena_membership_plans?.amount || 0).toFixed(2)}</p>
                      {s.next_due_at && <p className="text-xs text-muted-foreground">Próx. vencimento: {format(new Date(s.next_due_at), "dd/MM/yyyy")}</p>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.className}`}>{badge.label}</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => generateCycle(s.id)} className="gap-1 h-7 text-xs"><RefreshCw className="h-3 w-3" /> Gerar ciclo</Button>
                    {s.status === "active" && <Button size="sm" variant="outline" onClick={() => updateStatus(s.id, "paused")} className="gap-1 h-7 text-xs"><Pause className="h-3 w-3" /> Pausar</Button>}
                    {s.status === "paused" && <Button size="sm" variant="outline" onClick={() => updateStatus(s.id, "active")} className="gap-1 h-7 text-xs"><Play className="h-3 w-3" /> Reativar</Button>}
                    {s.status !== "canceled" && <Button size="sm" variant="outline" onClick={() => updateStatus(s.id, "canceled")} className="gap-1 h-7 text-xs text-destructive"><X className="h-3 w-3" /> Cancelar</Button>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ArenaSubscriptions;
