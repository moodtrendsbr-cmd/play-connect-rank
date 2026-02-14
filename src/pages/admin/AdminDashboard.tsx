import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Trophy, ClipboardList, DollarSign, AlertTriangle, UserCheck } from "lucide-react";

const AdminDashboard = () => {
  const [metrics, setMetrics] = useState({
    totalUsers: 0,
    totalOrganizers: 0,
    totalTournaments: 0,
    activeTournaments: 0,
    totalEnrollments: 0,
    paidEnrollments: 0,
    pendingEnrollments: 0,
    totalRevenue: 0,
    pendingWithdrawals: 0,
  });

  useEffect(() => {
    const fetch = async () => {
      const [profiles, roles, tournaments, enrollments, balances, withdrawals] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("role"),
        supabase.from("tournaments").select("id, start_date, end_date"),
        supabase.from("enrollments").select("status"),
        supabase.from("organizer_balances").select("commission"),
        supabase.from("withdrawal_requests").select("amount, status"),
      ]);

      const organizers = (roles.data || []).filter((r) => r.role === "organizer").length;
      const today = new Date().toISOString().split("T")[0];
      const active = (tournaments.data || []).filter((t) => t.end_date >= today).length;
      const enrollData = enrollments.data || [];
      const revenue = (balances.data || []).reduce((s, b) => s + Number(b.commission), 0);
      const pendingW = (withdrawals.data || []).filter((w) => w.status === "pending").reduce((s, w) => s + Number(w.amount), 0);

      setMetrics({
        totalUsers: profiles.count || 0,
        totalOrganizers: organizers,
        totalTournaments: (tournaments.data || []).length,
        activeTournaments: active,
        totalEnrollments: enrollData.length,
        paidEnrollments: enrollData.filter((e) => e.status === "paid").length,
        pendingEnrollments: enrollData.filter((e) => e.status === "pending").length,
        totalRevenue: revenue,
        pendingWithdrawals: pendingW,
      });
    };
    fetch();
  }, []);

  const cards = [
    { label: "Total Usuários", value: metrics.totalUsers, icon: Users },
    { label: "Organizadores", value: metrics.totalOrganizers, icon: UserCheck },
    { label: "Torneios Ativos", value: `${metrics.activeTournaments}/${metrics.totalTournaments}`, icon: Trophy },
    { label: "Inscrições (Pagas/Pend.)", value: `${metrics.paidEnrollments}/${metrics.pendingEnrollments}`, icon: ClipboardList },
    { label: "Receita Mood (Comissões)", value: `R$ ${metrics.totalRevenue.toFixed(2)}`, icon: DollarSign },
    { label: "Saques Pendentes", value: `R$ ${metrics.pendingWithdrawals.toFixed(2)}`, icon: AlertTriangle },
  ];

  return (
    <div>
      <h1 className="mb-6 text-4xl font-display text-foreground">PAINEL ADMINISTRATIVO</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium font-sans">{c.label}</CardTitle>
              <c.icon className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;
