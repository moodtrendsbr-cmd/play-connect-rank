import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  upsertPolicy, ACTION_TYPES, DOMAINS,
  type AutonomyPolicy, type ExecutionMode, type PolicyScope, type RiskLevel,
} from "@/lib/autonomy";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: Partial<AutonomyPolicy>;
  /** Se setado, força scope=arena com o id e bloqueia mode=auto p/ risk≥high */
  forceArenaId?: string;
  forceTenantId?: string;
  /** Se true, restringe scope a 'arena' (arena owner) */
  arenaOwnerMode?: boolean;
}

export const PolicyFormDialog = ({
  open, onClose, onSaved, initial, forceArenaId, forceTenantId, arenaOwnerMode,
}: Props) => {
  const [scope, setScope] = useState<PolicyScope>(initial?.scope_level ?? (forceArenaId ? "arena" : "global"));
  const [tenantId, setTenantId] = useState(initial?.tenant_id ?? forceTenantId ?? "");
  const [arenaId, setArenaId] = useState(initial?.arena_id ?? forceArenaId ?? "");
  const [domain, setDomain] = useState<string>(initial?.domain ?? "arena_operations");
  const [actionType, setActionType] = useState<string>(initial?.action_type ?? "");
  const [mode, setMode] = useState<ExecutionMode>(initial?.execution_mode ?? "approve");
  const [risk, setRisk] = useState<RiskLevel>(initial?.risk_level ?? "low");
  const [enabled, setEnabled] = useState<boolean>(initial?.is_enabled ?? true);
  const [maxAmount, setMaxAmount] = useState<string>(String((initial?.conditions as any)?.max_amount ?? ""));
  const [hourStart, setHourStart] = useState<string>(String((initial?.conditions as any)?.allowed_hours?.[0] ?? ""));
  const [hourEnd, setHourEnd] = useState<string>(String((initial?.conditions as any)?.allowed_hours?.[1] ?? ""));
  const [priority, setPriority] = useState<number>(initial?.priority ?? 100);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (actionType) {
      const found = ACTION_TYPES.find((a) => a.value === actionType);
      if (found) {
        setRisk(found.risk);
        setDomain(found.domain);
      }
    }
  }, [actionType]);

  const arenaOwnerBlock = arenaOwnerMode && mode === "auto" && (risk === "high" || risk === "critical");

  const save = async () => {
    if (arenaOwnerBlock) {
      toast.error("Modo automático não permitido para risco alto ou crítico");
      return;
    }
    setSaving(true);
    const conditions: Record<string, unknown> = {};
    if (maxAmount) conditions.max_amount = Number(maxAmount);
    if (hourStart && hourEnd) conditions.allowed_hours = [Number(hourStart), Number(hourEnd)];

    const r = await upsertPolicy({
      id: initial?.id,
      scope_level: scope,
      tenant_id: scope === "global" ? null : (tenantId || null),
      arena_id: scope === "arena" ? (arenaId || null) : null,
      domain: domain || null,
      action_type: actionType || null,
      execution_mode: mode,
      risk_level: risk,
      is_enabled: enabled,
      conditions,
      priority,
    });
    setSaving(false);
    if (!r.ok) {
      toast.error("Não foi possível salvar", { description: r.error });
      return;
    }
    toast.success("Política salva");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Editar política" : "Nova política"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {!arenaOwnerMode && (
            <div className="space-y-1">
              <Label className="text-xs">Escopo</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as PolicyScope)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global</SelectItem>
                  <SelectItem value="tenant">Tenant</SelectItem>
                  <SelectItem value="arena">Arena</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {scope !== "global" && !forceTenantId && (
            <div className="space-y-1">
              <Label className="text-xs">Tenant ID</Label>
              <Input value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="h-9 text-xs font-mono" />
            </div>
          )}
          {scope === "arena" && !forceArenaId && (
            <div className="space-y-1">
              <Label className="text-xs">Arena ID</Label>
              <Input value={arenaId} onChange={(e) => setArenaId(e.target.value)} className="h-9 text-xs font-mono" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Domínio</Label>
              <Select value={domain} onValueChange={setDomain}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOMAINS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo de ação</Label>
              <Select value={actionType || "__any__"} onValueChange={(v) => setActionType(v === "__any__" ? "" : v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__any__">Todos do domínio</SelectItem>
                  {ACTION_TYPES.filter((a) => a.domain === domain).map((a) => (
                    <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Modo de execução</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as ExecutionMode)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="suggest">Sugerir</SelectItem>
                  <SelectItem value="approve">Aprovação manual</SelectItem>
                  <SelectItem value="auto">Automático</SelectItem>
                </SelectContent>
              </Select>
              {arenaOwnerBlock && (
                <p className="text-[11px] text-destructive">Auto não permitido para risco alto/crítico nesta arena.</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Risco</Label>
              <Select value={risk} onValueChange={(v) => setRisk(v as RiskLevel)} disabled={!!actionType}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixo</SelectItem>
                  <SelectItem value="medium">Médio</SelectItem>
                  <SelectItem value="high">Alto</SelectItem>
                  <SelectItem value="critical">Crítico</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Valor máximo (R$)</Label>
              <Input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} className="h-9" placeholder="—" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hora inicial</Label>
              <Input type="number" min="0" max="23" value={hourStart} onChange={(e) => setHourStart(e.target.value)} className="h-9" placeholder="0-23" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hora final</Label>
              <Input type="number" min="0" max="24" value={hourEnd} onChange={(e) => setHourEnd(e.target.value)} className="h-9" placeholder="0-24" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Prioridade (menor = mais alta)</Label>
              <Input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} className="h-9" />
            </div>
            <div className="flex items-center gap-2 h-9">
              <Switch checked={enabled} onCheckedChange={setEnabled} />
              <Label className="text-xs">Habilitada</Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving || arenaOwnerBlock}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
