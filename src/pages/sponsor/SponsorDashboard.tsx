import { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Trophy, MapPin, Eye, MousePointerClick, Gift, BarChart3,
  Paintbrush, ArrowRight
} from "lucide-react";

const SponsorDashboard = () => {
  const { company } = useOutletContext<{ company: any }>();
  const navigate = useNavigate();
  const [sponsorships, setSponsorships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("tournament_sponsorships")
        .select("*, tournaments(*), tournament_sponsor_plans(*)")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false });
      setSponsorships(data || []);
      setLoading(false);
    };
    fetch();
  }, [company.id]);

  const active = sponsorships.filter((s) => s.status === "active");
  const cities = [...new Set(active.map((s) => s.tournaments?.city).filter(Boolean))];
  const totalViews = sponsorships.reduce((sum, s) => sum + (s.views_count || 0), 0);
  const totalClicks = sponsorships.reduce((sum, s) => sum + (s.clicks_count || 0), 0);

  const statusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-primary/15 text-primary border-primary/30";
      case "pending": return "bg-secondary/15 text-secondary border-secondary/30";
      case "paused": return "bg-muted text-muted-foreground border-border";
      default: return "bg-destructive/15 text-destructive border-destructive/30";
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "active": return "Ativo";
      case "pending": return "Pendente";
      case "paused": return "Pausado";
      case "expired": return "Expirado";
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl text-foreground">PAINEL DO PATROCINADOR</h1>
        <p className="text-muted-foreground text-sm mt-1">Acompanhe seus patrocínios e resultados</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-border bg-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{sponsorships.length}</p>
              <p className="text-xs text-muted-foreground">Patrocínios</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{cities.length}</p>
              <p className="text-xs text-muted-foreground">Cidades ativas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Eye className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalViews.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Impressões</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <MousePointerClick className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalClicks.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Cliques</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="font-display text-xl text-foreground mb-3">AÇÕES RÁPIDAS</h2>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" className="h-auto py-4 flex-col gap-1.5" onClick={() => navigate("/sponsor/tournaments")}>
            <Trophy className="h-5 w-5 text-primary" />
            <span className="text-xs">Patrocinar torneio</span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col gap-1.5" onClick={() => navigate("/sponsor/tournaments")}>
            <Gift className="h-5 w-5 text-primary" />
            <span className="text-xs">Ver brindes</span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col gap-1.5" onClick={() => navigate("/sponsor/tournaments")}>
            <BarChart3 className="h-5 w-5 text-primary" />
            <span className="text-xs">Ver relatórios</span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col gap-1.5" onClick={() => navigate("/marketplace/my-company")}>
            <Paintbrush className="h-5 w-5 text-primary" />
            <span className="text-xs">Atualizar marca</span>
          </Button>
        </div>
      </div>

      {/* Recent sponsorships */}
      <div>
        <h2 className="font-display text-xl text-foreground mb-3">PATROCÍNIOS RECENTES</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : sponsorships.length === 0 ? (
          <Card className="border-border bg-card">
            <CardContent className="p-6 text-center">
              <Trophy className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Nenhum patrocínio ainda.</p>
              <Button className="mt-4 box-glow" onClick={() => navigate("/sponsor/tournaments")}>
                Patrocinar primeiro torneio
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sponsorships.slice(0, 5).map((s) => (
              <Card
                key={s.id}
                className="border-border bg-card hover:border-primary/20 transition-colors cursor-pointer"
                onClick={() => navigate(`/sponsor/sponsorships/${s.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-lg text-foreground truncate">
                        {s.tournaments?.name || "Torneio"}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" />
                        {s.tournaments?.city}/{s.tournaments?.state}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={`text-xs border ${statusColor(s.status)}`}>
                        {statusLabel(s.status)}
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {s.views_count || 0}</span>
                    <span className="flex items-center gap-1"><MousePointerClick className="h-3 w-3" /> {s.clicks_count || 0}</span>
                    <span>{s.tournament_sponsor_plans?.display_name}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SponsorDashboard;
