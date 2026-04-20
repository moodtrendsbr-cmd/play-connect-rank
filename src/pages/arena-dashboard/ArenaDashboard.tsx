import { useEffect, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarCheck, Grid3X3, DollarSign, Clock, ArrowRight, Users, CalendarClock } from "lucide-react";
import { format } from "date-fns";

const ArenaDashboard = () => {
  const { arena } = useOutletContext<{ arena: any }>();
  const [stats, setStats] = useState({ today: 0, week: 0, revenue: 0, courts: 0, students: 0, classesToday: 0 });
  const [upcoming, setUpcoming] = useState<any[]>([]);

  useEffect(() => {
    if (!arena) return;
    const today = format(new Date(), "yyyy-MM-dd");
    const weekEnd = format(new Date(Date.now() + 7 * 86400000), "yyyy-MM-dd");
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(); dayEnd.setHours(23, 59, 59, 999);

    const load = async () => {
      const [todayRes, weekRes, courtsRes, upcomingRes, studentsRes, classesTodayRes] = await Promise.all([
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("arena_id", arena.id).eq("booking_date", today).neq("status", "canceled"),
        supabase.from("bookings").select("id,amount", { count: "exact" }).eq("arena_id", arena.id).gte("booking_date", today).lte("booking_date", weekEnd).neq("status", "canceled"),
        supabase.from("courts").select("id", { count: "exact", head: true }).eq("arena_id", arena.id),
        supabase.from("bookings").select("*, courts(name)").eq("arena_id", arena.id).gte("booking_date", today).neq("status", "canceled").order("booking_date").order("start_time").limit(5),
        supabase.from("arena_students").select("id", { count: "exact", head: true }).eq("arena_id", arena.id).eq("status", "active"),
        supabase.from("arena_classes").select("id", { count: "exact", head: true }).eq("arena_id", arena.id).gte("start_at", dayStart.toISOString()).lte("start_at", dayEnd.toISOString()),
      ]);

      const weekRevenue = (weekRes.data || []).reduce((sum: number, b: any) => sum + Number(b.amount || 0), 0);

      setStats({
        today: todayRes.count || 0,
        week: weekRes.count || 0,
        revenue: weekRevenue,
        courts: courtsRes.count || 0,
        students: studentsRes.count || 0,
        classesToday: classesTodayRes.count || 0,
      });
      setUpcoming(upcomingRes.data || []);
    };
    load();
  }, [arena]);

  const statCards = [
    { label: "Reservas hoje", value: stats.today, icon: CalendarCheck, color: "text-primary" },
    { label: "Aulas hoje", value: stats.classesToday, icon: CalendarClock, color: "text-blue-400" },
    { label: "Alunos ativos", value: stats.students, icon: Users, color: "text-emerald-400" },
    { label: "Receita semana", value: `R$ ${stats.revenue.toFixed(2)}`, icon: DollarSign, color: "text-amber-400" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display text-foreground">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3">
        {statCards.map((s) => (
          <Card key={s.label} className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-8 w-8 ${s.color}`} />
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold text-foreground">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
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

      <div className="grid grid-cols-2 gap-3">
        {[
          { to: "/arena/dashboard/alunos", label: "Alunos" },
          { to: "/arena/dashboard/professores", label: "Professores" },
          { to: "/arena/dashboard/aulas", label: "Aulas" },
          { to: "/arena/dashboard/matriculas", label: "Matrículas" },
          { to: "/arena/dashboard/quadras", label: "Quadras" },
          { to: "/arena/dashboard/horarios", label: "Horários" },
          { to: "/arena/dashboard/reservas", label: "Reservas" },
          { to: "/arena/dashboard/patrocinios", label: "Patrocínios" },
        ].map((link) => (
          <Link key={link.to} to={link.to} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors">
            <span className="text-sm font-medium text-foreground">{link.label}</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
};

export default ArenaDashboard;
