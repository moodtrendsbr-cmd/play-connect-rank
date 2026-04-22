import { useEffect, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CalendarCheck, Grid3X3, DollarSign, ArrowRight, Users, CalendarClock, Receipt,
  AlertTriangle, Inbox, Bot, User as UserIcon, Cog, Trophy, TrendingUp,
  Gauge, Activity, Wallet, Sparkles, QrCode, ClipboardList,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { OrkymInsightsCard } from "@/components/orkym/InsightsCard";
import { OrkymActionsCard } from "@/components/orkym/OrkymActionsCard";
import { OperationModeBanner } from "@/components/conversational/OperationModeBanner";
import { CommandExamplesCard } from "@/components/conversational/CommandExamplesCard";
import { QrEntryCard } from "@/components/conversational/QrEntryCard";
import { COMMANDS } from "@/lib/conversationalCommands";
import { cn } from "@/lib/utils";

// ---------- Local UI helpers (not exported) ----------

const SectionHeader = ({
  icon: Icon, title, subtitle, accent = "text-primary",
}: { icon: any; title: string; subtitle?: string; accent?: string }) => (
  <div className="flex items-end justify-between gap-3">
    <div className="flex items-center gap-2">
      <Icon className={cn("h-5 w-5", accent)} />
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  </div>
);

const KpiCard = ({
  icon: Icon, label, value, color = "text-primary", to,
}: { icon: any; label: string; value: string | number; color?: string; to?: string }) => {
  const inner = (
    <Card className="bg-card border-border hover:border-primary/40 transition-colors h-full">
      <CardContent className="p-4 flex items-center gap-3">
        <Icon className={cn("h-7 w-7 shrink-0", color)} />
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-bold text-foreground truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
};

const ShortcutLink = ({ to, label }: { to: string; label: string }) => (
  <Link
    to={to}
    className="flex items-center justify-between p-3 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors"
  >
    <span className="text-sm font-medium text-foreground">{label}</span>
    <ArrowRight className="h-4 w-4 text-muted-foreground" />
  </Link>
);

// ---------- Page ----------

const ArenaDashboard = () => {
  const { arena } = useOutletContext<{ arena: any }>();
  const [stats, setStats] = useState({ today: 0, week: 0, revenue: 0, courts: 0, students: 0, classesToday: 0, dueSoon: 0, overdue: 0, openOcc: 0, openTasks: 0, activeTournaments: 0, monthRevenue: 0 });
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);

  const load = async () => {
    if (!arena) return;
    const today = format(new Date(), "yyyy-MM-dd");
    const weekEnd = format(new Date(Date.now() + 7 * 86400000), "yyyy-MM-dd");
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(); dayEnd.setHours(23, 59, 59, 999);
    const sevenDaysAhead = new Date(Date.now() + 7 * 86400000).toISOString();
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

    const [todayRes, weekRes, courtsRes, upcomingRes, studentsRes, classesTodayRes, dueSoonRes, overdueRes, openOccRes, openTasksRes, tasksListRes, activeTournRes, monthRevRes] = await Promise.all([
      supabase.from("bookings").select("id", { count: "exact", head: true }).eq("arena_id", arena.id).eq("booking_date", today).neq("status", "canceled"),
      supabase.from("bookings").select("id,amount", { count: "exact" }).eq("arena_id", arena.id).gte("booking_date", today).lte("booking_date", weekEnd).neq("status", "canceled"),
      supabase.from("courts").select("id", { count: "exact", head: true }).eq("arena_id", arena.id),
      supabase.from("bookings").select("*, courts(name)").eq("arena_id", arena.id).gte("booking_date", today).neq("status", "canceled").order("booking_date").order("start_time").limit(5),
      supabase.from("arena_students").select("id", { count: "exact", head: true }).eq("arena_id", arena.id).eq("status", "active"),
      supabase.from("arena_classes").select("id", { count: "exact", head: true }).eq("arena_id", arena.id).gte("start_at", dayStart.toISOString()).lte("start_at", dayEnd.toISOString()),
      supabase.from("arena_billing_cycles").select("id", { count: "exact", head: true }).eq("arena_id", arena.id).eq("status", "pending").lte("due_at", sevenDaysAhead),
      supabase.from("arena_billing_cycles").select("id", { count: "exact", head: true }).eq("arena_id", arena.id).eq("status", "overdue"),
      supabase.from("arena_occurrences").select("id", { count: "exact", head: true }).eq("arena_id", arena.id).in("status", ["open", "in_progress"]),
      supabase.from("arena_operational_tasks").select("id", { count: "exact", head: true }).eq("arena_id", arena.id).eq("status", "open"),
      supabase.from("arena_operational_tasks").select("*").eq("arena_id", arena.id).eq("status", "open").order("priority").order("created_at", { ascending: false }).limit(5),
      supabase.from("tournaments").select("id", { count: "exact", head: true }).eq("arena", arena.name).gte("end_date", today),
      supabase.from("financial_transactions").select("total_amount").eq("arena_id", arena.id).eq("status", "paid").gte("paid_at", monthStart.toISOString()),
    ]);

    const weekRevenue = (weekRes.data || []).reduce((sum: number, b: any) => sum + Number(b.amount || 0), 0);
    const monthRevenue = (monthRevRes.data || []).reduce((sum: number, t: any) => sum + Number(t.total_amount || 0), 0);

    setStats({
      today: todayRes.count || 0,
      week: weekRes.count || 0,
      revenue: weekRevenue,
      courts: courtsRes.count || 0,
      students: studentsRes.count || 0,
      classesToday: classesTodayRes.count || 0,
      dueSoon: dueSoonRes.count || 0,
      overdue: overdueRes.count || 0,
      openOcc: openOccRes.count || 0,
      openTasks: openTasksRes.count || 0,
      activeTournaments: activeTournRes.count || 0,
      monthRevenue,
    });
    setUpcoming(upcomingRes.data || []);
    setTasks(tasksListRes.data || []);
  };

  useEffect(() => { load(); }, [arena]);

  const updateTask = async (id: string, status: "done" | "dismissed") => {
    const { error } = await supabase.from("arena_operational_tasks").update({
      status, resolved_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "done" ? "Tarefa concluída" : "Tarefa dispensada");
    load();
  };

  const sourceIcon = (s: string) => s === "orkym" ? Bot : s === "manual" ? UserIcon : Cog;
  const sourceLabel = (s: string) => s === "orkym" ? "ORKYM" : s === "manual" ? "Manual" : "Sistema";

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <header className="flex items-end justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Gauge className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-display text-foreground">Control Tower</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {arena?.name ? `Central de operação · ${arena.name}` : "Central de operação"}
          </p>
        </div>
      </header>

      {/* BLOCO 1 — CONTROL TOWER (DOMINANTE) */}
      <section className="space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 md:p-5">
        <SectionHeader
          icon={Sparkles}
          title="Control Tower"
          subtitle="ORKYM · alertas · ações pendentes · pendências operacionais"
        />

        {arena?.id && arena?.tenant_id && (
          <OrkymInsightsCard tenantId={arena.tenant_id} arenaId={arena.id} />
        )}

        {arena?.id && arena?.tenant_id && (
          <OrkymActionsCard tenantId={arena.tenant_id} arenaId={arena.id} />
        )}

        <Card id="tasks" className="bg-card border-border">
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-medium">Caixa de pendências operacionais</CardTitle>
            <span className="text-xs text-muted-foreground">{tasks.length} aberta(s)</span>
          </CardHeader>
          <CardContent className="space-y-2">
            {tasks.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma pendência. ORKYM populará aqui sugestões e ações operacionais.</p>}
            {tasks.map((t) => {
              const SourceIcon = sourceIcon(t.source);
              return (
                <div key={t.id} className="flex items-start justify-between gap-2 p-3 rounded-lg bg-muted/30">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-background/60 text-muted-foreground inline-flex items-center gap-1">
                        <SourceIcon className="h-2.5 w-2.5" /> {sourceLabel(t.source)}
                      </span>
                      {t.occurrence_id && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive inline-flex items-center gap-1">
                          <AlertTriangle className="h-2.5 w-2.5" /> do incidente
                        </span>
                      )}
                    </div>
                    {t.description && <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => updateTask(t.id, "done")}>Feito</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => updateTask(t.id, "dismissed")}>Dispensar</Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      {/* CAMADA CONVERSACIONAL */}
      <OperationModeBanner profile="arena" />
      <div className="grid md:grid-cols-2 gap-4">
        <CommandExamplesCard
          title="Operar pelo WhatsApp"
          subtitle="Comandos rápidos para a operação da arena"
          examples={COMMANDS.arena}
        />
        <QrEntryCard
          title="Entrada física por QR"
          subtitle="Check-in de aulas, torneios e quadras"
          ctaTo="/arena/checkin"
          ctaLabel="Abrir check-in"
        />
      </div>

      {/* BLOCO 2 — OPERAÇÃO DO DIA */}
      <section className="space-y-3">
        <SectionHeader icon={Activity} title="Operação do dia" subtitle="O que está acontecendo agora" accent="text-blue-400" />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={CalendarCheck} label="Reservas hoje"   value={stats.today}        color="text-primary" />
          <KpiCard icon={CalendarClock} label="Aulas hoje"      value={stats.classesToday} color="text-blue-400" />
          <KpiCard icon={Grid3X3}       label="Quadras"         value={stats.courts}       color="text-cyan-400" />
          <KpiCard icon={Users}         label="Alunos ativos"   value={stats.students}     color="text-emerald-400" to="/arena/dashboard/alunos" />
        </div>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Próximas reservas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma reserva próxima</p>}
            {upcoming.map((b) => (
              <div key={b.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                <div>
                  <p className="text-sm font-medium text-foreground">{b.courts?.name} — {b.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(b.booking_date), "dd/MM")} • {String(b.start_time).slice(0, 5)} - {String(b.end_time).slice(0, 5)}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.status === "confirmed" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {b.status === "confirmed" ? "Confirmada" : b.status === "completed" ? "Concluída" : b.status}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiCard icon={QrCode}         label="Check-in"             value="Abrir" color="text-primary"     to="/arena/checkin" />
          <KpiCard icon={AlertTriangle}  label="Ocorrências abertas"  value={stats.openOcc} color="text-amber-400" to="/arena/dashboard/ocorrencias" />
          <KpiCard icon={ClipboardList}  label="Matrículas"           value="Gerir" color="text-emerald-400" to="/arena/dashboard/matriculas" />
        </div>
      </section>

      {/* BLOCO 3 — FINANCEIRO */}
      <section className="space-y-3">
        <SectionHeader icon={Wallet} title="Financeiro" subtitle="Visão rápida" accent="text-emerald-400" />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={TrendingUp} label="Receita do mês"   value={`R$ ${stats.monthRevenue.toFixed(2)}`} color="text-emerald-400" to="/arena/dashboard/financeiro" />
          <KpiCard icon={DollarSign} label="Receita 7 dias"   value={`R$ ${stats.revenue.toFixed(2)}`}      color="text-amber-400"   to="/arena/dashboard/transacoes" />
          <KpiCard icon={Receipt}    label="Vencimentos 7d"   value={stats.dueSoon}                         color="text-amber-400"   to="/arena/dashboard/cobrancas" />
          <KpiCard icon={Receipt}    label="Inadimplência"    value={stats.overdue}                         color="text-destructive" to="/arena/dashboard/cobrancas" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <ShortcutLink to="/arena/dashboard/cobrancas"   label="Cobranças (mensalidades)" />
          <ShortcutLink to="/arena/dashboard/assinaturas" label="Assinaturas" />
          <ShortcutLink to="/arena/dashboard/transacoes"  label="Transações" />
        </div>
      </section>

      {/* BLOCO 4 — TORNEIOS */}
      <section className="space-y-3">
        <SectionHeader icon={Trophy} title="Torneios" subtitle="Estado competitivo" accent="text-purple-400" />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiCard icon={Trophy} label="Torneios ativos" value={stats.activeTournaments} color="text-purple-400" to="/arena/dashboard/torneios" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <ShortcutLink to="/arena/dashboard/torneios" label="Gerir torneios" />
          <ShortcutLink to="/arena/checkin"            label="Check-in de torneios" />
          <ShortcutLink to="/arena/dashboard/horarios" label="Horários e quadras" />
        </div>
      </section>

      {/* BLOCO 5 — GROWTH */}
      <section className="space-y-3">
        <SectionHeader icon={Sparkles} title="Growth" subtitle="Crescimento e visibilidade" accent="text-pink-400" />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <ShortcutLink to="/arena/dashboard/patrocinios" label="Patrocínios" />
          <ShortcutLink to="/marketplace"                 label="Marketplace" />
          <ShortcutLink to="/arena/dashboard/acoes-ia"    label="Sugestões da ORKYM" />
        </div>
      </section>
    </div>
  );
};

export default ArenaDashboard;
