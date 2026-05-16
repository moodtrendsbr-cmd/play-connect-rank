import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { NextStepsCard } from "@/components/arena/NextStepsCard";
import { QuickActionsBar } from "@/components/arena/QuickActionsBar";
import { NowBlock } from "@/components/arena/NowBlock";
import { NextHoursBlock, type AgendaItem } from "@/components/arena/NextHoursBlock";
import { AttentionBlock, type AttentionItem } from "@/components/arena/AttentionBlock";
import { useWhatsAppConnectionStatus } from "@/hooks/useWhatsAppConnection";

const hhmm = (t: string) => String(t).slice(0, 5);
const isoHHMM = (iso: string) => format(new Date(iso), "HH:mm");

const ArenaDashboard = () => {
  const { arena } = useOutletContext<{ arena: any }>();
  const wa = useWhatsAppConnectionStatus(
    arena?.id ? { scope_type: "arena", arena_id: arena.id } : null,
  );

  const [nowData, setNowData] = useState({
    occupiedCourts: [] as { id: string; court: string; customer: string; endTime: string }[],
    totalCourts: 0,
    liveClasses: [] as { id: string; title: string; instructor?: string }[],
    recentCheckins: 0,
    nextBooking: null as { court: string; startTime: string; customer: string } | null,
  });
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [attention, setAttention] = useState<AttentionItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!arena?.id) return;
    setRefreshing(true);

    const now = new Date();
    const today = format(now, "yyyy-MM-dd");
    const nowTime = format(now, "HH:mm:ss");
    const in60min = new Date(now.getTime() + 60 * 60 * 1000);
    const in6h = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const last30min = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
    const last21d = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000).toISOString();
    const dayEnd = new Date(); dayEnd.setHours(23, 59, 59, 999);

    const [
      todayBookingsRes, courtsRes, liveClassesRes, recentCheckinsRes,
      todayClassesRes, todayTournRes, overdueRes, dueSoonRes, pendingBookingsRes,
      upcomingTournRes, studentsActiveRes, recentAttRes,
    ] = await Promise.all([
      supabase
        .from("bookings")
        .select("id,booking_date,start_time,end_time,customer_name,status,courts(name)")
        .eq("arena_id", arena.id)
        .eq("booking_date", today)
        .neq("status", "canceled")
        .order("start_time"),
      supabase.from("courts").select("id", { count: "exact", head: true }).eq("arena_id", arena.id),
      supabase
        .from("arena_classes")
        .select("id,title,instructor_id,start_at,end_at,arena_instructors(full_name)")
        .eq("arena_id", arena.id)
        .lte("start_at", now.toISOString())
        .gte("end_at", now.toISOString())
        .limit(10),
      supabase
        .from("arena_attendance")
        .select("id", { count: "exact", head: true })
        .eq("arena_id", arena.id)
        .gte("checked_in_at", last30min),
      supabase
        .from("arena_classes")
        .select("id,title,start_at,end_at")
        .eq("arena_id", arena.id)
        .gt("start_at", now.toISOString())
        .lte("start_at", in6h.toISOString())
        .order("start_at")
        .limit(8),
      supabase
        .from("tournaments")
        .select("id,name,start_date")
        .eq("arena", arena.name)
        .eq("start_date", today)
        .limit(5),
      supabase
        .from("arena_billing_cycles")
        .select("id", { count: "exact", head: true })
        .eq("arena_id", arena.id)
        .eq("status", "overdue"),
      supabase
        .from("arena_billing_cycles")
        .select("id", { count: "exact", head: true })
        .eq("arena_id", arena.id)
        .eq("status", "pending")
        .lte("due_at", in48h.toISOString()),
      supabase
        .from("bookings")
        .select("id,created_at,status,booking_date")
        .eq("arena_id", arena.id)
        .eq("status", "pending_payment")
        .eq("booking_date", today)
        .lte("created_at", new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString())
        .limit(5),
      supabase
        .from("tournaments")
        .select("id,name,start_date,max_slots")
        .eq("arena", arena.name)
        .gte("start_date", today)
        .lte("start_date", format(in7d, "yyyy-MM-dd"))
        .limit(10),
      supabase
        .from("arena_students")
        .select("id", { count: "exact", head: true })
        .eq("arena_id", arena.id)
        .eq("status", "active"),
      supabase
        .from("arena_attendance")
        .select("student_id")
        .eq("arena_id", arena.id)
        .gte("checked_in_at", last21d),
    ]);

    // ===== AGORA =====
    const allToday = todayBookingsRes.data || [];
    const occupied = allToday
      .filter((b: any) => hhmm(b.start_time) <= nowTime.slice(0, 5) && hhmm(b.end_time) > nowTime.slice(0, 5))
      .map((b: any) => ({
        id: b.id,
        court: b.courts?.name || "Quadra",
        customer: b.customer_name || "Reserva",
        endTime: hhmm(b.end_time),
      }));

    const upcomingNext = allToday.find(
      (b: any) => hhmm(b.start_time) > nowTime.slice(0, 5) && new Date(`${today}T${b.start_time}`) <= in60min,
    );

    setNowData({
      occupiedCourts: occupied,
      totalCourts: courtsRes.count || 0,
      liveClasses: (liveClassesRes.data || []).map((c: any) => ({
        id: c.id,
        title: c.title,
        instructor: c.arena_instructors?.full_name,
      })),
      recentCheckins: recentCheckinsRes.count || 0,
      nextBooking: upcomingNext
        ? {
            court: (upcomingNext as any).courts?.name || "Quadra",
            startTime: hhmm((upcomingNext as any).start_time),
            customer: (upcomingNext as any).customer_name || "Reserva",
          }
        : null,
    });

    // ===== PRÓXIMAS HORAS =====
    const futureBookings: AgendaItem[] = allToday
      .filter((b: any) => hhmm(b.start_time) > nowTime.slice(0, 5) && new Date(`${today}T${b.start_time}`) <= in6h)
      .map((b: any) => ({
        id: b.id,
        kind: "booking",
        time: hhmm(b.start_time),
        title: b.courts?.name || "Quadra",
        subtitle: b.customer_name,
        to: "/arena/dashboard/reservas",
      }));

    const futureClasses: AgendaItem[] = (todayClassesRes.data || []).map((c: any) => ({
      id: c.id,
      kind: "class",
      time: isoHHMM(c.start_at),
      title: c.title,
      to: "/arena/dashboard/aulas",
    }));

    const todayTournaments: AgendaItem[] = (todayTournRes.data || []).map((t: any) => ({
      id: t.id,
      kind: "tournament",
      time: "—",
      title: t.name,
      subtitle: "começa hoje",
      to: `/manage-tournament/${t.id}`,
    }));

    const merged = [...futureBookings, ...futureClasses, ...todayTournaments]
      .sort((a, b) => a.time.localeCompare(b.time))
      .slice(0, 8);
    setAgenda(merged);

    // ===== ATENÇÃO =====
    const items: AttentionItem[] = [];

    const overdue = overdueRes.count || 0;
    if (overdue > 0) {
      items.push({
        key: "overdue",
        severity: "alert",
        title: `${overdue} cobrança${overdue > 1 ? "s" : ""} em atraso`,
        context: "Pagamentos não recebidos no vencimento.",
        actionLabel: "Ver cobranças",
        to: "/arena/dashboard/financeiro",
      });
    }

    const dueSoon = dueSoonRes.count || 0;
    if (dueSoon > 0) {
      items.push({
        key: "due-soon",
        severity: "warn",
        title: `${dueSoon} cobrança${dueSoon > 1 ? "s" : ""} vence${dueSoon > 1 ? "m" : ""} em 48h`,
        context: "Avise os alunos para evitar atrasos.",
        actionLabel: "Revisar",
        to: "/arena/dashboard/financeiro",
      });
    }

    const pendingBookings = pendingBookingsRes.data || [];
    if (pendingBookings.length > 0) {
      items.push({
        key: "pending-bookings",
        severity: "warn",
        title: `${pendingBookings.length} reserva${pendingBookings.length > 1 ? "s" : ""} pendente${pendingBookings.length > 1 ? "s" : ""} de pagamento`,
        context: "Criada há mais de 2h sem confirmação.",
        actionLabel: "Revisar reservas",
        to: "/arena/dashboard/reservas",
      });
    }

    // Torneios com risco
    if ((upcomingTournRes.data || []).length > 0) {
      const tIds = (upcomingTournRes.data || []).map((t: any) => t.id);
      const { data: enrollCounts } = await supabase
        .from("enrollments")
        .select("tournament_id")
        .in("tournament_id", tIds);
      const countMap = new Map<string, number>();
      (enrollCounts || []).forEach((e: any) => {
        countMap.set(e.tournament_id, (countMap.get(e.tournament_id) || 0) + 1);
      });
      const risky = ((upcomingTournRes.data || []) as any[]).find((t: any) => {
        const cap = Number(t.max_slots || 0);
        if (!cap) return false;
        const pct = (countMap.get(t.id) || 0) / cap;
        return pct < 0.3;
      }) as any;
      if (risky) {
        items.push({
          key: "tournament-low",
          severity: "warn",
          title: `Torneio com poucas inscrições`,
          context: `"${risky.name}" começa em breve e está abaixo de 30%.`,
          actionLabel: "Divulgar",
          to: `/manage-tournament/${risky.id}`,
        });
      }
    }

    // Buraco em horário nobre
    const occupiedSlots = allToday
      .filter((b: any) => hhmm(b.start_time) >= "18:00" && hhmm(b.start_time) < "22:00")
      .map((b: any) => ({ s: hhmm(b.start_time), e: hhmm(b.end_time) }));
    if (now.getHours() < 22 && occupiedSlots.length < 3 && (courtsRes.count || 0) > 0) {
      items.push({
        key: "prime-gap",
        severity: "warn",
        title: "Horário nobre com vagas",
        context: "Entre 18h e 22h ainda há espaço — bom momento para divulgar.",
        actionLabel: "Promover horário",
        to: "/arena/dashboard/horarios",
      });
    }

    // Alunos inativos
    const activeStudents = studentsActiveRes.count || 0;
    if (activeStudents > 0) {
      const recentSet = new Set((recentAttRes.data || []).map((a: any) => a.student_id));
      const inactive = activeStudents - recentSet.size;
      if (inactive > 0 && inactive >= Math.max(3, activeStudents * 0.2)) {
        items.push({
          key: "inactive-students",
          severity: "warn",
          title: `${inactive} aluno${inactive > 1 ? "s" : ""} sem frequência`,
          context: "Não aparecem há 21 dias.",
          actionLabel: "Reativar",
          to: "/arena/dashboard/alunos",
        });
      }
    }

    // WhatsApp desconectado
    if (wa && !wa.connected && wa.status !== "active") {
      items.push({
        key: "wa-disconnected",
        severity: "warn",
        title: "WhatsApp desconectado",
        context: "Conecte para receber avisos e responder pelo celular.",
        actionLabel: "Conectar",
        to: "/arena/connect-whatsapp",
      });
    }

    setAttention(items);
    setRefreshing(false);
  }, [arena, wa?.connected, wa?.status]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  if (!arena) {
    return <p className="text-sm text-muted-foreground">Carregando arena…</p>;
  }

  const subtitle = format(new Date(), "EEEE · HH'h'mm", { locale: ptBR });

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-display text-foreground truncate">
            {arena?.name || "Sua arena"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 capitalize">{subtitle}</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => load()}
          disabled={refreshing}
          className="h-9 w-9 p-0 shrink-0"
          aria-label="Atualizar"
        >
          <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        </Button>
      </header>

      <QuickActionsBar />

      <NowBlock data={nowData} />

      <NextHoursBlock items={agenda} />

      <AttentionBlock items={attention} />

      {arena?.id && <NextStepsCard arenaId={arena.id} />}
    </div>
  );
};

export default ArenaDashboard;
