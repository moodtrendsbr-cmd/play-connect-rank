import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Trophy,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  GitBranch,
  DollarSign,
  Plus,
  RefreshCcw,
  PlayCircle,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { OperationModeBanner } from "@/components/conversational/OperationModeBanner";
import { CommandExamplesCard } from "@/components/conversational/CommandExamplesCard";
import { QrEntryCard } from "@/components/conversational/QrEntryCard";
import { COMMANDS } from "@/lib/conversationalCommands";

// ----- Helpers (locais, não exportados) -----
const SectionHeader = ({
  icon: Icon,
  title,
  subtitle,
  action,
  id,
}: {
  icon: any;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  id?: string;
}) => (
  <div id={id} className="flex items-end justify-between gap-3 scroll-mt-20">
    <div className="flex items-center gap-3">
      <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <h2 className="text-lg font-semibold leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

const KpiCard = ({
  label,
  value,
  icon: Icon,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  icon: any;
  hint?: string;
  tone?: "default" | "primary" | "warning" | "success";
}) => {
  const toneClass =
    tone === "primary"
      ? "text-primary"
      : tone === "warning"
        ? "text-amber-500"
        : tone === "success"
          ? "text-emerald-500"
          : "text-foreground";
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </CardTitle>
        <Icon className={`h-4 w-4 ${toneClass}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
        {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
};

const ShortcutLink = ({
  to,
  label,
  icon: Icon,
}: {
  to: string;
  label: string;
  icon: any;
}) => (
  <Button variant="outline" size="sm" asChild className="h-8">
    <Link to={to}>
      <Icon className="mr-2 h-3.5 w-3.5" />
      {label}
    </Link>
  </Button>
);

// ----- Página -----
const OrganizerDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);

      // Torneios do organizador + enrollments aninhadas
      const { data: tourns } = await supabase
        .from("tournaments")
        .select("*, enrollments(id, status, created_at, user_id)")
        .eq("organizer_id", user.id)
        .order("start_date", { ascending: false });

      const tournList = tourns || [];
      setTournaments(tournList);

      // Inscrições agregadas (achatar)
      const allEnrollments = tournList.flatMap((t: any) =>
        (t.enrollments || []).map((e: any) => ({
          ...e,
          tournament_id: t.id,
          tournament_name: t.name,
          entry_fee: t.entry_fee,
        }))
      );
      // Mais recentes primeiro
      allEnrollments.sort(
        (a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setEnrollments(allEnrollments);

      // Próximas partidas (modalities → matches) — mesmo padrão de Brackets.tsx
      const tournIds = tournList.map((t: any) => t.id);
      if (tournIds.length > 0) {
        const { data: mods } = await supabase
          .from("tournament_modalities")
          .select("id, name, tournament_id")
          .in("tournament_id", tournIds);
        const modIds = (mods || []).map((m: any) => m.id);
        if (modIds.length > 0) {
          const { data: matches } = await (supabase as any)
            .from("match_results")
            .select("id, modality_id, status, created_at, scheduled_at")
            .in("modality_id", modIds)
            .order("created_at", { ascending: false })
            .limit(8);
          const modMap: Record<string, any> = {};
          (mods || []).forEach((m: any) => {
            modMap[m.id] = m;
          });
          const tournMap: Record<string, any> = {};
          tournList.forEach((t: any) => {
            tournMap[t.id] = t;
          });
          setRecentMatches(
            (matches || []).map((m: any) => ({
              ...m,
              modality_name: modMap[m.modality_id]?.name,
              tournament_id: modMap[m.modality_id]?.tournament_id,
              tournament_name:
                tournMap[modMap[m.modality_id]?.tournament_id]?.name,
            }))
          );
        }
      }

      setLoading(false);
    };
    load();
  }, [user, refreshKey]);

  // ----- KPIs derivados -----
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const activeTourns = tournaments.filter((t: any) => {
    const s = new Date(t.start_date);
    const e = new Date(t.end_date);
    return s <= now && now <= e;
  });
  const upcomingTourns = tournaments.filter(
    (t: any) => new Date(t.start_date) > now
  );
  const pastTourns = tournaments.filter(
    (t: any) => new Date(t.end_date) < now
  );

  const enrollmentsToday = enrollments.filter(
    (e: any) => (e.created_at || "").slice(0, 10) === todayStr
  ).length;
  const totalEnrollments = enrollments.length;
  const pendingEnrollments = enrollments.filter(
    (e: any) => e.status === "pending"
  ).length;
  const paidEnrollments = enrollments.filter(
    (e: any) => e.status === "paid"
  ).length;
  const confirmedEnrollments = enrollments.filter((e: any) =>
    ["confirmed", "checked_in"].includes(e.status)
  ).length;
  const checkinDone = enrollments.filter(
    (e: any) => e.status === "checked_in"
  ).length;

  const upcomingMatches = recentMatches.filter(
    (m: any) => m.status !== "completed"
  );

  // Alertas: torneios sem categorias / sem partidas
  const alerts: { type: string; message: string; to?: string }[] = [];
  activeTourns.forEach((t: any) => {
    if ((t.enrollments || []).length === 0) {
      alerts.push({
        type: "warning",
        message: `"${t.name}" está ativo mas sem inscrições`,
        to: `/tournaments/${t.id}/manage`,
      });
    }
  });
  upcomingTourns.slice(0, 3).forEach((t: any) => {
    const startsIn = Math.ceil(
      (new Date(t.start_date).getTime() - now.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    if (startsIn <= 7 && (t.enrollments || []).length < 4) {
      alerts.push({
        type: "warning",
        message: `"${t.name}" começa em ${startsIn}d com poucas inscrições`,
        to: `/tournaments/${t.id}/manage`,
      });
    }
  });

  // Receita estimada por torneio (entry_fee × paid)
  const revenueByTourn = tournaments
    .map((t: any) => {
      const paid = (t.enrollments || []).filter(
        (e: any) => e.status === "paid"
      ).length;
      return {
        id: t.id,
        name: t.name,
        revenue: paid * Number(t.entry_fee || 0),
        occupancy: (t.enrollments || []).length,
        max: t.max_participants || 0,
      };
    })
    .sort((a: any, b: any) => b.revenue - a.revenue)
    .slice(0, 5);

  if (loading) {
    return (
      <div className="space-y-4 p-2">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted/40 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl">
      {/* HEADER */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Event Control Tower
          </p>
          <h1 className="text-2xl md:text-3xl font-bold leading-tight">
            Operação de eventos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão executiva dos seus torneios, inscrições e jogos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey((k) => k + 1)}
          >
            <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Atualizar
          </Button>
          <Button size="sm" asChild>
            <Link to="/tournaments/create">
              <Plus className="mr-2 h-3.5 w-3.5" /> Criar evento
            </Link>
          </Button>
        </div>
      </div>

      {/* BLOCO 1 — EVENT CONTROL TOWER */}
      <section className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard
            label="Eventos ativos"
            value={activeTourns.length}
            icon={PlayCircle}
            tone="primary"
            hint="acontecendo agora"
          />
          <KpiCard
            label="Próximos"
            value={upcomingTourns.length}
            icon={Calendar}
            hint="agendados"
          />
          <KpiCard
            label="Inscritos hoje"
            value={enrollmentsToday}
            icon={Users}
            tone="success"
          />
          <KpiCard
            label="Check-in pendente"
            value={Math.max(paidEnrollments - checkinDone, 0)}
            icon={Clock}
            tone="warning"
          />
          <KpiCard
            label="Partidas próximas"
            value={upcomingMatches.length}
            icon={GitBranch}
          />
          <KpiCard
            label="Alertas"
            value={alerts.length}
            icon={AlertTriangle}
            tone={alerts.length > 0 ? "warning" : "default"}
          />
        </div>

        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.slice(0, 3).map((a, i) => (
              <Alert key={i} className="py-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertDescription className="flex items-center justify-between gap-3">
                  <span className="text-sm">{a.message}</span>
                  {a.to && (
                    <Button variant="ghost" size="sm" asChild className="h-7">
                      <Link to={a.to}>
                        Resolver <ChevronRight className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}
      </section>

      {/* CAMADA CONVERSACIONAL */}
      <OperationModeBanner profile="organizer" />
      <div className="grid md:grid-cols-2 gap-4">
        <CommandExamplesCard
          title="Operar pelo WhatsApp"
          subtitle="Comandos rápidos para gerir seus eventos"
          examples={COMMANDS.organizer}
        />
        <QrEntryCard
          title="Check-in dos eventos"
          subtitle="Confirme presença de atletas via QR"
          ctaTo="/organizer/dashboard/jogos"
          ctaLabel="Abrir check-in dos jogos"
        />
      </div>

      {/* BLOCO 2 — MEUS EVENTOS */}
      <section className="space-y-3">
        <SectionHeader
          id="eventos"
          icon={Trophy}
          title="Meus eventos"
          subtitle={`${tournaments.length} no total · ${activeTourns.length} ativos · ${upcomingTourns.length} próximos`}
          action={
            <Button variant="outline" size="sm" asChild>
              <Link to="/tournaments">
                Ver todos <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          }
        />
        {tournaments.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Você ainda não criou nenhum evento.
            </p>
            <Button asChild>
              <Link to="/tournaments/create">
                <Plus className="mr-2 h-4 w-4" /> Criar primeiro evento
              </Link>
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {tournaments.slice(0, 6).map((t: any) => {
              const enrCount = (t.enrollments || []).length;
              const isActive =
                new Date(t.start_date) <= now && now <= new Date(t.end_date);
              const isUpcoming = new Date(t.start_date) > now;
              return (
                <Card
                  key={t.id}
                  className="hover:border-primary/40 transition-colors"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-tight">
                        {t.name}
                      </CardTitle>
                      <Badge
                        variant={
                          isActive
                            ? "default"
                            : isUpcoming
                              ? "secondary"
                              : "outline"
                        }
                        className="shrink-0 text-[10px]"
                      >
                        {isActive ? "Ativo" : isUpcoming ? "Em breve" : "Encerrado"}
                      </Badge>
                    </div>
                    {t.arena && (
                      <p className="text-xs text-muted-foreground">
                        🏟️ {t.arena}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        📅 {t.start_date} → {t.end_date}
                      </span>
                      <span className="font-medium text-foreground">
                        {enrCount} inscritos
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <ShortcutLink
                        to={`/tournaments/${t.id}/manage`}
                        label="Gerenciar"
                        icon={Trophy}
                      />
                      <ShortcutLink
                        to={`/tournaments/${t.id}/brackets`}
                        label="Brackets"
                        icon={GitBranch}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* BLOCO 3 — INSCRIÇÕES */}
      <section className="space-y-3">
        <SectionHeader
          id="inscricoes"
          icon={Users}
          title="Inscrições"
          subtitle="Resumo agregado de todos os eventos"
        />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard label="Total" value={totalEnrollments} icon={Users} />
          <KpiCard
            label="Pendentes"
            value={pendingEnrollments}
            icon={Clock}
            tone="warning"
          />
          <KpiCard
            label="Pagas"
            value={paidEnrollments}
            icon={CheckCircle2}
            tone="success"
          />
          <KpiCard
            label="Confirmadas"
            value={confirmedEnrollments}
            icon={CheckCircle2}
            tone="primary"
          />
          <KpiCard
            label="Check-in feito"
            value={checkinDone}
            icon={CheckCircle2}
          />
        </div>
        {enrollments.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Últimas inscrições</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="divide-y divide-border">
                {enrollments.slice(0, 5).map((e: any) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{e.tournament_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(e.created_at).toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                    <Badge
                      variant={
                        e.status === "paid"
                          ? "default"
                          : e.status === "pending"
                            ? "secondary"
                            : "outline"
                      }
                      className="text-[10px]"
                    >
                      {e.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {/* BLOCO 4 — OPERAÇÃO DE JOGOS */}
      <section className="space-y-3">
        <SectionHeader
          id="jogos"
          icon={GitBranch}
          title="Operação de jogos"
          subtitle="Brackets, partidas e check-in dos eventos em andamento"
        />
        {activeTourns.length === 0 && upcomingTourns.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Nenhum evento em andamento.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Eventos em andamento</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {activeTourns.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nenhum evento ativo agora.
                  </p>
                ) : (
                  activeTourns.slice(0, 5).map((t: any) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-2 py-1.5 border-b border-border last:border-0"
                    >
                      <span className="text-sm truncate">{t.name}</span>
                      <div className="flex gap-1.5 shrink-0">
                        <ShortcutLink
                          to={`/tournaments/${t.id}/brackets`}
                          label="Brackets"
                          icon={GitBranch}
                        />
                        <ShortcutLink
                          to={`/tournaments/${t.id}/results`}
                          label="Resultados"
                          icon={Trophy}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card id="checkin">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Partidas recentes</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {recentMatches.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma partida registrada ainda.
                  </p>
                ) : (
                  <div className="divide-y divide-border">
                    {recentMatches.slice(0, 5).map((m: any) => (
                      <Link
                        key={m.id}
                        to={`/tournaments/${m.tournament_id}/brackets`}
                        className="flex items-center justify-between py-2 text-sm hover:text-primary"
                      >
                        <div className="min-w-0">
                          <p className="truncate">{m.tournament_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {m.modality_name}
                          </p>
                        </div>
                        <Badge
                          variant={
                            m.status === "completed" ? "default" : "secondary"
                          }
                          className="text-[10px]"
                        >
                          {m.status || "pending"}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </section>

      {/* BLOCO 5 — PERFORMANCE */}
      <section className="space-y-3">
        <SectionHeader
          id="performance"
          icon={TrendingUp}
          title="Performance"
          subtitle="Receita estimada e ocupação por evento"
          action={
            <Button variant="outline" size="sm" asChild>
              <Link to="/organizer/dashboard/financeiro">
                <DollarSign className="mr-1.5 h-3.5 w-3.5" /> Financeiro
              </Link>
            </Button>
          }
        />
        {revenueByTourn.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Sem dados de performance ainda.
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-2">
                {revenueByTourn.map((r: any) => {
                  const pct = r.max > 0 ? Math.min((r.occupancy / r.max) * 100, 100) : 0;
                  return (
                    <div key={r.id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate">{r.name}</span>
                        <span className="font-medium tabular-nums">
                          R$ {r.revenue.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-muted-foreground tabular-nums w-16 text-right">
                          {r.occupancy}
                          {r.max > 0 ? `/${r.max}` : ""}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <span>{pastTourns.length} eventos encerrados no histórico</span>
                <Link
                  to="/organizer/dashboard/financeiro"
                  className="text-primary hover:underline"
                >
                  Ver financeiro completo →
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
};

export default OrganizerDashboard;
