import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Tag, Pencil } from "lucide-react";
import { toast } from "sonner";

const FREQ_LABELS: Record<string, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  yearly: "Anual",
  one_time: "Avulso",
};

const ArenaPlans = () => {
  const { arena } = useOutletContext<{ arena: any }>();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", description: "", billing_frequency: "monthly", amount: "0", is_active: true });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("arena_membership_plans").select("*").eq("arena_id", arena.id).order("created_at", { ascending: false });
    setPlans(data || []);
    setLoading(false);
  };

  useEffect(() => { if (arena) load(); }, [arena]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", description: "", billing_frequency: "monthly", amount: "0", is_active: true });
    setOpen(true);
  };

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({ name: p.name, description: p.description || "", billing_frequency: p.billing_frequency, amount: String(p.amount), is_active: p.is_active });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Nome obrigatório"); return; }
    const payload = {
      arena_id: arena.id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      billing_frequency: form.billing_frequency,
      amount: Number(form.amount) || 0,
      is_active: form.is_active,
    };
    const { error } = editing
      ? await supabase.from("arena_membership_plans").update(payload).eq("id", editing.id)
      : await supabase.from("arena_membership_plans").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Plano atualizado" : "Plano criado");
    setOpen(false);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-foreground">Planos</h1>
          <p className="text-sm text-muted-foreground">Catálogo de mensalidades e pacotes</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} size="sm" className="gap-2"><Plus className="h-4 w-4" /> Novo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar plano" : "Novo plano"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Frequência</Label>
                  <Select value={form.billing_frequency} onValueChange={(v) => setForm({ ...form, billing_frequency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(FREQ_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Ativo</Label>
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              </div>
              <Button onClick={save} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : plans.length === 0 ? (
        <Card className="bg-card border-border"><CardContent className="p-8 text-center">
          <Tag className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum plano criado. Comece criando uma mensalidade.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {plans.map((p) => (
            <Card key={p.id} className="bg-card border-border">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{p.name}</p>
                    {!p.is_active && <Badge variant="outline" className="text-xs">Inativo</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{FREQ_LABELS[p.billing_frequency]} • R$ {Number(p.amount).toFixed(2)}</p>
                  {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                </div>
                <Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ArenaPlans;
