import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Lightbulb, Sparkles, Target, RefreshCw, Loader2 } from "lucide-react";
import { useControlTowerSummary, type CTScope, type CTRecommendation } from "@/hooks/useControlTowerSummary";
import { HealthScoreBadge, scoreBg, scoreColor } from "./HealthScoreBadge";
import { invokeOrkym } from "@/lib/orkym";
import { toast } from "sonner";

const SUB_LABELS: Record<string, string> = {
  enrollment: "Inscrições",
  revenue: "Receita",
  occupancy: "Ocupação",
  engagement: "Engajamento",
  orkym_adoption: "Adoção ORKYM",
};

const SEV_DOT: Record<string, string> = {
  critical: "bg-destructive",
  warning: "bg-amber-500",
  info: "bg-sky-500",
};

const IMPACT_VARIANT: Record<string, string> = {
  high: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  medium: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  low: "bg-muted text-muted-foreground border-border",
};

export function ControlTowerAIPanel({
  scope,
  tenantId,
}: {
  scope: CTScope;
  /** Required for ORKYM execute calls; falls back to scope.id when scope.type=tenant */
  tenantId?: string;
}) {
  const { summary, loading, error, refresh } = useControlTowerSummary(scope);
  const [executingId, setExecutingId] = useState<string | null>(null);

  const effectiveTenantId =
    tenantId ?? (scope.type === "tenant" ? scope.id : undefined);

  const executeRec = async (rec: CTRecommendation) => {
    if (!effectiveTenantId) {
      toast.error("Tenant não identificado para executar via ORKYM");
      return;
    }
    setExecutingId(rec.id);
    const res = await invokeOrkym("growth", "decide", {
      tenant_id: effectiveTenantId,
      arena_id: scope.type === "arena" ? scope.id : undefined,
      entity: { trigger_id: rec.trigger_id, entity_type: rec.entity_type, entity_id: rec.entity_id },
      context: { source: "control_tower_ai", action_type: rec.action_type },
    });
    setExecutingId(null);
    if (!res.ok) {
      toast.error(res.error ?? "Falha ao acionar ORKYM");
      return;
    }
    toast.success(
      res.actions_proposed
        ? `${res.actions_proposed} ação(ões) proposta(s) pela ORKYM`
        : "ORKYM analisou — sem nova ação."
    );
    refresh();
  };

  if (loading && !summary) {
    return (
      <Card className="border-primary/20">
        <CardContent className="p-6 flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Sintetizando visão executiva…
        </CardContent>
      </Card>
    );
  }

  if (error || !summary) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>Não foi possível carregar Control Tower AI{error ? `: ${error}` : ""}.</AlertDescription>
      </Alert>
    );
  }

  const subs = Object.entries(summary.sub_scores).filter(([, v]) => v != null) as [string, number][];

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-card to-card/50">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Control Tower AI
        </CardTitle>
        <Button size="sm" variant="ghost" onClick={refresh} disabled={loading} className="h-7 w-7 p-0">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* 1. Health Score */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="text-center md:text-left">
            <p className="text-xs text-muted-foreground mb-1">Health score</p>
            <HealthScoreBadge score={summary.health_score} size="lg" />
            <p className={`text-xs mt-1 ${scoreColor(summary.health_score)}`}>
              {summary.health_score == null
                ? "Sem dados suficientes ainda"
                : summary.health_score >= 80
                ? "Operação saudável"
                : summary.health_score >= 50
                ? "Atenção recomendada"
                : "Ação urgente"}
            </p>
          </div>
          <div className="md:col-span-2 space-y-1.5">
            {subs.length === 0 && (
              <p className="text-xs text-muted-foreground">Comece a operar para gerar sub-scores.</p>
            )}
            {subs.map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 text-xs">
                <span className="w-32 text-muted-foreground">{SUB_LABELS[k] ?? k}</span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${scoreBg(v)}`} style={{ width: `${v}%` }} />
                </div>
                <span className="w-8 text-right tabular-nums">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Alerts */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Alertas
          </h3>
          {summary.alerts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem alertas. 🎉</p>
          ) : (
            <ul className="space-y-1.5">
              {summary.alerts.slice(0, 3).map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${SEV_DOT[a.severity]}`} />
                  <div className="min-w-0">
                    <p className="text-foreground leading-tight">{a.title}</p>
                    {a.body && <p className="text-xs text-muted-foreground leading-tight">{a.body}</p>}
                  </div>
                </li>
              ))}
              {summary.alerts.length > 3 && (
                <li className="text-xs text-muted-foreground pl-4">+{summary.alerts.length - 3} mais</li>
              )}
            </ul>
          )}
        </div>

        {/* 3. Opportunities */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
            <Lightbulb className="h-3.5 w-3.5" /> Oportunidades
          </h3>
          {summary.opportunities.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma oportunidade detectada agora.</p>
          ) : (
            <ul className="space-y-1.5">
              {summary.opportunities.slice(0, 3).map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-foreground truncate">{o.title}</span>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${IMPACT_VARIANT[o.impact]}`}>
                    {o.impact}
                  </Badge>
                </li>
              ))}
              {summary.opportunities.length > 3 && (
                <li className="text-xs text-muted-foreground">+{summary.opportunities.length - 3} mais</li>
              )}
            </ul>
          )}
        </div>

        {/* 4. Next Best Action */}
        {summary.next_best_action && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium uppercase text-primary">Próxima melhor ação</span>
            </div>
            <p className="text-sm font-medium text-foreground">{summary.next_best_action.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{summary.next_best_action.body}</p>
            <div className="flex items-center gap-2 mt-3">
              <Button
                size="sm"
                onClick={() => executeRec(summary.next_best_action!)}
                disabled={executingId === summary.next_best_action.id || !effectiveTenantId}
              >
                {executingId === summary.next_best_action.id ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Acionando…</>
                ) : (
                  "Executar via ORKYM"
                )}
              </Button>
              <Badge variant="outline" className="text-[10px]">
                {summary.next_best_action.action_type}
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
