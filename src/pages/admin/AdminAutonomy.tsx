import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { ShieldCheck, Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import {
  listPolicies, togglePolicy, deletePolicy,
  fetchPolicyLogs, fetchAutonomyMetrics,
  modeLabel, riskLabel, policySourceLabel,
  type AutonomyPolicy, type PolicyLog, type AutonomyMetric,
} from "@/lib/autonomy";
import { PolicyFormDialog } from "@/components/autonomy/PolicyFormDialog";
import { PolicyDecisionBadge } from "@/components/autonomy/PolicyDecisionBadge";
import { KillSwitchPanel } from "@/components/autonomy/KillSwitchPanel";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const AdminAutonomy = () => {
  const [policies, setPolicies] = useState<AutonomyPolicy[]>([]);
  const [logs, setLogs] = useState<PolicyLog[]>([]);
  const [metrics, setMetrics] = useState<AutonomyMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const [dlgOpen, setDlgOpen] = useState(false);
  const [editing, setEditing] = useState<AutonomyPolicy | null>(null);

  const load = async () => {
    setLoading(true);
    const [p, l, m] = await Promise.all([
      listPolicies({}),
      fetchPolicyLogs({ limit: 100 }),
      fetchAutonomyMetrics({ days: 7 }),
    ]);
    setPolicies(p);
    setLogs(l);
    setMetrics(m);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const onToggle = async (p: AutonomyPolicy) => {
    const r = await togglePolicy(p.id, !p.is_enabled);
    if (!r.ok) toast.error("Falha", { description: r.error });
    else load();
  };
  const onDelete = async (p: AutonomyPolicy) => {
    if (!window.confirm(`Excluir esta política?`)) return;
    const r = await deletePolicy(p.id);
    if (!r.ok) toast.error("Falha", { description: r.error });
    else { toast.success("Excluída"); load(); }
  };

  const totals = metrics.reduce(
    (acc, m) => ({
      total: acc.total + Number(m.total),
      auto: acc.auto + Number(m.auto_count),
      approve: acc.approve + Number(m.approve_count),
      suggest: acc.suggest + Number(m.suggest_count),
      autoExec: acc.autoExec + Number(m.auto_executed_count),
      blocked: acc.blocked + Number(m.blocked_by_guardrail),
      kill: acc.kill + Number(m.blocked_by_kill_switch),
    }),
    { total: 0, auto: 0, approve: 0, suggest: 0, autoExec: 0, blocked: 0, kill: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Autonomia — Políticas globais</h1>
        </div>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <Tabs defaultValue="policies">
        <TabsList>
          <TabsTrigger value="policies">Políticas</TabsTrigger>
          <TabsTrigger value="kill">Kill Switches</TabsTrigger>
          <TabsTrigger value="metrics">Métricas (7d)</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        {/* Políticas */}
        <TabsContent value="policies" className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setEditing(null); setDlgOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Nova política
            </Button>
          </div>
          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Escopo</TableHead>
                    <TableHead className="text-xs">Domínio / Ação</TableHead>
                    <TableHead className="text-xs">Modo</TableHead>
                    <TableHead className="text-xs">Risco</TableHead>
                    <TableHead className="text-xs">Prioridade</TableHead>
                    <TableHead className="text-xs">Habilitada</TableHead>
                    <TableHead className="text-xs"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6 text-sm">
                      Nenhuma política. Sem políticas, o fallback é "aprovação manual".
                    </TableCell></TableRow>
                  )}
                  {policies.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell><Badge variant="outline" className="text-[10px]">{p.scope_level}</Badge></TableCell>
                      <TableCell className="text-xs">
                        <div>{p.domain ?? "—"}</div>
                        <div className="text-muted-foreground">{p.action_type ?? "todos"}</div>
                      </TableCell>
                      <TableCell><PolicyDecisionBadge mode={p.execution_mode} source={null} /></TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{riskLabel[p.risk_level]}</Badge></TableCell>
                      <TableCell className="text-xs">{p.priority}</TableCell>
                      <TableCell><Switch checked={p.is_enabled} onCheckedChange={() => onToggle(p)} /></TableCell>
                      <TableCell className="space-x-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(p); setDlgOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDelete(p)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Kill switches */}
        <TabsContent value="kill">
          <KillSwitchPanel />
        </TabsContent>

        {/* Métricas */}
        <TabsContent value="metrics" className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric label="Decisões 7d" value={totals.total} />
            <Metric label="Auto" value={totals.auto} />
            <Metric label="Auto-executadas" value={totals.autoExec} />
            <Metric label="Aprovação manual" value={totals.approve} />
            <Metric label="Sugerir apenas" value={totals.suggest} />
            <Metric label="Bloqueadas por guardrail" value={totals.blocked} />
            <Metric label="Bloqueadas por kill switch" value={totals.kill} />
          </div>
        </TabsContent>

        {/* Logs */}
        <TabsContent value="logs">
          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Quando</TableHead>
                    <TableHead className="text-xs">Ação</TableHead>
                    <TableHead className="text-xs">Modo</TableHead>
                    <TableHead className="text-xs">Origem</TableHead>
                    <TableHead className="text-xs">Guardrail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6 text-sm">
                      Nenhum log nos últimos registros.
                    </TableCell></TableRow>
                  )}
                  {logs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(l.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-xs">{l.action_type ?? "—"}</TableCell>
                      <TableCell><PolicyDecisionBadge mode={l.resolved_mode} source={l.policy_source} /></TableCell>
                      <TableCell className="text-xs">{policySourceLabel[l.policy_source] ?? l.policy_source}</TableCell>
                      <TableCell className="text-xs">
                        {l.guardrail_blocked ? (
                          <Badge variant="outline" className="bg-amber-500/15 text-amber-500 border-amber-500/30 text-[10px]">
                            {l.guardrail_blocked}
                          </Badge>
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <PolicyFormDialog
        open={dlgOpen}
        onClose={() => setDlgOpen(false)}
        onSaved={load}
        initial={editing ?? undefined}
      />
    </div>
  );
};

const Metric = ({ label, value }: { label: string; value: number | string }) => (
  <Card className="bg-card border-border">
    <CardContent className="p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </CardContent>
  </Card>
);

export default AdminAutonomy;
