import { useEffect, useState } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, MapPin, Eye, MousePointerClick, Gift, Upload,
  MessageCircle, FileText, Megaphone, Flag, Pencil, Package
} from "lucide-react";

const SponsorshipDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { company } = useOutletContext<{ company: any }>();
  const navigate = useNavigate();
  const [sponsorship, setSponsorship] = useState<any>(null);
  const [giveaways, setGiveaways] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: sp } = await supabase
        .from("tournament_sponsorships")
        .select("*, tournaments(*), tournament_sponsor_plans(*)")
        .eq("id", id!)
        .eq("company_id", company.id)
        .maybeSingle();

      if (!sp) {
        navigate("/sponsor/dashboard", { replace: true });
        return;
      }
      setSponsorship(sp);

      const { data: gw } = await supabase
        .from("sponsorship_giveaways")
        .select("*")
        .eq("sponsorship_id", id!);
      setGiveaways(gw || []);
      setLoading(false);
    };
    fetch();
  }, [id, company.id, navigate]);

  if (loading || !sponsorship) {
    return <p className="text-muted-foreground text-sm">Carregando...</p>;
  }

  const plan = sponsorship.tournament_sponsor_plans;
  const tournament = sponsorship.tournaments;

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

  const giveawayStatusLabel = (s: string) => {
    switch (s) {
      case "pending": return "Pendente";
      case "ready": return "Pronto";
      case "delivered": return "Entregue";
      default: return s;
    }
  };

  const placements = [];
  if (plan?.tournament_visibility) placements.push({ icon: Eye, label: "Página do torneio" });
  if (plan?.signup_visibility) placements.push({ icon: FileText, label: "Tela de inscrição" });
  if (plan?.feed_visibility) placements.push({ icon: Megaphone, label: "Feed local" });
  if (plan?.physical_banner_allowed) placements.push({ icon: Flag, label: "Banner físico" });

  return (
    <div className="space-y-6">
      <button onClick={() => navigate("/sponsor/dashboard")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-foreground">{tournament?.name}</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
            <MapPin className="h-3.5 w-3.5" />
            {tournament?.arena ? `${tournament.arena} — ` : ""}{tournament?.city}/{tournament?.state}
          </p>
        </div>
        <Badge className={`text-xs border shrink-0 ${statusColor(sponsorship.status)}`}>
          {statusLabel(sponsorship.status)}
        </Badge>
      </div>

      {/* Plan & placements */}
      <Card className="border-border bg-card">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Pacote</span>
            <Badge variant="outline">{plan?.display_name} — R$ {Number(plan?.price || 0).toFixed(0)}</Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Onde sua marca aparece:</p>
            <div className="flex flex-wrap gap-2">
              {placements.map((p, i) => (
                <span key={i} className="flex items-center gap-1 text-xs text-foreground bg-muted/50 px-2.5 py-1 rounded-lg">
                  <p.icon className="h-3 w-3 text-primary" /> {p.label}
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-border bg-card">
          <CardContent className="p-4 text-center">
            <Eye className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{(sponsorship.views_count || 0).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Impressões</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4 text-center">
            <MousePointerClick className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{(sponsorship.clicks_count || 0).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Cliques</p>
          </CardContent>
        </Card>
      </div>

      {/* Giveaways */}
      {giveaways.length > 0 && (
        <div>
          <h2 className="font-display text-xl text-foreground mb-3 flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" /> BRINDES
          </h2>
          <div className="space-y-3">
            {giveaways.map((g) => (
              <Card key={g.id} className="border-border bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-foreground">{g.item_type}</span>
                    <Badge className={`text-xs border ${
                      g.status === "delivered" ? "bg-primary/15 text-primary border-primary/30" :
                      g.status === "ready" ? "bg-secondary/15 text-secondary border-secondary/30" :
                      "bg-muted text-muted-foreground border-border"
                    }`}>
                      {giveawayStatusLabel(g.status)}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p><Package className="h-3 w-3 inline mr-1" />Quantidade: {g.quantity}</p>
                    {g.rules && <p>Regra: {g.rules}</p>}
                    {g.delivery_deadline && <p>Prazo: {g.delivery_deadline}</p>}
                    {g.contact_name && <p>Contato: {g.contact_name}</p>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        <Button variant="outline" className="w-full justify-start gap-2">
          <Upload className="h-4 w-4 text-primary" /> Atualizar logo
        </Button>
        <Button variant="outline" className="w-full justify-start gap-2">
          <Pencil className="h-4 w-4 text-primary" /> Editar brindes
        </Button>
        <Button variant="outline" className="w-full justify-start gap-2">
          <MessageCircle className="h-4 w-4 text-primary" /> Falar com suporte
        </Button>
      </div>
    </div>
  );
};

export default SponsorshipDetail;
