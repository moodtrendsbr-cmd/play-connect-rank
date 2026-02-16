import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2 } from "lucide-react";

const AdminPlans = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editPlan, setEditPlan] = useState<any>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({
    name: "", display_name: "", price: "0", max_tournaments: "1",
    description: "", feed_visibility: false, signup_visibility: false,
    tournament_visibility: true, physical_banner_allowed: false, active: true,
  });

  const fetchPlans = async () => {
    setLoading(true);
    const { data } = await supabase.from("tournament_sponsor_plans").select("*").order("price");
    setPlans(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchPlans(); }, []);

  const openCreate = () => {
    setEditPlan(null);
    setForm({
      name: "", display_name: "", price: "0", max_tournaments: "1",
      description: "", feed_visibility: false, signup_visibility: false,
      tournament_visibility: true, physical_banner_allowed: false, active: true,
    });
    setShowDialog(true);
  };

  const openEdit = (plan: any) => {
    setEditPlan(plan);
    setForm({
      name: plan.name, display_name: plan.display_name, price: String(plan.price),
      max_tournaments: String(plan.max_tournaments), description: plan.description || "",
      feed_visibility: plan.feed_visibility, signup_visibility: plan.signup_visibility,
      tournament_visibility: plan.tournament_visibility, physical_banner_allowed: plan.physical_banner_allowed,
      active: plan.active,
    });
    setShowDialog(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name, display_name: form.display_name,
      price: Number(form.price), max_tournaments: Number(form.max_tournaments),
      description: form.description || null,
      feed_visibility: form.feed_visibility, signup_visibility: form.signup_visibility,
      tournament_visibility: form.tournament_visibility,
      physical_banner_allowed: form.physical_banner_allowed, active: form.active,
    };

    if (editPlan) {
      const { error } = await supabase.from("tournament_sponsor_plans").update(payload).eq("id", editPlan.id);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else toast({ title: "Pacote atualizado!" });
    } else {
      const { error } = await supabase.from("tournament_sponsor_plans").insert(payload);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else toast({ title: "Pacote criado!" });
    }
    setShowDialog(false);
    fetchPlans();
  };

  const deletePlan = async (id: string) => {
    await supabase.from("tournament_sponsor_plans").delete().eq("id", id);
    fetchPlans();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-4xl font-display text-foreground">PLANOS DE PATROCÍNIO</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Novo pacote</Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <Card key={plan.id}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-foreground">{plan.display_name}</p>
                    {!plan.active && <Badge variant="destructive" className="text-xs">Inativo</Badge>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(plan)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deletePlan(plan.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <p className="text-2xl font-bold text-primary">R$ {Number(plan.price).toFixed(0)}</p>
                {plan.description && <p className="text-xs text-muted-foreground">{plan.description}</p>}

                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>Máx. torneios: <strong className="text-foreground">{plan.max_tournaments}</strong></p>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant={plan.tournament_visibility ? "default" : "outline"} className="text-xs">Torneio</Badge>
                  <Badge variant={plan.signup_visibility ? "default" : "outline"} className="text-xs">Inscrição</Badge>
                  <Badge variant={plan.feed_visibility ? "default" : "outline"} className="text-xs">Feed</Badge>
                  <Badge variant={plan.physical_banner_allowed ? "default" : "outline"} className="text-xs">Banner</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editPlan ? "Editar Pacote" : "Novo Pacote"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>ID interno</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="basic" /></div>
              <div><Label>Nome exibido</Label><Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="Basic" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Preço (R$)</Label><Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
              <div><Label>Máx. torneios</Label><Input type="number" value={form.max_tournaments} onChange={(e) => setForm({ ...form, max_tournaments: e.target.value })} /></div>
            </div>
            <div><Label>Descrição</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2"><Switch checked={form.tournament_visibility} onCheckedChange={(v) => setForm({ ...form, tournament_visibility: v })} /><Label>Página torneio</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.signup_visibility} onCheckedChange={(v) => setForm({ ...form, signup_visibility: v })} /><Label>Tela inscrição</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.feed_visibility} onCheckedChange={(v) => setForm({ ...form, feed_visibility: v })} /><Label>Feed local</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.physical_banner_allowed} onCheckedChange={(v) => setForm({ ...form, physical_banner_allowed: v })} /><Label>Banner físico</Label></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /><Label>Ativo</Label></div>
            <Button type="submit" className="w-full">Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPlans;
