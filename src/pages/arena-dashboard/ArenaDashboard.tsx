import { useEffect, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CalendarCheck, DollarSign, ArrowRight, Users, CalendarClock, Receipt,
  Trophy, TrendingUp, Activity, Wallet, QrCode, MessageCircle, CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { QrEntryCard } from "@/components/conversational/QrEntryCard";
import { cn } from "@/lib/utils";
import { NextStepsCard } from "@/components/arena/NextStepsCard";
import { useWhatsAppConnectionStatus } from "@/hooks/useWhatsAppConnection";

// ---------- Local UI helpers ----------

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

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

// ---------- Page ----------

const ArenaDashboard = () => {
  const { arena } = useOutletContext<{ arena: any }>();
  const wa = useWhatsAppConnectionStatus(arena?.id ? { scope_type: "arena", arena_id: arena.id } : null);
  const [stats, setStats] = useState({
    today: 0, week: 0, revenue: 0, students: 0, classesToday: 0,
    dueSoon: 0, overdue: 0, activeTournaments: 0, monthRevenue: 0,
  });
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

    const [todayRes, weekRes, upcomingRes, studentsRes, classesTodayRes, dueSoonRes, overdueRes, tasksListRes, activeTournRes, monthRevRes] = await Promise.all([
      supabase.from("bookings").select("id", { count: "exact", head: true }).eq("arena_id", arena.id).eq("booking_date", today).neq("status", "canceled"),
      supabase.from("bookings").select("id,amount", { count: "exact" }).eq("arena_id", arena.id).gte("booking_date", today).lte("booking_date", weekEnd).neq("status", "canceled"),
      supabase.from("bookings").select("*, courts(name)").eq("arena_id", arena.id).gte("booking_date", today).neq("status", "canceled").order("booking_date").order("start_time").limit(5),
      supabase.from("arena_students").select("id", { count: "exact", head: true }).eq("arena_id", arena.id).eq("status", "active"),
      supabase.from("arena_classes").select("id", { count: "exact", head: true }).eq("arena_id", arena.id).gte("start_at", dayStart.toISOString()).lte("start_at", dayEnd.toISOString()),
      supabase.from("arena_billing_cycles").select("id", { count: "exact", head: true }).eq("arena_id", arena.id).eq("status", "pending").lte("due_at", sevenDaysAhead),
      supabase.from("arena_billing_cycles").select("id", { count: "exact", head: true }).eq("arena_id", arena.id).eq("status", "overdue"),
      supabase.from("arena_operational_tasks").select("*").eq("arena_id", arena.id).eq("status", "open").order("priority").order("created_at", { ascending: false }).limit(1),
      supabase.from("tournaments").select("id", { count: "exact", head: true }).eq("arena", arena.name).gte("end_date", today),
      supabase.from("financial_transactions").select("total_amount").eq("arena_id", arena.id).eq("status", "paid").gte("paid_at", monthStart.toISOString()),
    ]);

    const weekRevenue = (weekRes.data || []).reduce((sum: number, b: any) => sum + Number(b.amount || 0), 0);
    const monthRevenue = (monthRevRes.data || []).reduce((sum: number, t: any) => sum + Number(t.total_amount || 0), 0);

    setStats({
      today: todayRes.count || 0,
      week: weekRes.count || 0,
      revenue: weekRevenue,
      students: studentsRes.count || 0,
      classesToday: classesTodayRes.count || 0,
      dueSoon: dueSoonRes.count || 0,
      overdue: overdueRes.count || 0,
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

  if (!arena) {
    return <p className="text-sm text-muted-foreground">Carregando arena…</p>;
  }

  const nextTask = tasks[0];
  const waConnected = wa.status === "connected";

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <header className="flex items-end justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-display text-foreground">
            Sua arena{arena?.name ? ` · ${arena.name}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Resumo de hoje</p>
        </div>
      </header>

      {arena?.id && <NextStepsCard arenaId={arena.id} />}

      {/* [1] HOJE NA SUA ARENA */}
      <section className="space-y-3">
        <SectionHeader icon={Activity} title="Hoje na sua arena" subtitle="O que está rolando agora" accent="text-blue-400" />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={CalendarCheck} label="Reservas hoje"   value={stats.today}             color="text-primary"     to="/arena/dashboard/agenda" />
          <KpiCard icon={CalendarClock} label="Aulas hoje"      value={stats.classesToday}      color="text-blue-400"    to="/arena/dashboard/aulas" />
          <KpiCard icon={QrCode}        label="Check-ins"       value="Abrir"                   color="text-cyan-400"    to="/arena/checkin" />
          <KpiCard icon={Trophy}        label="Torneios ativos" value={stats.activeTournaments} color="text-purple-400"  to="/arena/dashboard/torneios" />
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
      </section>

      {/* [2] SEU DINHEIRO */}
      <section className="space-y-3">
        <SectionHeader icon={Wallet} title="Seu dinheiro" subtitle="Como está o caixa" accent="text-emerald-400" />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={TrendingUp} label="Receita do mês" value={fmtBRL(stats.monthRevenue)} color="text-emerald-400" to="/arena/dashboard/financeiro" />
          <KpiCard icon={DollarSign} label="Recebimentos 7d" value={fmtBRL(stats.revenue)}      color="text-amber-400"   to="/arena/dashboard/transacoes" />
          <KpiCard icon={Receipt}    label="Vencimentos 7d"  value={stats.dueSoon}              color="text-amber-400"   to="/arena/dashboard/cobrancas" />
          <KpiCard icon={Receipt}    label="Pendências"      value={stats.overdue}              color="text-destructive" to="/arena/dashboard/cobrancas" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <ShortcutLink to="/arena/dashboard/cobrancas"   label="Cobranças" />
          <ShortcutLink to="/arena/dashboard/assinaturas" label="Assinaturas" />
          <ShortcutLink to="/arena/dashboard/transacoes"  label="Transações" />
        </div>
      </section>

      {/* [3] MOVIMENTO DA ARENA */}
      <section className="space-y-3">
        <SectionHeader icon={Users} title="Movimento da arena" subtitle="Quem está com você" accent="text-emerald-400" />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiCard icon={Users}         label="Alunos ativos" value={stats.students}     color="text-emerald-400" to="/arena/dashboard/alunos" />
          <KpiCard icon={CalendarClock} label="Aulas hoje"    value={stats.classesToday} color="text-blue-400"    to="/arena/dashboard/aulas" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <ShortcutLink to="/arena/dashboard/alunos"     label="Alunos" />
          <ShortcutLink to="/arena/dashboard/aulas"      label="Aulas" />
          <ShortcutLink to="/arena/dashboard/matriculas" label="Matrículas" />
        </div>
      </section>

      {/* [4] O QUE FAZER AGORA */}
      <section className="space-y-3">
        <SectionHeader icon={CheckCircle2} title="O que fazer agora" subtitle="Uma coisa de cada vez" accent="text-primary" />

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            {!nextTask ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Tudo em dia por aqui.
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{nextTask.title}</p>
                  {nextTask.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{nextTask.description}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="default" className="h-8 text-xs" onClick={() => updateTask(nextTask.id, "done")}>Feito</Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" onClick={() => updateTask(nextTask.id, "dismissed")}>Dispensar</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* [5] GERENCIE PELO WHATSAPP */}
      <section className="space-y-3">
        <SectionHeader icon={MessageCircle} title="Gerencie pelo WhatsApp" subtitle="Tudo na palma da mão" accent="text-[#2BFF88]" />

        <Card className="bg-card border-border">
          <CardContent className="p-5 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {waConnected ? "WhatsApp conectado" : "Receba alertas e gerencie sua arena pelo WhatsApp"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {waConnected ? "Você recebe avisos e pode responder direto pelo celular." : "Conecte seu número para receber resumos e responder rápido."}
              </p>
            </div>
            <Link to="/arena/connect-whatsapp">
              <Button size="sm" variant={waConnected ? "outline" : "default"} className="shrink-0">
                {waConnected ? "Gerenciar conexão" : "Conectar agora"}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>

      {/* [6] ENTRADA VIA QR */}
      <section className="space-y-3">
        <QrEntryCard
          title="Entrada via QR"
          subtitle="Check-in rápido em aulas, torneios e quadras"
          ctaTo="/arena/checkin"
          ctaLabel="Abrir check-in"
        />
      </section>
    </div>
  );
};

export default ArenaDashboard;
