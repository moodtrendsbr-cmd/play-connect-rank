import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, AlertTriangle, Info, AlertCircle, RefreshCw } from "lucide-react";
import { invokeOrkym, type OrkymAlert, type OrkymSuggestion } from "@/lib/orkym";
import { buildArenaOperationsContext } from "@/lib/orkymContext";
import { OrkymStatusBadge, type OrkymStatus } from "./StatusBadge";
import { toast } from "sonner";

interface Props {
  tenantId: string;
  arenaId: string;
}

const sevIcon = (s: OrkymAlert["severity"]) =>
  s === "critical" ? AlertCircle : s === "warning" ? AlertTriangle : Info;
const sevCls = (s: OrkymAlert["severity"]) =>
  s === "critical" ? "text-destructive" : s === "warning" ? "text-amber-400" : "text-blue-400";

export const OrkymInsightsCard = ({ tenantId, arenaId }: Props) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<OrkymStatus>("offline");
  const [suggestions, setSuggestions] = useState<OrkymSuggestion[]>([]);
  const [alerts, setAlerts] = useState<OrkymAlert[]>([]);
  const [tasksCreated, setTasksCreated] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const ctx = await buildArenaOperationsContext(arenaId);
      const res = await invokeOrkym("arena_operations", "daily_briefing", {
        tenant_id: tenantId,
        arena_id: arenaId,
        context: ctx,
      });
      if (res.ok && !res.degraded) {
        setStatus("online");
        setSuggestions(res.suggestions ?? []);
        setAlerts(res.alerts ?? []);
        setTasksCreated(res.tasks_created ?? 0);
      } else if (res.degraded) {
        setStatus(res.error?.includes("not configured") ? "offline" : "degraded");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (tenantId && arenaId) load(); }, [tenantId, arenaId]);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            Inteligência ORKYM
          </CardTitle>
          <OrkymStatusBadge status={status} />
        </div>
        <Button size="icon" variant="ghost" onClick={load} disabled={loading} className="h-8 w-8">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {status === "offline" && (
          <p className="text-sm text-muted-foreground">
            Integração não configurada. As sugestões aparecerão aqui assim que a ORKYM estiver conectada.
          </p>
        )}
        {status === "degraded" && (
          <p className="text-sm text-muted-foreground">
            Não foi possível obter sugestões agora. Tentaremos novamente automaticamente.
          </p>
        )}
        {status === "online" && tasksCreated > 0 && (
          <p className="text-xs text-emerald-400">{tasksCreated} nova(s) tarefa(s) adicionada(s) à caixa de pendências.</p>
        )}

        {alerts.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Alertas</p>
            {alerts.map((a) => {
              const Icon = sevIcon(a.severity);
              return (
                <div key={a.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${sevCls(a.severity)}`} />
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-sm font-medium text-foreground">{a.title}</p>
                    {a.body && <p className="text-xs text-muted-foreground">{a.body}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Sugestões</p>
            {suggestions.map((s) => (
              <div key={s.id} className="flex items-start justify-between gap-2 p-2 rounded-lg bg-muted/30">
                <div className="space-y-0.5 min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{s.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{s.body}</p>
                </div>
                {s.cta && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs shrink-0"
                    onClick={() => { if (s.cta?.href) window.location.href = s.cta.href; else toast.info("Sugestão registrada"); }}>
                    {s.cta.label}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {status === "online" && alerts.length === 0 && suggestions.length === 0 && (
          <p className="text-sm text-muted-foreground">Tudo tranquilo. Nenhuma sugestão ou alerta no momento.</p>
        )}
      </CardContent>
    </Card>
  );
};
