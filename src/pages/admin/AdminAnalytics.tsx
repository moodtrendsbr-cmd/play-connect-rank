import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { DollarSign, Eye, MousePointerClick, Building2, Handshake, TrendingUp } from "lucide-react";

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "hsl(var(--muted))"];

const AdminAnalytics = () => {
  const [period, setPeriod] = useState("all");
  const [sponsorships, setSponsorships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("tournament_sponsorships")
        .select("*, tournaments(name, city, state), companies(name), tournament_sponsor_plans(display_name, price)")
        .order("created_at", { ascending: false });
      setSponsorships(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = sponsorships.filter((s) => {
    if (period === "all") return true;
    const d = new Date(s.created_at);
    const now = new Date();
    if (period === "30d") return now.getTime() - d.getTime() < 30 * 86400000;
    if (period === "month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    return true;
  });

  const active = filtered.filter((s) => s.status === "active");
  const totalRevenue = active.reduce((sum, s) => sum + Number(s.tournament_sponsor_plans?.price || 0), 0);
  const totalViews = filtered.reduce((sum, s) => sum + (s.views_count || 0), 0);
  const totalClicks = filtered.reduce((sum, s) => sum + (s.clicks_count || 0), 0);
  const ctr = totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(2) : "0";
  const uniqueCompanies = new Set(active.map((s) => s.company_id)).size;

  // Revenue by city
  const cityMap = new Map<string, number>();
  active.forEach((s) => {
    const city = s.tournaments?.city || "Sem cidade";
    cityMap.set(city, (cityMap.get(city) || 0) + Number(s.tournament_sponsor_plans?.price || 0));
  });
  const revenueByCity = Array.from(cityMap.entries()).map(([city, value]) => ({ city, value })).sort((a, b) => b.value - a.value);

  // Top tournaments by views
  const tournamentMap = new Map<string, number>();
  filtered.forEach((s) => {
    const name = s.tournaments?.name || "—";
    tournamentMap.set(name, (tournamentMap.get(name) || 0) + (s.views_count || 0));
  });
  const topTournaments = Array.from(tournamentMap.entries()).map(([name, views]) => ({ name, views })).sort((a, b) => b.views - a.views).slice(0, 8);

  // Top companies by clicks
  const companyMap = new Map<string, number>();
  filtered.forEach((s) => {
    const name = s.companies?.name || "—";
    companyMap.set(name, (companyMap.get(name) || 0) + (s.clicks_count || 0));
  });
  const topCompanies = Array.from(companyMap.entries()).map(([name, clicks]) => ({ name, clicks })).sort((a, b) => b.clicks - a.clicks).slice(0, 8);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-4xl font-display text-foreground">ANALYTICS</h1>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo o período</SelectItem>
            <SelectItem value="month">Este mês</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <Card>
              <CardContent className="pt-4 text-center">
                <DollarSign className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold text-primary">R$ {totalRevenue.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">Receita</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <Handshake className="h-5 w-5 mx-auto mb-1 text-secondary" />
                <p className="text-2xl font-bold text-secondary">{active.length}</p>
                <p className="text-xs text-muted-foreground">Ativos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <Building2 className="h-5 w-5 mx-auto mb-1 text-foreground" />
                <p className="text-2xl font-bold">{uniqueCompanies}</p>
                <p className="text-xs text-muted-foreground">Empresas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <Eye className="h-5 w-5 mx-auto mb-1 text-foreground" />
                <p className="text-2xl font-bold">{totalViews}</p>
                <p className="text-xs text-muted-foreground">Views</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <MousePointerClick className="h-5 w-5 mx-auto mb-1 text-foreground" />
                <p className="text-2xl font-bold">{totalClicks}</p>
                <p className="text-xs text-muted-foreground">Clicks</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <TrendingUp className="h-5 w-5 mx-auto mb-1 text-foreground" />
                <p className="text-2xl font-bold">{ctr}%</p>
                <p className="text-xs text-muted-foreground">CTR</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader><CardTitle className="text-sm font-sans font-semibold">Receita por Cidade</CardTitle></CardHeader>
              <CardContent>
                {revenueByCity.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={revenueByCity}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="city" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }} />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm font-sans font-semibold">Top Torneios por Views</CardTitle></CardHeader>
              <CardContent>
                {topTournaments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={topTournaments} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }} />
                      <Bar dataKey="views" fill="hsl(var(--secondary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-sm font-sans font-semibold">Top Empresas por Clicks</CardTitle></CardHeader>
            <CardContent>
              {topCompanies.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={topCompanies}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }} />
                    <Bar dataKey="clicks" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default AdminAnalytics;
