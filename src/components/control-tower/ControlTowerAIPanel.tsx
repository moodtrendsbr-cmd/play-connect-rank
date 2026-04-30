import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Gauge, RefreshCw, Loader2, CheckCircle2 } from "lucide-react";
import { useControlTowerSummary, type CTScope, type CTRecommendation } from "@/hooks/useControlTowerSummary";
import { HealthScoreBadge, scoreBg, scoreColor } from "./HealthScoreBadge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  copyForAction,
  humanizeKind,
  SUB_SCORE_LABELS,
  HIDDEN_SUB_SCORES,
} from "@/lib/controlTowerCopy";

const SEV_DOT: Record<string, string> = {
  critical: "bg-destructive",
  warning: "bg-amber-500",
  info: "bg-sky-500",
};

type RunState = "idle" | "starting" | "running" | "done";

export function ControlTowerAIPanel({
  scope,
  tenantId: _tenantId,
}: {
  scope: CTScope;
  tenantId?: string;
}) {
  const { summary, loading, error, refresh } = useControlTowerSummary(scope);
  const [runStates, setRunStates] = useState<Record<string, RunState>>({});
  const promotionTimers = useRef<Record<string, number>>({});

  const setRunState = (id: string, next: RunState) =>
    setRunStates((s) => ({ ...s, [id]: next }));

  const executeRec = async (rec: CTRecommendation) => {
    const copy = copyForAction(rec.action_type);
    setRunState(rec.id, "starting");

    // After 800ms still in flight → switch label to "Em andamento…"
    const timerId = window.setTimeout(() => {
      setRunStates((s) =>
        s[rec.id] === "starting" ? { ...s, [rec.id]: "running" } : s,
      );
    }, 800);
    promotionTimers.current[rec.id] = timerId;

    const toastId = toast.loading("Estamos cuidando disso…");

    const { data, error: invokeErr } = await supabase.functions.invoke(
      "control-tower-execute",
      {
        body: {
          scope: { type: scope.type, id: (scope as any).id ?? null },
          recommendation: {
            id: rec.id,
            title: rec.title,
            body: rec.body,
            action_type: rec.action_type,
            entity_type: rec.entity_type,
            entity_id: rec.entity_id,
            payload: {},
          },
        },
      },
    );

    window.clearTimeout(promotionTimers.current[rec.id]);
    delete promotionTimers.current[rec.id];

    const ok = !invokeErr && (data as any)?.ok === true;
    const status = (data as any)?.status as string | undefined;

    if (!ok) {
      toast.error("Não conseguimos agora. Tente novamente em instantes.", { id: toastId });
      setRunState(rec.id, "idle");
      return;
    }

    if (status === "blocked") {
      toast.success("Tudo já está sob controle por agora.", { id: toastId });
      setRunState(rec.id, "done");
      refresh();
      return;
    }

    toast.success(copy.feedback, { id: toastId });
    setRunState(rec.id, "done");
    refresh();
  };

  if (loading && !summary) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </CardContent>
      </Card>
    );
  }

  if (error || !summary) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>Não foi possível carregar agora. Tente novamente.</AlertDescription>
      </Alert>
    );
  }

  const subs = Object.entries(summary.sub_scores).filter(
    ([k, v]) => v != null && !HIDDEN_SUB_SCORES.has(k)
  ) as [string, number][];

  // Order: NBA first, then remaining recommendations, dedupe by id, cap at 3.
  const recs: CTRecommendation[] = [];
  if (summary.next_best_action) recs.push(summary.next_best_action);
  for (const r of summary.recommendations ?? []) {
    if (!recs.find((x) => x.id === r.id)) recs.push(r);
    if (recs.length >= 3) break;
  }

  const healthLabel =
    summary.health_score == null
      ? "Sem dados suficientes ainda"
      : summary.health_score >= 80
      ? "Negócio saudável"
      : summary.health_score >= 50
      ? "Atenção recomendada"
      : "Ação urgente";

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-card to-card/50">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" />
          Visão geral
        </CardTitle>
        <Button size="sm" variant="ghost" onClick={refresh} disabled={loading} className="h-7 w-7 p-0">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Saúde do negócio */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="text-center md:text-left">
            <p className="text-xs text-muted-foreground mb-1">Saúde do negócio</p>
            <HealthScoreBadge score={summary.health_score} size="lg" />
            <p className={`text-xs mt-1 ${scoreColor(summary.health_score)}`}>{healthLabel}</p>
          </div>
          <div className="md:col-span-2 space-y-1.5">
            {subs.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Comece a operar para ver indicadores aqui.
              </p>
            )}
            {subs.map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 text-xs">
                <span className="w-32 text-muted-foreground">{SUB_SCORE_LABELS[k] ?? k}</span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${scoreBg(v)}`} style={{ width: `${v}%` }} />
                </div>
                <span className="w-8 text-right tabular-nums">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Alertas */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> O que precisa de atenção
          </h3>
          {summary.alerts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Tudo certo por aqui.</p>
          ) : (
            <ul className="space-y-1.5">
              {summary.alerts.slice(0, 3).map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${SEV_DOT[a.severity]}`} />
                  <div className="min-w-0">
                    <p className="text-foreground leading-tight">
                      {humanizeKind(a.kind, a.title)}
                    </p>
                    {a.body && (
                      <p className="text-xs text-muted-foreground leading-tight">{a.body}</p>
                    )}
                  </div>
                </li>
              ))}
              {summary.alerts.length > 3 && (
                <li className="text-xs text-muted-foreground pl-4">
                  +{summary.alerts.length - 3} mais
                </li>
              )}
            </ul>
          )}
        </div>

        {/* O que fazer agora */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2">
            O que fazer agora
          </h3>
          {recs.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nada urgente no momento.</p>
          ) : (
            <ul className="space-y-2">
              {recs.map((rec) => {
                const state = runStates[rec.id] ?? "idle";
                const copy = copyForAction(rec.action_type);
                const problem = humanizeKind(
                  // Try to surface a problem-level title when present
                  (rec as any).kind,
                  rec.title
                );
                return (
                  <li
                    key={rec.id}
                    className="rounded-lg border border-border bg-background/40 p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{problem}</p>
                      {rec.body && (
                        <p className="text-xs text-muted-foreground leading-tight truncate">
                          {rec.body}
                        </p>
                      )}
                    </div>
                    {state === "done" ? (
                      <span className="flex items-center gap-1.5 text-xs text-emerald-500 shrink-0">
                        <CheckCircle2 className="h-4 w-4" />
                        Pronto
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => executeRec(rec)}
                        disabled={state === "starting" || state === "running"}
                        className="shrink-0"
                      >
                        {state === "starting" ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            Iniciando…
                          </>
                        ) : state === "running" ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            Em andamento…
                          </>
                        ) : (
                          copy.label
                        )}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
