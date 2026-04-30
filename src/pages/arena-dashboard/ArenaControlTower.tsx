import { useEffect, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Phone, Lightbulb, Zap, Clock, AlertTriangle, ShieldAlert, Gauge, RefreshCw } from "lucide-react";
import {
  fetchTenantTier, fetchUsageSummary,
  TIER_LABELS, type TenantTier, type UsageSummary,
  formatTimeSaved,
} from "@/lib/autonomyTier";
import { UsageMeter } from "@/components/autonomy/UsageMeter";
import { UpgradeCTA } from "@/components/autonomy/UpgradeCTA";
import { OrkymActionsCard } from "@/components/orkym/OrkymActionsCard";
import { ControlTowerAIPanel } from "@/components/control-tower/ControlTowerAIPanel";

const ArenaControlTower = () => {
  const { arena } = useOutletContext<{ arena: any }>();
  const [tier, setTier] = useState<TenantTier | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const tenantId = arena?.tenant_id;

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    const [t, u] = await Promise.all([fetchTenantTier(tenantId), fetchUsageSummary(tenantId)]);
    setTier(t);
    setUsage(u);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tenantId]);

  if (!tenantId) {
    return <p className="text-muted-foreground">Arena sem tenant vinculado.</p>;
  }

  if (loading || !tier || !usage) {
    return (
      <div className="space-y-4">
        <div className="h-24 bg-muted/40 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-28 bg-muted/40 rounded-lg animate-pulse" />
          <div className="h-28 bg-muted/40 rounded-lg animate-pulse" />
          <div className="h-28 bg-muted/40 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  const maxPct = Math.max(usage.pct_calls, usage.pct_suggestions, usage.pct_auto);
  const warning = maxPct >= 100 ? "limit" : maxPct >= 80 ? "near" : null;

  return (
    <div className="space-y-6">
      {/* Header — Tier */}
      <Card className="bg-card border-border">
        <CardContent className="p-5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Gauge className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-2xl text-foreground truncate">Control Tower</h1>
              <p className="text-xs text-muted-foreground">
                Plano de autonomia atual:{" "}
                <Badge variant="secondary" className="ml-1 text-xs">{TIER_LABELS[tier.tier]}</Badge>
                <span className="ml-2 text-[11px] opacity-70">
                  ({tier.source === "override" ? "ajuste manual" : tier.source === "subscription" ? "via assinatura" : "padrão"})
                </span>
              </p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={load} className="h-8">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Alertas */}
      {warning === "limit" && (
        <Alert className="border-destructive/50 bg-destructive/10">
          <ShieldAlert className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-foreground">
            <strong>Limite mensal atingido.</strong> Novas ações estão sendo rebaixadas para aprovação manual ou apenas sugestão.
          </AlertDescription>
        </Alert>
      )}
      {warning === "near" && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-foreground">
            Você está perto do limite mensal ({maxPct}%). Considere fazer upgrade para evitar interrupções.
          </AlertDescription>
        </Alert>
      )}

      {/* Cards de uso */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <UsageMeter
              label="Chamadas ORKYM"
              used={usage.total_calls}
              limit={usage.calls_limit}
              projected={usage.projected_calls_eom}
              icon={<Phone className="h-4 w-4" />}
            />
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <UsageMeter
              label="Sugestões"
              used={usage.total_suggestions}
              limit={usage.suggestions_limit}
              icon={<Lightbulb className="h-4 w-4" />}
            />
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <UsageMeter
              label="Auto-execuções"
              used={usage.total_auto_executed}
              limit={usage.auto_limit}
              icon={<Zap className="h-4 w-4" />}
            />
          </CardContent>
        </Card>
      </div>

      {/* Valor gerado + Upgrade */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Valor gerado este mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Tempo economizado</p>
                <p className="text-2xl font-bold text-foreground tabular-nums">
                  {formatTimeSaved(usage.estimated_time_saved_minutes)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Auto-execuções</p>
                <p className="text-2xl font-bold text-foreground tabular-nums">
                  {usage.total_auto_executed}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Aprovações</p>
                <p className="text-2xl font-bold text-foreground tabular-nums">
                  {usage.total_approved}
                </p>
              </div>
            </div>
            {usage.total_blocked_by_quota > 0 && (
              <p className="text-xs text-amber-500 mt-3">
                ⚠ {usage.total_blocked_by_quota} ações foram rebaixadas por limite de cota este mês.
              </p>
            )}
          </CardContent>
        </Card>
        <UpgradeCTA
          currentTier={tier.tier}
          reason={warning === "limit" ? "Você atingiu o limite mensal." : undefined}
        />
      </div>

      {/* Últimas auto-actions */}
      <div>
        <h2 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          Ações automáticas recentes
        </h2>
        <OrkymActionsCard
          tenantId={tenantId}
          arenaId={arena?.id}
          arenaSlug={arena?.slug}
          maxItems={10}
          showSeeAllLink={false}
        />
      </div>

      <p className="text-xs text-muted-foreground text-center">
        <Link to="/arena/dashboard/autonomia" className="hover:underline">Configurar políticas de autonomia →</Link>
      </p>
    </div>
  );
};

export default ArenaControlTower;
