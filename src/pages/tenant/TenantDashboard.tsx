import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Activity, Building2, Users, Store, DollarSign, Wallet, Clock, Trophy,
  AlertTriangle, ShieldAlert, Sparkles, Phone, Lightbulb, Zap, RefreshCw,
  ArrowRight, Network, Gauge, Globe,
} from "lucide-react";
import {
  fetchTenantTier, fetchUsageSummary, TIER_LABELS,
  type TenantTier, type UsageSummary,
} from "@/lib/autonomyTier";
import { UsageMeter } from "@/components/autonomy/UsageMeter";
import { OperationModeBanner } from "@/components/conversational/OperationModeBanner";
import { CommandExamplesCard } from "@/components/conversational/CommandExamplesCard";
import { CommandHistoryCard } from "@/components/conversational/CommandHistoryCard";
import { COMMANDS } from "@/lib/conversationalCommands";
import { RevenueDashboardPanel } from "@/components/revenue/RevenueDashboardPanel";
import { GrowthDashboardPanel } from "@/components/growth/GrowthDashboardPanel";
import { DollarSign as RevDollar } from "lucide-react";

// ─────────────── helpers locais (não exportados) ───────────────
const SectionHeader = ({
  icon, title, subtitle, accent = "primary",
}: { icon: ReactNode; title: string; subtitle?: string; accent?: "primary" | "emerald" | "amber" | "sky" | "violet" }) => {
  const accentMap: Record<string, string> = {
    primary: "bg-primary/15 text-primary",
    emerald: "bg-emerald-500/15 text-emerald-500",
    amber: "bg-amber-500/15 text-amber-500",
    sky: "bg-sky-500/15 text-sky-500",
    violet: "bg-violet-500/15 text-violet-500",
  };
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${accentMap[accent]}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-foreground leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground leading-tight">{subtitle}</p>}
      </div>
    </div>
  );
};

const KpiCard = ({
  label, value, icon, hint,
}: { label: string; value: ReactNode; icon: ReactNode; hint?: string }) => (
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

const ShortcutLink = ({ to, icon, label }: { to: string; icon: ReactNode; label: string }) => (
  <Button asChild variant="outline" size="sm" className="justify-start h-9">
    <Link to={to}>
      <span className="mr-2 text-muted-foreground">{icon}</span>
      {label}
      <ArrowRight className="ml-auto h-3.5 w-3.5 opacity-60" />
    </Link>
  </Button>
);

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

// ─────────────── página ───────────────
const TenantDashboard = () => {
  const { tenant, refresh } = useTenant();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [tier, setTier] = useState<TenantTier | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);

  const [arenas, setArenas] = useState<any[]>([]);
  const [arenaCount, setArenaCount] = useState({ total: 0, active: 0 });
  const [memberCount, setMemberCount] = useState(0);
  const [companyCount, setCompanyCount] = useState(0);

  const [revenue, setRevenue] = useState({ total: 0, settled: 0, pending: 0 });
  const [recentSplits, setRecentSplits] = useState<any[]>([]);

  const [opEvents, setOpEvents] = useState<any[]>([]);
  const [activeTournaments, setActiveTournaments] = useState(0);
  const [openOccurrences, setOpenOccurrences] = useState(0);

  const [policiesCount, setPoliciesCount] = useState(0);
  const [killSwitchActive, setKillSwitchActive] = useState(false);
  const [overdueCount, setOverdueCount] = useState(0);

  const load = async () => {
    if (!tenant) return;
    setLoading(true);

    // Arenas da rede
    const { data: arenaList } = await supabase
      .from("arenas")
      .select("id, name, slug, city, state, is_active, created_at")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false });
    const arenaArr = arenaList ?? [];
    setArenas(arenaArr.slice(0, 5));
    setArenaCount({
      total: arenaArr.length,
      active: arenaArr.filter((a: any) => a.is_active).length,
    });
    const arenaIds = arenaArr.map((a: any) => a.id);

    // Membros
    const { count: members } = await supabase
      .from("tenant_memberships")
      .select("user_id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id);
    setMemberCount(members ?? 0);

    // Empresas (companies não tem tenant_id em todos, conta por tenant se houver coluna)
    const { count: comps } = await supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id);
    setCompanyCount(comps ?? 0);

    // Receita canonical (do owner do tenant — primeiro owner como referência)
    const { data: ownerMembership } = await supabase
      .from("tenant_memberships")
      .select("user_id")
      .eq("tenant_id", tenant.id)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();
    const ownerId = (ownerMembership as any)?.user_id;
    if (ownerId) {
      const { data: balance } = await supabase
        .from("v_organizer_balances_canonical" as any)
        .select("*")
        .eq("organizer_id", ownerId)
        .maybeSingle();
      const b: any = balance || {};
      setRevenue({
        total: Number(b.gross_total || 0),
        settled: Number(b.settled_total || 0),
        pending: Number(b.pending_total || 0),
      });

      const { data: splits } = await supabase
        .from("transaction_splits")
        .select("id, amount, recipient_type, created_at, financial_transactions(source_type, paid_at, status)")
        .eq("recipient_type", "organizer")
        .eq("recipient_id", ownerId)
        .order("created_at", { ascending: false })
        .limit(5);
      setRecentSplits(splits ?? []);
    }

    // Eventos operacionais da rede
    if (arenaIds.length > 0) {
      const { data: events } = await supabase
        .from("arena_operational_events")
        .select("id, event_type, entity_type, source, created_at, arena_id")
        .in("arena_id", arenaIds)
        .order("created_at", { ascending: false })
        .limit(8);
      setOpEvents(events ?? []);

      // Torneios ativos por nome de arena (tournaments.arena é string match — herdado, ver pendência 11.6)
      const arenaNames = arenaArr.map((a: any) => a.name);
      const { count: tcount } = await (supabase as any)
        .from("tournaments")
        .select("id", { count: "exact", head: true })
        .in("arena", arenaNames)
        .in("status", ["upcoming", "in_progress", "registrations_open"]);
      setActiveTournaments(tcount ?? 0);

      // Ocorrências abertas
      const { count: occount } = await supabase
        .from("arena_occurrences")
        .select("id", { count: "exact", head: true })
        .in("arena_id", arenaIds)
        .eq("status", "open");
      setOpenOccurrences(occount ?? 0);

      // Inadimplência (cobranças overdue)
      const { count: ovcount } = await supabase
        .from("arena_billing_cycles")
        .select("id", { count: "exact", head: true })
        .in("arena_id", arenaIds)
        .eq("status", "overdue");
      setOverdueCount(ovcount ?? 0);
    }

    // Autonomy / IA
    const [t, u] = await Promise.all([
      fetchTenantTier(tenant.id),
      fetchUsageSummary(tenant.id),
    ]);
    setTier(t);
    setUsage(u);

    const { count: polCount } = await supabase
      .from("autonomy_policies")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .eq("is_enabled", true);
    setPoliciesCount(polCount ?? 0);

    const { data: ks } = await supabase
      .from("autonomy_kill_switches")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("is_active", true)
      .limit(1);
    setKillSwitchActive((ks?.length ?? 0) > 0);

    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tenant?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refresh(), load()]);
    setRefreshing(false);
  };

  if (!tenant) {
    return <p className="text-muted-foreground p-6">Carregando rede…</p>;
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 bg-muted/40 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted/40 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const usagePct = usage
    ? Math.max(usage.pct_calls, usage.pct_suggestions, usage.pct_auto)
    : 0;
  const usageWarning = usagePct >= 100 ? "limit" : usagePct >= 80 ? "near" : null;

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
              Control Tower da Rede
            </h1>
            <p className="text-xs text-muted-foreground leading-tight flex items-center gap-2 flex-wrap">
              <span className="truncate">{tenant.name}</span>
              {tier && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                  {TIER_LABELS[tier.tier]}
                </Badge>
              )}
              <span className="text-[10px] opacity-60">· /{tenant.slug}</span>
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* BLOCO 1 — CONTROL TOWER (DOMINANTE) */}
      <section className="rounded-xl border-l-2 border-primary bg-primary/5 p-5 space-y-4">
        <SectionHeader
          icon={<Gauge className="h-4 w-4" />}
          title="Visão executiva"
          subtitle="Indicadores principais da rede no mês"
          accent="primary"
        />

        {(killSwitchActive || usageWarning === "limit" || overdueCount > 0) && (
          <div className="space-y-2">
            {killSwitchActive && (
              <Alert className="border-destructive/50 bg-destructive/10">
                <ShieldAlert className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-foreground text-sm">
                  <strong>Kill switch ativo</strong> — autonomia pausada para esta rede.
                </AlertDescription>
              </Alert>
            )}
            {usageWarning === "limit" && (
              <Alert className="border-amber-500/50 bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-foreground text-sm">
                  Limite mensal de IA atingido. Ações estão sendo rebaixadas.
                </AlertDescription>
              </Alert>
            )}
            {overdueCount > 0 && (
              <Alert className="border-amber-500/50 bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-foreground text-sm">
                  <strong>{overdueCount}</strong> cobranças em atraso na rede.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Arenas" value={arenaCount.total} icon={<Building2 className="h-4 w-4" />} hint={`${arenaCount.active} ativas`} />
          <KpiCard label="Organizadores" value={memberCount} icon={<Users className="h-4 w-4" />} />
          <KpiCard label="Receita 30d" value={fmtBRL(revenue.total)} icon={<DollarSign className="h-4 w-4" />} hint={`${fmtBRL(revenue.settled)} liquidado`} />
          <KpiCard label="Chamadas IA" value={(usage?.total_calls ?? 0).toLocaleString("pt-BR")} icon={<Phone className="h-4 w-4" />} hint="este mês" />
          <KpiCard label="Auto-execuções" value={(usage?.total_auto_executed ?? 0).toLocaleString("pt-BR")} icon={<Zap className="h-4 w-4" />} hint="este mês" />
          <KpiCard label="Alertas abertos" value={openOccurrences + overdueCount} icon={<AlertTriangle className="h-4 w-4" />} hint={`${openOccurrences} ocorrências`} />
        </div>
      </section>

      {/* CAMADA CONVERSACIONAL */}
      <OperationModeBanner profile="tenant" />
      <CommandExamplesCard
        title="Operar pelo WhatsApp"
        subtitle="Comandos executivos para sua rede"
        examples={COMMANDS.tenant}
      />
      <CommandHistoryCard
        scope="tenant"
        scopeId={tenant.id}
        seeAllHref="/tenant/comandos"
      />

      {/* BLOCO 2 — REDE */}
      <section id="rede">
        <SectionHeader
          icon={<Building2 className="h-4 w-4" />}
          title="Rede"
          subtitle="Arenas, organizadores e empresas vinculadas"
          accent="sky"
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="bg-card border-border lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Arenas recentes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {arenas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma arena cadastrada ainda.</p>
              ) : (
                arenas.map((a) => (
                  <Link
                    key={a.id}
                    to={`/arenas/${a.slug}`}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{a.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{a.city}/{a.state}</p>
                    </div>
                    <Badge variant={a.is_active ? "secondary" : "outline"} className="text-[10px] shrink-0">
                      {a.is_active ? "ativa" : "inativa"}
                    </Badge>
                  </Link>
                ))
              )}
              <div className="pt-2">
                <Button asChild variant="ghost" size="sm" className="w-full">
                  <Link to="/tenant/arenas">Ver todas <ArrowRight className="ml-2 h-3.5 w-3.5" /></Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Empresas vinculadas</span>
                  <Store className="h-4 w-4 text-muted-foreground/60" />
                </div>
                <p className="text-2xl font-semibold tabular-nums">{companyCount}</p>
              </CardContent>
            </Card>
            <div className="grid grid-cols-1 gap-2">
              <ShortcutLink to="/tenant/membros" icon={<Users className="h-4 w-4" />} label="Organizadores" />
              <ShortcutLink to="/tenant/empresas" icon={<Store className="h-4 w-4" />} label="Empresas" />
            </div>
          </div>
        </div>
      </section>

      {/* BLOCO 3 — MONETIZAÇÃO */}
      <section id="monetizacao">
        <SectionHeader
          icon={<DollarSign className="h-4 w-4" />}
          title="Monetização"
          subtitle="Receita da rede, splits e fluxo financeiro"
          accent="emerald"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <KpiCard label="Receita total" value={fmtBRL(revenue.total)} icon={<DollarSign className="h-4 w-4" />} />
          <KpiCard label="Liquidado" value={fmtBRL(revenue.settled)} icon={<Wallet className="h-4 w-4" />} />
          <KpiCard label="A receber" value={fmtBRL(revenue.pending)} icon={<Clock className="h-4 w-4" />} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="bg-card border-border lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Últimas transações</CardTitle>
            </CardHeader>
            <CardContent>
              {recentSplits.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem transações recentes.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {recentSplits.map((s: any) => (
                    <li key={s.id} className="flex items-center justify-between py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {s.financial_transactions?.source_type === "enrollment" ? "Inscrição" :
                           s.financial_transactions?.source_type === "marketplace_order" ? "Marketplace" :
                           s.financial_transactions?.source_type === "booking" ? "Reserva" :
                           "Transação"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(s.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {fmtBRL(Number(s.amount || 0))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <div className="space-y-2">
            <ShortcutLink to="/tenant/financeiro" icon={<DollarSign className="h-4 w-4" />} label="Financeiro completo" />
            <ShortcutLink to="/tenant/pagamento" icon={<Wallet className="h-4 w-4" />} label="Conta de pagamento" />
          </div>
        </div>
      </section>

      {/* BLOCO 4 — OPERAÇÕES */}
      <section id="operacoes">
        <SectionHeader
          icon={<Activity className="h-4 w-4" />}
          title="Operações"
          subtitle="Eventos, torneios e ocorrências da rede"
          accent="amber"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <KpiCard label="Torneios ativos" value={activeTournaments} icon={<Trophy className="h-4 w-4" />} />
          <KpiCard label="Ocorrências abertas" value={openOccurrences} icon={<AlertTriangle className="h-4 w-4" />} />
          <KpiCard label="Cobranças em atraso" value={overdueCount} icon={<Clock className="h-4 w-4" />} />
        </div>
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Eventos operacionais recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {opEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem eventos recentes na rede.</p>
            ) : (
              <ul className="divide-y divide-border">
                {opEvents.map((e: any) => (
                  <li key={e.id} className="flex items-center justify-between py-2 gap-3">
                    <div className="min-w-0 flex items-center gap-2">
                      <Activity className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                      <span className="text-sm truncate">
                        <span className="font-medium">{e.event_type}</span>
                        <span className="text-muted-foreground"> · {e.entity_type}</span>
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {new Date(e.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* BLOCO 5 — AUTONOMIA / IA */}
      <section id="autonomia">
        <SectionHeader
          icon={<Sparkles className="h-4 w-4" />}
          title="IA / Autonomia"
          subtitle="Uso da ORKYM e políticas ativas na rede"
          accent="violet"
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="bg-card border-border lg:col-span-2">
            <CardContent className="p-5 space-y-4">
              {usage && (
                <>
                  <UsageMeter
                    label="Chamadas ORKYM"
                    used={usage.total_calls}
                    limit={usage.calls_limit}
                    projected={usage.projected_calls_eom}
                    icon={<Phone className="h-4 w-4" />}
                  />
                  <UsageMeter
                    label="Sugestões"
                    used={usage.total_suggestions}
                    limit={usage.suggestions_limit}
                    icon={<Lightbulb className="h-4 w-4" />}
                  />
                  <UsageMeter
                    label="Auto-execuções"
                    used={usage.total_auto_executed}
                    limit={usage.auto_limit}
                    icon={<Zap className="h-4 w-4" />}
                  />
                </>
              )}
            </CardContent>
          </Card>
          <div className="space-y-3">
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Políticas ativas</span>
                  <Sparkles className="h-4 w-4 text-muted-foreground/60" />
                </div>
                <p className="text-2xl font-semibold tabular-nums">{policiesCount}</p>
                <Badge variant={killSwitchActive ? "destructive" : "secondary"} className="text-[10px]">
                  {killSwitchActive ? "Kill switch ativo" : "Operando"}
                </Badge>
              </CardContent>
            </Card>
            <ShortcutLink to="/tenant/autonomia" icon={<Sparkles className="h-4 w-4" />} label="IA / Autonomia" />
            <ShortcutLink to="/tenant/dominios" icon={<Globe className="h-4 w-4" />} label="Domínios" />
          </div>
        </div>
      </section>

      {/* FASE 13 — Receita conversacional */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <RevDollar className="h-4 w-4 text-[#2BFF88]" />
          <h2 className="font-display text-xl tracking-wide">Receita via ORKYM</h2>
        </div>
        <p className="text-xs text-muted-foreground">Atribuição de receita gerada pelo WhatsApp · 30 dias</p>
        {tenant?.id && <RevenueDashboardPanel scope={{ type: "tenant", id: tenant.id }} />}
      </section>
    </div>
  );
};

export default TenantDashboard;
