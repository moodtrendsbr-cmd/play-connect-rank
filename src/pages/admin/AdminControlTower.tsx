import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Gauge, Zap, TrendingUp, Clock, RefreshCw, AlertTriangle, Sparkles } from "lucide-react";
import { fetchAllTenantsUsage, TIER_LABELS, formatTimeSaved, type UsageSummary, type AutonomyTier } from "@/lib/autonomyTier";
import { supabase } from "@/integrations/supabase/client";
import { RevenueDashboardPanel } from "@/components/revenue/RevenueDashboardPanel";
import { toast } from "sonner";

const tierColor: Record<AutonomyTier, string> = {
  free: "bg-muted text-muted-foreground border-border",
  growth: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  pro: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  business: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  enterprise: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

const AdminControlTower = () => {
  const [usage, setUsage] = useState<UsageSummary[]>([]);
  const [planPrices, setPlanPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [smoking, setSmoking] = useState(false);

  const seedPilot = async () => {
    setSeeding(true);
    const { data, error } = await supabase.functions.invoke("seed-pilot-arena", { body: {} });
    setSeeding(false);
    if (error || (data as any)?.ok === false) {
      toast.error((error?.message ?? (data as any)?.error) || "Falha ao criar piloto");
      return;
    }
    toast.success((data as any)?.message ?? "Piloto criado");
  };

  const smokeTestPayment = async () => {
    setSmoking(true);
    const { data, error } = await supabase.functions.invoke("smoke-test-payment", { body: {} });
    setSmoking(false);
    if (error || (data as any)?.ok === false) {
      toast.error((error?.message ?? (data as any)?.error) || "Falha no smoke-test");
      console.error("smoke-test", data, error);
      return;
    }
    const d = data as any;
    const ftxOk = (d.financial_transactions ?? []).length > 0;
    const attrOk = (d.revenue_attribution ?? []).length > 0;
    const queueOk = (d.triggers_queued ?? []).length > 0;
    const actsOk = (d.athlete_activities ?? []).length > 0;
    toast.success(
      `Smoke-test OK · activity:${actsOk ? "✓" : "✗"} ftx:${ftxOk ? "✓" : "✗"} attr:${attrOk ? "✓" : "✗"} queue:${queueOk ? "✓" : "✗"}`
    );
    console.log("smoke-test result", d);
  };

  const load = async () => {
    setLoading(true);
    const [u, plans] = await Promise.all([
      fetchAllTenantsUsage(),
      supabase.from("company_plans").select("autonomy_tier, monthly_price"),
    ]);
    setUsage(u);
    const map: Record<string, number> = {};
    (plans.data ?? []).forEach((p: any) => {
      if (p.autonomy_tier) map[p.autonomy_tier] = Math.max(map[p.autonomy_tier] ?? 0, Number(p.monthly_price ?? 0));
    });
    setPlanPrices(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const totalAuto = usage.reduce((s, u) => s + (u.total_auto_executed ?? 0), 0);
  const totalTime = usage.reduce((s, u) => s + (u.estimated_time_saved_minutes ?? 0), 0);
  const potentialRevenue = usage.reduce((s, u) => s + (planPrices[u.tier] ?? 0), 0);

  const tierCounts = usage.reduce((acc, u) => {
    acc[u.tier] = (acc[u.tier] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const nearLimit = usage.filter(u =>
    Math.max(u.pct_calls ?? 0, u.pct_suggestions ?? 0, u.pct_auto ?? 0) >= 80
  );

  const topAdoption = [...usage]
    .sort((a, b) => (b.total_auto_executed ?? 0) - (a.total_auto_executed ?? 0))
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-display text-foreground flex items-center gap-3">
          <Gauge className="h-8 w-8 text-primary" /> CONTROL TOWER
        </h1>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={seedPilot} disabled={seeding}>
            <Sparkles className={`h-4 w-4 mr-2 ${seeding ? "animate-spin" : ""}`} />
            {seeding ? "Criando piloto…" : "Criar piloto"}
          </Button>
          <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Métricas top */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Auto-execuções (mês)</CardTitle>
            <Zap className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary tabular-nums">{totalAuto.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground mt-1">Em {usage.length} tenants</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Tempo economizado</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary tabular-nums">{formatTimeSaved(totalTime)}</p>
            <p className="text-xs text-muted-foreground mt-1">Heurística agregada</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Receita potencial / mês</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary tabular-nums">
              R$ {potentialRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Soma dos tiers ativos</p>
          </CardContent>
        </Card>
      </div>

      {/* Distribuição por tier */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Distribuição por plano</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(Object.keys(TIER_LABELS) as AutonomyTier[]).map((t) => (
              <div key={t} className="rounded-lg bg-muted/30 p-3 text-center">
                <Badge variant="outline" className={`text-xs ${tierColor[t]}`}>{TIER_LABELS[t]}</Badge>
                <p className="text-2xl font-bold text-foreground mt-2 tabular-nums">{tierCounts[t] ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">tenants</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top adoção */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-medium">Top adoção (auto-execuções)</CardTitle>
          <span className="text-xs text-muted-foreground">Top 10 do mês</span>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Auto</TableHead>
                <TableHead className="text-right">Sugestões</TableHead>
                <TableHead className="text-right">Calls</TableHead>
                <TableHead className="text-right">Tempo poup.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topAdoption.map((u) => (
                <TableRow key={u.tenant_id}>
                  <TableCell className="font-medium truncate max-w-[200px]">{u.tenant_name ?? u.tenant_id.slice(0, 8)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${tierColor[u.tier]}`}>{TIER_LABELS[u.tier]}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{u.total_auto_executed}</TableCell>
                  <TableCell className="text-right tabular-nums">{u.total_suggestions}</TableCell>
                  <TableCell className="text-right tabular-nums">{u.total_calls}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatTimeSaved(u.estimated_time_saved_minutes)}</TableCell>
                </TableRow>
              ))}
              {topAdoption.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum dado este mês.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Próximos do limite — oportunidade upsell */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Próximos do limite — oportunidade de upsell
          </CardTitle>
          <span className="text-xs text-muted-foreground">{nearLimit.length} tenants ≥ 80%</span>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">% Calls</TableHead>
                <TableHead className="text-right">% Sugg.</TableHead>
                <TableHead className="text-right">% Auto</TableHead>
                <TableHead className="text-right">Bloqueios</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nearLimit.map((u) => (
                <TableRow key={u.tenant_id}>
                  <TableCell className="font-medium truncate max-w-[200px]">{u.tenant_name ?? u.tenant_id.slice(0, 8)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${tierColor[u.tier]}`}>{TIER_LABELS[u.tier]}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{u.pct_calls}%</TableCell>
                  <TableCell className="text-right tabular-nums">{u.pct_suggestions}%</TableCell>
                  <TableCell className="text-right tabular-nums">{u.pct_auto}%</TableCell>
                  <TableCell className="text-right tabular-nums">{u.total_blocked_by_quota}</TableCell>
                </TableRow>
              ))}
              {nearLimit.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum tenant próximo do limite. 🎉</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* FASE 13 — Receita global ORKYM */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-[#2BFF88]" /> Receita conversacional global</CardTitle>
        </CardHeader>
        <CardContent>
          <RevenueDashboardPanel scope={{ type: "admin" }} />
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminControlTower;
