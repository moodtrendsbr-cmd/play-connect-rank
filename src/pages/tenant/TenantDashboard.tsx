import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Building2, Users, Store, DollarSign, Trophy, RefreshCw, ArrowRight,
  Network, TrendingUp, Sparkles, Clock, Activity, AlertTriangle, Flame,
  Target, MapPin, CalendarDays,
} from "lucide-react";
import { useTenantInsights } from "@/hooks/useTenantInsights";
import { NetworkInsightCard } from "@/components/tenant/NetworkInsightCard";
import { EmptyState } from "@/components/tenant/EmptyState";

const SectionHeader = ({
  icon, title, subtitle,
}: { icon: ReactNode; title: string; subtitle?: string }) => (
  <div className="flex items-center gap-3 mb-4">
    <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
      {icon}
    </div>
    <div className="min-w-0">
      <h2 className="text-base font-semibold text-foreground leading-tight">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground leading-tight">{subtitle}</p>}
    </div>
  </div>
);

const KpiCard = ({ label, value, icon, hint }: { label: string; value: ReactNode; icon: ReactNode; hint?: string }) => (
  <Card className="bg-card border-border">
    <CardContent className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-muted-foreground/60">{icon}</span>
      </div>
      <p className="text-2xl font-semibold text-foreground tabular-nums leading-none">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-1.5">{hint}</p>}
    </CardContent>
  </Card>
);

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const TenantDashboard = () => {
  const { tenant, refresh } = useTenant();
  const insights = useTenantInsights(tenant?.id);
  const [revenue, setRevenue] = useState({ total: 0, settled: 0, pending: 0, fromTournaments: 0, fromSponsorship: 0 });
  const [overdueCount, setOverdueCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!tenant?.id) return;
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: txs } = await supabase
      .from("financial_transactions")
      .select("total_amount, status, source_type, paid_at")
      .eq("tenant_id", tenant.id)
      .gte("created_at", since)
      .limit(500);
    const list = (txs ?? []) as any[];
    const total = list.reduce((s, t) => s + Number(t.total_amount || 0), 0);
    const settled = list.filter((t) => t.status === "paid").reduce((s, t) => s + Number(t.total_amount || 0), 0);
    const pending = list.filter((t) => t.status === "pending").reduce((s, t) => s + Number(t.total_amount || 0), 0);
    const fromTournaments = list.filter((t) => t.source_type === "enrollment").reduce((s, t) => s + Number(t.total_amount || 0), 0);
    const fromSponsorship = list.filter((t) => ["sponsorship", "boost"].includes(t.source_type)).reduce((s, t) => s + Number(t.total_amount || 0), 0);
    setRevenue({ total, settled, pending, fromTournaments, fromSponsorship });

    // Pendências (cobranças overdue nas arenas da rede)
    const { data: arenas } = await supabase.from("arenas").select("id").eq("tenant_id", tenant.id);
    const arenaIds = (arenas ?? []).map((a: any) => a.id);
    if (arenaIds.length > 0) {
      const { count: ov } = await supabase
        .from("arena_billing_cycles")
        .select("id", { count: "exact", head: true })
        .in("arena_id", arenaIds)
        .eq("status", "overdue");
      setOverdueCount(ov ?? 0);
    } else {
      setOverdueCount(0);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tenant?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refresh(), load()]);
    setRefreshing(false);
  };

  if (!tenant) return <p className="text-muted-foreground p-6">Carregando rede…</p>;

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-11 w-11 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Network className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl text-foreground leading-tight truncate">
              Central da Rede
            </h1>
            <p className="text-xs text-muted-foreground leading-tight truncate">
              {tenant.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/tenant/torneios">
              <Trophy className="mr-2 h-4 w-4" /> Novo torneio
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* PENDÊNCIAS */}
      {overdueCount > 0 && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-foreground text-sm">
            <strong>{overdueCount}</strong> {overdueCount === 1 ? "pendência importante" : "pendências importantes"} de cobrança em arenas da rede.{" "}
            <Link to="/tenant/arenas" className="underline">Ver arenas</Link>
          </AlertDescription>
        </Alert>
      )}

      {/* BLOCO 1 — REDE */}
      <section>
        <SectionHeader
          icon={<Building2 className="h-4 w-4" />}
          title="Visão da rede"
          subtitle="Quem está ativo agora na sua operação esportiva"
        />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard label="Arenas ativas" value={insights.arenasActive} icon={<Building2 className="h-4 w-4" />} />
          <KpiCard label="Organizadores" value={insights.organizersActive} icon={<Users className="h-4 w-4" />} />
          <KpiCard label="Eventos ativos" value={insights.eventsActive} icon={<Trophy className="h-4 w-4" />} />
          <KpiCard label="Torneios na semana" value={insights.tournamentsThisWeek} icon={<CalendarDays className="h-4 w-4" />} hint="novos 7d" />
          <KpiCard label="Patrocinadores" value={insights.sponsorsActive} icon={<Store className="h-4 w-4" />} />
        </div>
      </section>

      {/* BLOCO 2 — CRESCIMENTO */}
      <section>
        <SectionHeader
          icon={<TrendingUp className="h-4 w-4" />}
          title="Crescimento"
          subtitle="Onde sua rede está evoluindo nos últimos 30 dias"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <NetworkInsightCard icon={Flame}    accent="amber"   label="Arena em destaque" value={insights.topArenaName} hint="maior ocupação 30d" />
          <NetworkInsightCard icon={TrendingUp} accent="emerald" label="Arena crescendo" value={insights.topArenaGrowingName} hint="maior crescimento de receita" />
          <NetworkInsightCard icon={Clock}    accent="sky"     label="Horário de pico" value={insights.peakHour} hint="hora mais movimentada" />
          <NetworkInsightCard icon={Activity} accent="emerald" label="Esporte em alta" value={insights.topSport} hint="mais inscrições 30d" />
          <NetworkInsightCard icon={Building2} accent="primary" label="Novas arenas" value={insights.newArenas30d} hint="nos últimos 30d" />
          <NetworkInsightCard icon={AlertTriangle} accent="amber" label="Arenas paradas" value={insights.lowActivityArenas} hint="sem movimento 30d" />
        </div>
      </section>

      {/* BLOCO 3 — RECEITA */}
      <section>
        <SectionHeader
          icon={<DollarSign className="h-4 w-4" />}
          title="Receita"
          subtitle="Entradas da rede nos últimos 30 dias"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <KpiCard label="Receita total" value={fmtBRL(revenue.total)} icon={<DollarSign className="h-4 w-4" />} hint={`${fmtBRL(revenue.settled)} liquidado`} />
          <KpiCard label="Torneios" value={fmtBRL(revenue.fromTournaments)} icon={<Trophy className="h-4 w-4" />} hint="inscrições pagas" />
          <KpiCard label="Patrocínios" value={fmtBRL(revenue.fromSponsorship)} icon={<Store className="h-4 w-4" />} hint="campanhas + boosts" />
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/tenant/financeiro">Ver financeiro completo <ArrowRight className="ml-2 h-3.5 w-3.5" /></Link>
        </Button>
      </section>

      {/* BLOCO 4 — INTELIGÊNCIA DA REDE */}
      <section>
        <SectionHeader
          icon={<Sparkles className="h-4 w-4" />}
          title="Inteligência da rede"
          subtitle="O que está em alta agora"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" /> Torneio em alta</CardTitle></CardHeader>
            <CardContent>
              <p className="text-lg font-semibold text-foreground truncate">{insights.trendingTournament ?? "—"}</p>
              <p className="text-xs text-muted-foreground">mais inscrições reais nos últimos 30 dias</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Target className="h-4 w-4 text-emerald-500" /> Melhor conversão</CardTitle></CardHeader>
            <CardContent>
              <p className="text-lg font-semibold text-foreground truncate">{insights.bestConversionArena ?? "—"}</p>
              <p className="text-xs text-muted-foreground">arena com maior taxa de reservas confirmadas</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><MapPin className="h-4 w-4 text-sky-500" /> Esporte crescendo</CardTitle></CardHeader>
            <CardContent>
              <p className="text-lg font-semibold text-foreground truncate">{insights.topSportGrowing ?? "—"}</p>
              <p className="text-xs text-muted-foreground">modalidade com maior crescimento % no período</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Users className="h-4 w-4 text-violet-500" /> Novos organizadores</CardTitle></CardHeader>
            <CardContent>
              <p className="text-lg font-semibold text-foreground truncate">{insights.newOrganizers30d}</p>
              <p className="text-xs text-muted-foreground">entraram na rede nos últimos 30 dias</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Empty state geral */}
      {insights.arenasActive === 0 && insights.organizersActive === 0 && (
        <EmptyState
          icon={Building2}
          title="Sua rede ainda está vazia"
          description="Adicione a primeira arena, convide organizadores e crie um torneio para começar a operação."
          ctaLabel="Cadastrar arena"
          ctaHref="/tenant/arenas"
        />
      )}
    </div>
  );
};

export default TenantDashboard;
