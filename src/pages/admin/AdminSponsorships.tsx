import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { CheckCircle, Pause, Ban, Trophy, Store, Eye, MousePointerClick } from "lucide-react";

const AdminSponsorships = () => {
  const [sponsorships, setSponsorships] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const [spRes, plansRes] = await Promise.all([
      supabase.from("tournament_sponsorships")
        .select("*, tournaments(name, city, state), companies(name, logo_url), tournament_sponsor_plans(display_name, price, tournament_visibility, signup_visibility, feed_visibility, physical_banner_allowed)")
        .order("created_at", { ascending: false }),
      supabase.from("tournament_sponsor_plans").select("*"),
    ]);
    setSponsorships(spRes.data || []);
    setPlans(plansRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const updateStatus = async (id: string, newStatus: string, sponsorship: any) => {
    const { error } = await supabase.from("tournament_sponsorships").update({ status: newStatus } as any).eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    if (newStatus === "active") {
      const { error: partnerError } = await supabase.from("tournament_partners").insert({
        tournament_id: sponsorship.tournament_id,
        company_id: sponsorship.company_id,
        position_order: 0,
      } as any);
      if (partnerError && !partnerError.message.includes("duplicate")) {
        console.warn("Partner insert:", partnerError.message);
      }

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

  const totalActive = sponsorships.filter((s) => s.status === "active").length;
  const totalRevenue = sponsorships
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + Number(s.tournament_sponsor_plans?.price || 0), 0);

  return (
    <div>
      <h1 className="text-4xl font-display text-foreground mb-6">PATROCÍNIOS DE TORNEIO</h1>

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

      {loading ? <p className="text-muted-foreground">Carregando...</p> : sponsorships.length === 0 ? (
        <p className="text-muted-foreground">Nenhum patrocínio registrado.</p>
      ) : (
        <div className="space-y-3">
          {sponsorships.map((s) => {
            const plan = s.tournament_sponsor_plans;
            return (
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
                      <p className="font-bold text-foreground text-sm">{s.companies?.name}</p>
                      <Badge className={`text-xs ${statusColor(s.status)}`}>{s.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <Trophy className="inline h-3 w-3 mr-1" />
                      {s.tournaments?.name} — {s.tournaments?.city}/{s.tournaments?.state}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Pacote: {plan?.display_name} · R$ {Number(plan?.price || 0).toFixed(0)}
                    </p>

                    {/* Metrics */}
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {s.views_count || 0} views</span>
                      <span className="flex items-center gap-1"><MousePointerClick className="h-3 w-3" /> {s.clicks_count || 0} clicks</span>
                    </div>

                    {/* Placements */}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {plan?.tournament_visibility && <Badge variant="outline" className="text-[10px] h-5">Torneio</Badge>}
                      {plan?.signup_visibility && <Badge variant="outline" className="text-[10px] h-5">Inscrição</Badge>}
                      {plan?.feed_visibility && <Badge variant="outline" className="text-[10px] h-5">Feed</Badge>}
                      {plan?.physical_banner_allowed && <Badge variant="outline" className="text-[10px] h-5">Banner</Badge>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3 flex-wrap">
                  {s.status === "pending" && (
                    <Button size="sm" onClick={() => updateStatus(s.id, "active", s)}>
                      <CheckCircle className="h-3.5 w-3.5 mr-1" /> Aprovar
                    </Button>
                  )}
                  {s.status === "active" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(s.id, "paused", s)}>
                      <Pause className="h-3.5 w-3.5 mr-1" /> Pausar
                    </Button>
                  )}
                  {s.status === "paused" && (
                    <Button size="sm" onClick={() => updateStatus(s.id, "active", s)}>
                      <CheckCircle className="h-3.5 w-3.5 mr-1" /> Reativar
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={() => updateStatus(s.id, "expired", s)}>
                    <Ban className="h-3.5 w-3.5 mr-1" /> Bloquear
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminSponsorships;
