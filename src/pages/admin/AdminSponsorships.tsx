import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Plus, Edit2, CheckCircle, Pause, Ban, Trash2, Trophy, DollarSign, Store } from "lucide-react";

const AdminSponsorships = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [sponsorships, setSponsorships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editPlan, setEditPlan] = useState<any>(null);
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [planForm, setPlanForm] = useState({
    name: "", display_name: "", price: "0", max_tournaments: "1",
    description: "", feed_visibility: false, signup_visibility: false,
    tournament_visibility: true, physical_banner_allowed: false, active: true,
  });

  const fetchData = async () => {
    setLoading(true);
    const [plansRes, spRes] = await Promise.all([
      supabase.from("tournament_sponsor_plans").select("*").order("price"),
      supabase.from("tournament_sponsorships")
        .select("*, tournaments(name, city, state), companies(name, logo_url), tournament_sponsor_plans(display_name, price)")
        .order("created_at", { ascending: false }),
    ]);
    setPlans(plansRes.data || []);
    setSponsorships(spRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openCreatePlan = () => {
    setEditPlan(null);
    setPlanForm({
      name: "", display_name: "", price: "0", max_tournaments: "1",
      description: "", feed_visibility: false, signup_visibility: false,
      tournament_visibility: true, physical_banner_allowed: false, active: true,
    });
    setShowPlanDialog(true);
  };

  const openEditPlan = (plan: any) => {
    setEditPlan(plan);
    setPlanForm({
      name: plan.name, display_name: plan.display_name, price: String(plan.price),
      max_tournaments: String(plan.max_tournaments), description: plan.description || "",
      feed_visibility: plan.feed_visibility, signup_visibility: plan.signup_visibility,
      tournament_visibility: plan.tournament_visibility, physical_banner_allowed: plan.physical_banner_allowed,
      active: plan.active,
    });
    setShowPlanDialog(true);
  };

  const savePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: planForm.name, display_name: planForm.display_name,
      price: Number(planForm.price), max_tournaments: Number(planForm.max_tournaments),
      description: planForm.description || null,
      feed_visibility: planForm.feed_visibility, signup_visibility: planForm.signup_visibility,
      tournament_visibility: planForm.tournament_visibility,
      physical_banner_allowed: planForm.physical_banner_allowed, active: planForm.active,
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
    setShowPlanDialog(false);
    fetchData();
  };

  const deletePlan = async (id: string) => {
    await supabase.from("tournament_sponsor_plans").delete().eq("id", id);
    fetchData();
  };

  const updateSponsorshipStatus = async (id: string, newStatus: string, sponsorship: any) => {
    const { error } = await supabase.from("tournament_sponsorships").update({ status: newStatus } as any).eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    // Automation on activation
    if (newStatus === "active") {
      // 1. Insert into tournament_partners
      const { error: partnerError } = await supabase.from("tournament_partners").insert({
        tournament_id: sponsorship.tournament_id,
        company_id: sponsorship.company_id,
        position_order: 0,
      } as any);
      if (partnerError && !partnerError.message.includes("duplicate")) {
        console.warn("Partner insert:", partnerError.message);
      }

      // 2. If feed_visibility, create sponsored_post
      const plan = plans.find((p) => p.id === sponsorship.plan_id);
      if (plan?.feed_visibility && sponsorship.tournaments) {
        const t = sponsorship.tournaments;
        await supabase.from("sponsored_posts").insert({
          company_id: sponsorship.company_id,
          title: `Parceiro oficial: ${t.name}`,
          content: `Parceiro oficial de ${t.name} em ${t.city}/${t.state}. Venha conferir!`,
          image_url: sponsorship.logo_url || null,
          active_from: new Date().toISOString().split("T")[0],
          active_to: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
          active: true,
          city: t.city,
        });
      }

      toast({ title: "Patrocínio ativado!", description: "Parceiro adicionado automaticamente." });
    } else {
      toast({ title: `Status atualizado para ${newStatus}` });
    }
    fetchData();
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "active": return "bg-primary/20 text-primary";
      case "pending": return "bg-secondary/20 text-secondary";
      case "paused": return "bg-muted text-muted-foreground";
      case "expired": return "bg-destructive/20 text-destructive";
      default: return "bg-muted text-muted-foreground";
    }
  };

  // Metrics
  const totalActive = sponsorships.filter((s) => s.status === "active").length;
  const totalRevenue = sponsorships
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + Number((s as any).tournament_sponsor_plans?.price || 0), 0);

  return (
    <div>
      <h1 className="text-4xl font-display text-foreground mb-6">PATROCÍNIOS DE TORNEIO</h1>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold text-primary">{totalActive}</p>
          <p className="text-xs text-muted-foreground">Ativos</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold text-secondary">R$ {totalRevenue.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground">Receita ativa</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-2xl font-bold text-foreground">{sponsorships.length}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="sponsorships">
        <TabsList className="mb-4">
          <TabsTrigger value="sponsorships">Patrocínios</TabsTrigger>
          <TabsTrigger value="plans">Pacotes</TabsTrigger>
        </TabsList>

        {/* Sponsorships tab */}
        <TabsContent value="sponsorships">
          {loading ? <p className="text-muted-foreground">Carregando...</p> : sponsorships.length === 0 ? (
            <p className="text-muted-foreground">Nenhum patrocínio registrado.</p>
          ) : (
            <div className="space-y-3">
              {sponsorships.map((s) => (
                <div key={s.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start gap-3">
                    {s.logo_url ? (
                      <img src={s.logo_url} className="h-12 w-12 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Store className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-foreground text-sm">{(s as any).companies?.name}</p>
                        <Badge className={`text-xs ${statusColor(s.status)}`}>{s.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <Trophy className="inline h-3 w-3 mr-1" />
                        {(s as any).tournaments?.name} — {(s as any).tournaments?.city}/{(s as any).tournaments?.state}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Pacote: {(s as any).tournament_sponsor_plans?.display_name} · R$ {Number((s as any).tournament_sponsor_plans?.price || 0).toFixed(0)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {s.status === "pending" && (
                      <Button size="sm" onClick={() => updateSponsorshipStatus(s.id, "active", s)}>
                        <CheckCircle className="h-3.5 w-3.5 mr-1" /> Aprovar
                      </Button>
                    )}
                    {s.status === "active" && (
                      <Button size="sm" variant="outline" onClick={() => updateSponsorshipStatus(s.id, "paused", s)}>
                        <Pause className="h-3.5 w-3.5 mr-1" /> Pausar
                      </Button>
                    )}
                    {s.status === "paused" && (
                      <Button size="sm" onClick={() => updateSponsorshipStatus(s.id, "active", s)}>
                        <CheckCircle className="h-3.5 w-3.5 mr-1" /> Reativar
                      </Button>
                    )}
                    <Button size="sm" variant="destructive" onClick={() => updateSponsorshipStatus(s.id, "expired", s)}>
                      <Ban className="h-3.5 w-3.5 mr-1" /> Bloquear
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Plans tab */}
        <TabsContent value="plans">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">Defina os pacotes disponíveis para empresas</p>
            <Button size="sm" onClick={openCreatePlan}><Plus className="h-4 w-4 mr-1" /> Novo pacote</Button>
          </div>

          <div className="space-y-3">
            {plans.map((plan) => (
              <div key={plan.id} className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-foreground">{plan.display_name}</p>
                    <Badge variant="outline" className="text-xs">R$ {Number(plan.price).toFixed(0)}</Badge>
                    {!plan.active && <Badge variant="destructive" className="text-xs">Inativo</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>
                  <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                    {plan.tournament_visibility && <span>✅ Torneio</span>}
                    {plan.signup_visibility && <span>✅ Inscrição</span>}
                    {plan.feed_visibility && <span>✅ Feed</span>}
                    {plan.physical_banner_allowed && <span>✅ Banner</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => openEditPlan(plan)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => deletePlan(plan.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Plan create/edit dialog */}
      <Dialog open={showPlanDialog} onOpenChange={setShowPlanDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editPlan ? "Editar Pacote" : "Novo Pacote"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={savePlan} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>ID interno</Label><Input value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} placeholder="basic" /></div>
              <div><Label>Nome exibido</Label><Input value={planForm.display_name} onChange={(e) => setPlanForm({ ...planForm, display_name: e.target.value })} placeholder="Basic" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Preço (R$)</Label><Input type="number" step="0.01" value={planForm.price} onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })} /></div>
              <div><Label>Máx. torneios</Label><Input type="number" value={planForm.max_tournaments} onChange={(e) => setPlanForm({ ...planForm, max_tournaments: e.target.value })} /></div>
            </div>
            <div><Label>Descrição</Label><Input value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2"><Switch checked={planForm.tournament_visibility} onCheckedChange={(v) => setPlanForm({ ...planForm, tournament_visibility: v })} /><Label>Página torneio</Label></div>
              <div className="flex items-center gap-2"><Switch checked={planForm.signup_visibility} onCheckedChange={(v) => setPlanForm({ ...planForm, signup_visibility: v })} /><Label>Tela inscrição</Label></div>
              <div className="flex items-center gap-2"><Switch checked={planForm.feed_visibility} onCheckedChange={(v) => setPlanForm({ ...planForm, feed_visibility: v })} /><Label>Feed local</Label></div>
              <div className="flex items-center gap-2"><Switch checked={planForm.physical_banner_allowed} onCheckedChange={(v) => setPlanForm({ ...planForm, physical_banner_allowed: v })} /><Label>Banner físico</Label></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={planForm.active} onCheckedChange={(v) => setPlanForm({ ...planForm, active: v })} /><Label>Ativo</Label></div>
            <Button type="submit" className="w-full">Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSponsorships;
