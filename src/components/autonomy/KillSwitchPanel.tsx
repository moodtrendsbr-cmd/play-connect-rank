import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, ShieldOff, Power } from "lucide-react";
import { listKillSwitches, activateKillSwitch, deactivateKillSwitch, type KillSwitch, type KillScope } from "@/lib/autonomy";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  tenantId?: string;
  arenaId?: string;
  /** Se true, mostra botão "Pause autonomy for this arena". Caso contrário, "Emergency Stop Global". */
  arenaMode?: boolean;
}

export const KillSwitchPanel = ({ tenantId, arenaId, arenaMode }: Props) => {
  const [items, setItems] = useState<KillSwitch[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await listKillSwitches({ tenantId });
    setItems(data);
    setLoading(false);
  };
  useEffect(() => { load(); }, [tenantId]);

  const fire = async (scope: KillScope, payload: Record<string, any>) => {
    const reason = window.prompt(
      "Motivo do desligamento de autonomia (registro de auditoria):",
      "Pausa preventiva"
    );
    if (!reason) return;
    const r = await activateKillSwitch({ scope_level: scope, reason, ...payload });
    if (!r.ok) toast.error("Falha ao ativar", { description: r.error });
    else toast.success("Autonomia pausada");
    load();
  };

  const off = async (id: string) => {
    const r = await deactivateKillSwitch(id);
    if (!r.ok) toast.error("Falha ao desativar", { description: r.error });
    else toast.success("Kill switch desativado");
    load();
  };

  const active = items.filter((k) => k.is_active);
  const past = items.filter((k) => !k.is_active);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-destructive" />
          Kill Switches
          {active.length > 0 && (
            <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30 text-[10px]">
              {active.length} ativo{active.length > 1 ? "s" : ""}
            </Badge>
          )}
        </CardTitle>
        <div className="flex gap-2">
          {arenaMode && arenaId ? (
            <Button size="sm" variant="destructive" onClick={() => fire("arena", { arena_id: arenaId, tenant_id: tenantId })}>
              <Power className="h-3 w-3 mr-1" /> Pausar autonomia desta arena
            </Button>
          ) : (
            <>
              {tenantId && (
                <Button size="sm" variant="outline" onClick={() => fire("tenant", { tenant_id: tenantId })}>
                  <Power className="h-3 w-3 mr-1" /> Pausar tenant
                </Button>
              )}
              <Button size="sm" variant="destructive" onClick={() => fire("global", {})}>
                <Power className="h-3 w-3 mr-1" /> Emergency stop global
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {active.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground">Nenhum kill switch ativo. Autonomia operando normalmente.</p>
        )}
        {active.map((k) => (
          <div key={k.id} className="p-3 rounded-lg bg-destructive/5 border border-destructive/30 flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px] bg-destructive/15 text-destructive border-destructive/30">
                  {k.scope_level}
                </Badge>
                {k.action_type && <Badge variant="outline" className="text-[10px]">{k.action_type}</Badge>}
                {k.domain && <Badge variant="outline" className="text-[10px]">{k.domain}</Badge>}
              </div>
              <p className="text-sm text-foreground mt-1">{k.reason}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Ativo desde {format(new Date(k.activated_at), "dd/MM HH:mm", { locale: ptBR })}
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => off(k.id)}>
              <ShieldOff className="h-3 w-3 mr-1" /> Desativar
            </Button>
          </div>
        ))}
        {past.length > 0 && (
          <details className="mt-3">
            <summary className="text-xs text-muted-foreground cursor-pointer">Histórico ({past.length})</summary>
            <div className="space-y-1 mt-2">
              {past.slice(0, 10).map((k) => (
                <div key={k.id} className="flex items-center justify-between text-xs text-muted-foreground p-2 rounded bg-muted/20">
                  <span>[{k.scope_level}] {k.reason}</span>
                  <span>{format(new Date(k.activated_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
};
