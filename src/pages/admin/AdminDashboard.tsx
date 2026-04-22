import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Trophy, ClipboardList, DollarSign, AlertTriangle, UserCheck, Store, Package, ShoppingCart, CreditCard } from "lucide-react";
import { OperationModeBanner } from "@/components/conversational/OperationModeBanner";
import { CommandExamplesCard } from "@/components/conversational/CommandExamplesCard";
import { COMMANDS } from "@/lib/conversationalCommands";

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
    totalCompanies: 0,
    pendingCompanies: 0,
    totalProducts: 0,
    totalOrders: 0,
    marketplaceRevenue: 0,
    activeSubscriptions: 0,
    subscriptionRevenue: 0,
    overdueCompanies: 0,
    canonicalRevenue: 0,
    canonicalPending: 0,
  });

  useEffect(() => {
    const fetch = async () => {
      const [profiles, roles, tournaments, enrollments, balances, withdrawals, companiesRes, productsRes, ordersRes, subsRes, ledgerRes, ftxRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("role"),
        supabase.from("tournaments").select("id, start_date, end_date"),
        supabase.from("enrollments").select("status"),
        supabase.from("organizer_balances").select("commission"),
        supabase.from("withdrawal_requests").select("amount, status"),
        supabase.from("companies").select("id, status, billing_status"),
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("marketplace_orders").select("mood_commission"),
        supabase.from("subscriptions").select("status"),
        supabase.from("financial_ledger").select("source, amount"),
        supabase.from("financial_transactions").select("total_amount, status"),
      ]);

      const organizers = (roles.data || []).filter((r) => r.role === "organizer").length;
      const today = new Date().toISOString().split("T")[0];
      const active = (tournaments.data || []).filter((t) => t.end_date >= today).length;
      const enrollData = enrollments.data || [];
      const revenue = (balances.data || []).reduce((s, b) => s + Number(b.commission), 0);
      const pendingW = (withdrawals.data || []).filter((w) => w.status === "pending").reduce((s, w) => s + Number(w.amount), 0);

      const companiesData = companiesRes.data || [];
      const mkRevenue = (ordersRes.data || []).reduce((s, o) => s + Number((o as any).mood_commission || 0), 0);
      const subsData = subsRes.data || [];
      const subRevenue = (ledgerRes.data || []).filter((l: any) => l.source === "subscription").reduce((s: number, l: any) => s + Number(l.amount), 0);

      const ftxData = ftxRes.data || [];
      const canonicalRevenue = ftxData
        .filter((t: any) => t.status === "paid" || t.status === "partially_refunded")
        .reduce((s: number, t: any) => s + Number(t.total_amount), 0);
      const canonicalPending = ftxData
        .filter((t: any) => t.status === "pending")
        .reduce((s: number, t: any) => s + Number(t.total_amount), 0);

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
        totalCompanies: companiesData.length,
        pendingCompanies: companiesData.filter((c) => c.status === "pending_approval").length,
        totalProducts: productsRes.count || 0,
        totalOrders: (ordersRes.data || []).length,
        marketplaceRevenue: mkRevenue,
        activeSubscriptions: subsData.filter((s: any) => s.status === "active").length,
        subscriptionRevenue: subRevenue,
        overdueCompanies: companiesData.filter((c: any) => c.billing_status === "overdue").length,
        canonicalRevenue,
        canonicalPending,
      });
    };
    fetch();
  }, []);

  const cards = [
    { label: "Total Usuários", value: metrics.totalUsers, icon: Users },
    { label: "Organizadores", value: metrics.totalOrganizers, icon: UserCheck },
    { label: "Torneios Ativos", value: `${metrics.activeTournaments}/${metrics.totalTournaments}`, icon: Trophy },
    { label: "Inscrições (Pagas/Pend.)", value: `${metrics.paidEnrollments}/${metrics.pendingEnrollments}`, icon: ClipboardList },
    { label: "Receita Canônica (paid)", value: `R$ ${metrics.canonicalRevenue.toFixed(2)}`, icon: DollarSign },
    { label: "Receita Pendente (canônica)", value: `R$ ${metrics.canonicalPending.toFixed(2)}`, icon: AlertTriangle },
    { label: "Receita Mood (Comissões)", value: `R$ ${metrics.totalRevenue.toFixed(2)}`, icon: DollarSign },
    { label: "Saques Pendentes", value: `R$ ${metrics.pendingWithdrawals.toFixed(2)}`, icon: AlertTriangle },
    { label: "Empresas (Aprov./Pend.)", value: `${metrics.totalCompanies - metrics.pendingCompanies}/${metrics.pendingCompanies}`, icon: Store },
    { label: "Produtos", value: metrics.totalProducts, icon: Package },
    { label: "Pedidos Marketplace", value: metrics.totalOrders, icon: ShoppingCart },
    { label: "Receita Marketplace", value: `R$ ${metrics.marketplaceRevenue.toFixed(2)}`, icon: DollarSign },
    { label: "Assinaturas Ativas", value: metrics.activeSubscriptions, icon: CreditCard },
    { label: "Receita Assinaturas", value: `R$ ${metrics.subscriptionRevenue.toFixed(2)}`, icon: CreditCard },
    { label: "Empresas Overdue", value: metrics.overdueCompanies, icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold leading-tight text-foreground">Control Tower</h1>
          <p className="text-sm text-muted-foreground">Visão global do MoodPlay</p>
        </div>
      </div>
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

      {/* CAMADA CONVERSACIONAL */}
      <OperationModeBanner profile="admin" />
      <CommandExamplesCard
        title="Operar pelo WhatsApp"
        subtitle="Comandos globais da plataforma"
        examples={COMMANDS.admin}
      />
    </div>
  );
};

export default AdminDashboard;
