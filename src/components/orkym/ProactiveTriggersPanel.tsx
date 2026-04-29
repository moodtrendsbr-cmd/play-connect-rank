import { useOrkymTriggers } from "@/hooks/useOrkymTriggers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  tenantId?: string | null;
  arenaId?: string | null;
  title?: string;
}

const PRIORITY_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  high: "destructive",
  medium: "default",
  low: "secondary",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando",
  claimed: "Em processamento",
  processed: "Enviada",
  skipped: "Ignorada",
  failed: "Falhou",
};

export function ProactiveTriggersPanel({ tenantId, arenaId, title = "Ações proativas da ORKYM" }: Props) {
  const { triggers, loading, refresh } = useOrkymTriggers({ tenantId, arenaId, limit: 25 });

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {triggers.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma ação proativa registrada ainda.</p>
        )}
        {triggers.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-card/40 px-3 py-2 text-sm"
          >
            <div className="flex flex-col">
              <span className="font-medium">{t.trigger_type}</span>
              <span className="text-xs text-muted-foreground">
                {t.entity_type ?? "—"} · {formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: ptBR })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={PRIORITY_VARIANT[t.priority] ?? "default"} className="capitalize">
                {t.priority}
              </Badge>
              <Badge variant="outline">{STATUS_LABEL[t.status] ?? t.status}</Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
