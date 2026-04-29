import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Store, Package, ShoppingBag, Megaphone, Trophy,
  LineChart, Eye, Compass, Rss, ExternalLink, AlertTriangle, MousePointerClick,
  TrendingUp, ArrowRight, Loader2,
} from "lucide-react";
import { OperationModeBanner } from "@/components/conversational/OperationModeBanner";
import { CommandExamplesCard } from "@/components/conversational/CommandExamplesCard";
import { CommandHistoryCard } from "@/components/conversational/CommandHistoryCard";
import { COMMANDS } from "@/lib/conversationalCommands";
import { RevenueDashboardPanel } from "@/components/revenue/RevenueDashboardPanel";
import { GrowthDashboardPanel } from "@/components/growth/GrowthDashboardPanel";

// ---------- Local helpers (not exported) ----------
const SectionHeader = ({ id, icon: Icon, title, subtitle, action }: any) => (
  <div id={id} className="flex items-end justify-between gap-3 mb-3 scroll-mt-20">
    <div>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="font-display text-xl text-foreground tracking-wide">{title}</h2>
      </div>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>
);

const KpiCard = ({ icon: Icon, label, value, hint }: any) => (
  <Card className="border-border bg-card">
    <CardContent className="p-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
          <p className="text-[11px] text-muted-foreground mt-1 truncate">{label}</p>
          {hint && <p className="text-[10px] text-muted-foreground/70 truncate">{hint}</p>}
        </div>
      </div>
    </CardContent>
  </Card>
);

const ShortcutLink = ({ to, icon: Icon, label, external }: any) => (
  <Link
    to={to}
    target={external ? "_blank" : undefined}
    className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground hover:border-primary/30 hover:bg-muted/40 transition-colors"
  >
    <Icon className="h-4 w-4 text-primary shrink-0" />
    <span className="flex-1 truncate">{label}</span>
    {external ? <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" /> : <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
  </Link>
);

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const statusTone = (status: string) => {
  switch (status) {
    case "active":
    case "paid":
    case "approved":
      return "bg-primary/15 text-primary border-primary/30";
    case "pending":
      return "bg-secondary/15 text-secondary border-secondary/30";
    case "paused":
    case "draft":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-destructive/15 text-destructive border-destructive/30";
  }
};

// ---------- Page ----------
const CompanyDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [sponsorships, setSponsorships] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: comp } = await supabase
        .from("companies")
        .select("*")
        .eq("owner_user_id", user.id)
        .maybeSingle();
      setCompany(comp);

      if (!comp) { setLoading(false); return; }

      const [plansRes, prodRes, campRes, sponsRes] = await Promise.all([
        comp.plan_id
          ? supabase.from("company_plans").select("*").eq("id", comp.plan_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from("products").select("*").eq("company_id", comp.id).order("created_at", { ascending: false }),
        (supabase.from("ad_campaigns") as any)
          .select("*")
          .eq("company_id", comp.id)
          .order("created_at", { ascending: false }),
        (supabase.from("tournament_sponsorships") as any)
          .select("*, tournaments(name, city, state)")
          .eq("company_id", comp.id)
          .order("created_at", { ascending: false }),
      ]);

      setPlan((plansRes as any).data || null);
      const productList = prodRes.data || [];
      setProducts(productList);
      setCampaigns(campRes.data || []);
      setSponsorships(sponsRes.data || []);

      // Orders: filter by products belonging to this company
      const productIds = productList.map((p: any) => p.id);
      if (productIds.length > 0) {
        const { data: ordRes } = await (supabase.from("marketplace_orders") as any)
          .select("*")
          .in("product_id", productIds)
          .order("created_at", { ascending: false });
        setOrders(ordRes || []);
      } else {
        setOrders([]);
      }

      setLoading(false);
    })();
  }, [user]);

  // ---------- KPIs ----------
  const now = useMemo(() => new Date(), []);
  const last30 = useMemo(() => {
    const d = new Date(now); d.setDate(d.getDate() - 30); return d;
  }, [now]);

  const activeProducts = products.filter((p) => p.is_active !== false).length;
  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;
  const activeSponsors = sponsorships.filter((s) => s.status === "active").length;
  const orders30 = orders.filter((o) => new Date(o.created_at) >= last30);
  const revenue30 = orders30
    .filter((o) => ["paid", "approved", "completed"].includes(o.status))
    .reduce((sum, o) => sum + Number(o.total_amount || o.amount || 0), 0);
  const ticketAvg = orders30.length > 0 ? revenue30 / orders30.length : 0;
  const totalViews = sponsorships.reduce((s, x) => s + (x.views_count || 0), 0)
    + campaigns.reduce((s, x) => s + (x.views_count || 0), 0);
  const totalClicks = sponsorships.reduce((s, x) => s + (x.clicks_count || 0), 0)
    + campaigns.reduce((s, x) => s + (x.clicks_count || 0), 0);

  // Alerts
  const alerts: { tone: "warn" | "info"; text: string }[] = [];
  if (products.length === 0) alerts.push({ tone: "warn", text: "Sua loja ainda não tem produtos cadastrados." });
  if (activeCampaigns === 0 && activeSponsors === 0) alerts.push({ tone: "info", text: "Nenhuma campanha ou patrocínio ativo no momento." });
  const pendingOrders = orders.filter((o) => o.status === "pending").length;
  if (pendingOrders > 0) alerts.push({ tone: "info", text: `${pendingOrders} pedido(s) pendente(s) de processamento.` });

  // Top products by orders count
  const topProducts = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach((o) => { if (o.product_id) counts[o.product_id] = (counts[o.product_id] || 0) + 1; });
    return [...products]
      .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0))
      .slice(0, 5);
  }, [products, orders]);

  const topSponsorship = useMemo(
    () => [...sponsorships].sort((a, b) => (b.views_count || 0) - (a.views_count || 0))[0],
    [sponsorships],
  );

  // ---------- Loading / no company guards ----------
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!company) {
    return (
      <div className="max-w-md mx-auto text-center space-y-4 py-12">
        <Store className="h-12 w-12 text-muted-foreground mx-auto" />
        <h2 className="font-display text-2xl text-foreground">Crie sua empresa</h2>
        <p className="text-sm text-muted-foreground">
          Cadastre sua empresa para começar a vender no marketplace e criar campanhas.
        </p>
        <Button onClick={() => navigate("/marketplace/register")} className="box-glow">
          Cadastrar empresa
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Company Control Tower</p>
          <h1 className="font-display text-3xl md:text-4xl text-foreground leading-tight">{company.name}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {plan && (
              <Badge variant="outline" className="text-[10px]">
                Plano: {plan.name || plan.display_name}
              </Badge>
            )}
            <Badge className={`text-[10px] border ${company.is_active ? statusTone("active") : statusTone("paused")}`}>
              {company.is_active ? "Ativa" : "Inativa"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Alerts strip */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                a.tone === "warn"
                  ? "border-destructive/30 bg-destructive/5 text-destructive"
                  : "border-border bg-muted/30 text-muted-foreground"
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{a.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* BLOCO 1 — Control Tower KPIs */}
      <section>
        <SectionHeader
          icon={LayoutDashboard}
          title="Visão geral"
          subtitle="Tudo o que importa em um piscar de olhos"
        />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiCard icon={Package} label="Produtos ativos" value={activeProducts} hint={`${products.length} no total`} />
          <KpiCard icon={ShoppingBag} label="Pedidos 30d" value={orders30.length} hint={fmtCurrency(revenue30)} />
          <KpiCard icon={Megaphone} label="Campanhas ativas" value={activeCampaigns} hint={`${campaigns.length} no total`} />
          <KpiCard icon={Trophy} label="Patrocínios ativos" value={activeSponsors} hint={`${sponsorships.length} no total`} />
          <KpiCard icon={Eye} label="Impressões" value={totalViews.toLocaleString("pt-BR")} />
          <KpiCard icon={MousePointerClick} label="Cliques" value={totalClicks.toLocaleString("pt-BR")} />
        </div>
      </section>

      {/* CAMADA CONVERSACIONAL */}
      <OperationModeBanner profile="company" />
      <CommandExamplesCard
        title="Operar pelo WhatsApp"
        subtitle="Comandos rápidos para sua presença comercial"
        examples={COMMANDS.company}
      />
      {user?.id && (
        <CommandHistoryCard
          scope="user"
          scopeId={user.id}
          seeAllHref="/company/comandos"
        />
      )}

      {/* BLOCO 2 — Marketplace */}
      <section>
        <SectionHeader
          id="marketplace"
          icon={Store}
          title="Marketplace"
          subtitle="Sua loja, produtos e pedidos recentes"
        />
        <div className="grid md:grid-cols-2 gap-3">
          <Card className="border-border bg-card">
            <CardContent className="p-4 space-y-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Top produtos</p>
              {topProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum produto cadastrado.</p>
              ) : (
                topProducts.map((p) => (
                  <Link
                    key={p.id}
                    to={`/marketplace/product/${p.id}`}
                    className="flex items-center justify-between gap-2 py-1.5 border-b border-border last:border-0 hover:text-primary transition-colors"
                  >
                    <span className="text-sm truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{fmtCurrency(p.price)}</span>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4 space-y-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Últimos pedidos</p>
              {orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum pedido ainda.</p>
              ) : (
                orders.slice(0, 5).map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-border last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm truncate">{fmtCurrency(o.total_amount || o.amount || 0)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(o.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <Badge className={`text-[10px] border ${statusTone(o.status)}`}>{o.status}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
          <ShortcutLink to="/company/produtos" icon={Package} label="Gerenciar produtos" />
          <ShortcutLink to="/company/pedidos" icon={ShoppingBag} label="Ver pedidos" />
          <ShortcutLink to={`/marketplace/company/${company.id}`} icon={ExternalLink} label="Ver loja pública" />
        </div>
      </section>

      {/* BLOCO 3 — Campanhas / Ads */}
      <section>
        <SectionHeader
          id="campanhas"
          icon={Megaphone}
          title="Campanhas e patrocínios"
          subtitle="Sua presença promocional na rede"
        />
        <div className="grid md:grid-cols-2 gap-3">
          <Card className="border-border bg-card">
            <CardContent className="p-4 space-y-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Campanhas (ads)</p>
              {campaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma campanha criada.</p>
              ) : (
                campaigns.slice(0, 4).map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-border last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm truncate">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground">{c.kind}</p>
                    </div>
                    <Badge className={`text-[10px] border ${statusTone(c.status)}`}>{c.status}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4 space-y-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Patrocínios</p>
              {sponsorships.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum patrocínio ativo.</p>
              ) : (
                sponsorships.slice(0, 4).map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-border last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm truncate">{s.tournaments?.name || "Torneio"}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {s.tournaments?.city}/{s.tournaments?.state}
                      </p>
                    </div>
                    <Badge className={`text-[10px] border ${statusTone(s.status)}`}>{s.status}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
          <ShortcutLink to="/company/sponsor/torneios" icon={Trophy} label="Patrocinar torneio" />
          <ShortcutLink to="/company/sponsor/resumo" icon={Megaphone} label="Visão de patrocínios" />
        </div>
      </section>

      {/* BLOCO 4 — Performance */}
      <section>
        <SectionHeader
          id="performance"
          icon={LineChart}
          title="Resultados"
          subtitle="O que está funcionando agora"
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={TrendingUp} label="Receita 30d" value={fmtCurrency(revenue30)} />
          <KpiCard icon={ShoppingBag} label="Ticket médio" value={fmtCurrency(ticketAvg)} />
          <KpiCard icon={Package} label="Top produto" value={topProducts[0]?.name?.slice(0, 12) || "—"} hint={topProducts[0] ? "Mais pedidos" : undefined} />
          <KpiCard icon={Trophy} label="Top patrocínio" value={topSponsorship?.tournaments?.name?.slice(0, 12) || "—"} hint={topSponsorship ? `${topSponsorship.views_count || 0} views` : undefined} />
        </div>
      </section>

      {/* BLOCO 5 — Visibilidade / Discovery */}
      <section>
        <SectionHeader
          id="visibilidade"
          icon={Eye}
          title="Como apareço"
          subtitle="Sua presença pública dentro do MoodPlay"
        />
        <Card className="border-border bg-card">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{company.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  Loja pública: /marketplace/company/{company.id?.slice(0, 8)}…
                </p>
              </div>
              <Button size="sm" variant="outline" asChild>
                <Link to={`/marketplace/company/${company.id}`} target="_blank">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
          <ShortcutLink to="/explore" icon={Compass} label="Ver no Explore" />
          <ShortcutLink to="/marketplace" icon={Store} label="Ver no Marketplace" />
          <ShortcutLink to="/feed" icon={Rss} label="Ver no Feed" />
        </div>
      </section>

      {/* FASE 13 — Receita conversacional */}
      {company?.id && (
        <section className="space-y-3">
          <SectionHeader id="revenue" icon={TrendingUp} title="Vendas via WhatsApp" subtitle="Receita atribuída à ORKYM · 30 dias" />
          <RevenueDashboardPanel scope={{ type: "company", id: company.id }} />
          <GrowthDashboardPanel scope={{ type: "company", id: company.id }} />
        </section>
      )}
    </div>
  );
};

export default CompanyDashboard;
