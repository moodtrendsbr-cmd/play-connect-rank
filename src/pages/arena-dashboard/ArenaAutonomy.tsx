import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, Plus, Pencil, Trash2 } from "lucide-react";
import {
  listPolicies, togglePolicy, deletePolicy,
  riskLabel, type AutonomyPolicy,
} from "@/lib/autonomy";
import { PolicyFormDialog } from "@/components/autonomy/PolicyFormDialog";
import { PolicyDecisionBadge } from "@/components/autonomy/PolicyDecisionBadge";
import { KillSwitchPanel } from "@/components/autonomy/KillSwitchPanel";
import { toast } from "sonner";

const ArenaAutonomy = () => {
  const { arena } = useOutletContext<{ arena: any }>();
  const [arenaPolicies, setArenaPolicies] = useState<AutonomyPolicy[]>([]);
  const [inheritedPolicies, setInheritedPolicies] = useState<AutonomyPolicy[]>([]);
  const [editing, setEditing] = useState<AutonomyPolicy | null>(null);
  const [dlgOpen, setDlgOpen] = useState(false);

  const load = async () => {
    if (!arena) return;
    const [own, inherited] = await Promise.all([
      listPolicies({ scope: "arena", arenaId: arena.id }),
      Promise.all([
        listPolicies({ scope: "tenant", tenantId: arena.tenant_id }),
        listPolicies({ scope: "global" }),
      ]).then(([t, g]) => [...t, ...g]),
    ]);
    setArenaPolicies(own);
    setInheritedPolicies(inherited);
  };
  useEffect(() => { load(); }, [arena]);

  const onToggle = async (p: AutonomyPolicy) => {
    const r = await togglePolicy(p.id, !p.is_enabled);
    if (!r.ok) toast.error("Falha", { description: r.error });
    else load();
  };
  const onDelete = async (p: AutonomyPolicy) => {
    if (!window.confirm("Excluir política?")) return;
    const r = await deletePolicy(p.id);
    if (!r.ok) toast.error("Falha", { description: r.error });
    else { toast.success("Excluída"); load(); }
  };

  if (!arena) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Autonomia da Arena</h1>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setDlgOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nova política
        </Button>
      </div>

      <KillSwitchPanel tenantId={arena.tenant_id} arenaId={arena.id} arenaMode />

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Políticas desta arena</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Domínio / Ação</TableHead>
                <TableHead className="text-xs">Modo</TableHead>
                <TableHead className="text-xs">Risco</TableHead>
                <TableHead className="text-xs">Habilitada</TableHead>
                <TableHead className="text-xs"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {arenaPolicies.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-5 text-sm">
                  Esta arena ainda não tem políticas próprias. Aplica-se a herança abaixo.
                </TableCell></TableRow>
              )}
              {arenaPolicies.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs">
                    <div>{p.domain ?? "—"}</div>
                    <div className="text-muted-foreground">{p.action_type ?? "todos"}</div>
                  </TableCell>
                  <TableCell><PolicyDecisionBadge mode={p.execution_mode} /></TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{riskLabel[p.risk_level]}</Badge></TableCell>
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

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Herdadas (tenant + globais)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Escopo</TableHead>
                <TableHead className="text-xs">Domínio / Ação</TableHead>
                <TableHead className="text-xs">Modo</TableHead>
                <TableHead className="text-xs">Risco</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inheritedPolicies.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-5 text-sm">
                  Nenhuma política herdada.
                </TableCell></TableRow>
              )}
              {inheritedPolicies.map((p) => (
                <TableRow key={p.id}>
                  <TableCell><Badge variant="outline" className="text-[10px]">{p.scope_level}</Badge></TableCell>
                  <TableCell className="text-xs">
                    <div>{p.domain ?? "—"}</div>
                    <div className="text-muted-foreground">{p.action_type ?? "todos"}</div>
                  </TableCell>
                  <TableCell><PolicyDecisionBadge mode={p.execution_mode} /></TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{riskLabel[p.risk_level]}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PolicyFormDialog
        open={dlgOpen}
        onClose={() => setDlgOpen(false)}
        onSaved={load}
        initial={editing ?? undefined}
        forceArenaId={arena.id}
        forceTenantId={arena.tenant_id}
        arenaOwnerMode
      />
    </div>
  );
};

export default ArenaAutonomy;
