import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listActionProposals, type OrkymActionProposal, type OrkymActionStatus } from "@/lib/orkym";
import { ActionProposalDetail } from "@/components/orkym/ActionProposalDetail";
import { PolicyDecisionBadge } from "@/components/autonomy/PolicyDecisionBadge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Metrics {
  total: number;
  proposed: number;
  approved: number;
  executed: number;
  failed: number;
  avg_time_to_approval_ms: number | null;
  avg_execution_ms: number | null;
}

const statusBadgeCls = (s: string) => {
  const map: Record<string, string> = {
    proposed: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    executing: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    executed: "bg-emerald-600/15 text-emerald-500 border-emerald-600/30",
    failed: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return map[s] ?? "bg-muted text-muted-foreground border-border";
};

const AdminOrkymActions = () => {
  const [items, setItems] = useState<OrkymActionProposal[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    total: 0, proposed: 0, approved: 0, executed: 0, failed: 0,
    avg_time_to_approval_ms: null, avg_execution_ms: null,
  });
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [detail, setDetail] = useState<OrkymActionProposal | null>(null);

  const load = async () => {
    setLoading(true);
    const filters: any = { limit: 200 };
    if (statusFilter !== "all") filters.status = statusFilter as OrkymActionStatus;
    if (domainFilter !== "all") filters.domain = domainFilter;
    const data = await listActionProposals(filters);
    const filtered = modeFilter === "all" ? data : data.filter((p) => (p.execution_mode ?? "approve") === modeFilter);
    setItems(filtered);

    // métricas (últimos 30 dias)
    const { data: m } = await (supabase as any)
      .from("v_orkym_action_metrics")
      .select("*");
    if (m && m.length > 0) {
      const agg = (m as any[]).reduce(
        (acc, r) => ({
          total: acc.total + Number(r.total_count ?? 0),
          proposed: acc.proposed + Number(r.proposed_count ?? 0),
          approved: acc.approved + Number(r.approved_count ?? 0),
          executed: acc.executed + Number(r.executed_count ?? 0),
          failed: acc.failed + Number(r.failed_count ?? 0),
          ttaSum: acc.ttaSum + Number(r.avg_time_to_approval_ms ?? 0),
          ttaCount: acc.ttaCount + (r.avg_time_to_approval_ms ? 1 : 0),
          exSum: acc.exSum + Number(r.avg_execution_ms ?? 0),
          exCount: acc.exCount + (r.avg_execution_ms ? 1 : 0),
        }),
        { total: 0, proposed: 0, approved: 0, executed: 0, failed: 0, ttaSum: 0, ttaCount: 0, exSum: 0, exCount: 0 },
      );
      setMetrics({
        total: agg.total, proposed: agg.proposed, approved: agg.approved,
        executed: agg.executed, failed: agg.failed,
        avg_time_to_approval_ms: agg.ttaCount ? agg.ttaSum / agg.ttaCount : null,
        avg_execution_ms: agg.exCount ? agg.exSum / agg.exCount : null,
      });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [statusFilter, domainFilter, modeFilter]);

  const fmtMs = (v: number | null) => v == null ? "—" : v < 60000 ? `${(v/1000).toFixed(1)}s` : `${(v/60000).toFixed(1)}min`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">ORKYM — Ações</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard label="Total" value={metrics.total} />
        <MetricCard label="Pendentes" value={metrics.proposed} />
        <MetricCard label="Executadas" value={metrics.executed} />
        <MetricCard label="Falhas" value={metrics.failed} />
        <MetricCard label="Tempo médio aprovar" value={fmtMs(metrics.avg_time_to_approval_ms)} small />
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base font-medium">Propostas</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="proposed">Proposta</SelectItem>
                <SelectItem value="approved">Aprovada</SelectItem>
                <SelectItem value="executed">Executada</SelectItem>
                <SelectItem value="failed">Falha</SelectItem>
                <SelectItem value="rejected">Rejeitada</SelectItem>
                <SelectItem value="expired">Expirada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={domainFilter} onValueChange={setDomainFilter}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos domínios</SelectItem>
                <SelectItem value="arena_operations">Operações</SelectItem>
                <SelectItem value="finance">Financeiro</SelectItem>
                <SelectItem value="tournaments">Torneios</SelectItem>
                <SelectItem value="growth">Crescimento</SelectItem>
              </SelectContent>
            </Select>
            <Select value={modeFilter} onValueChange={setModeFilter}>
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos modos</SelectItem>
                <SelectItem value="suggest">Sugerir</SelectItem>
                <SelectItem value="approve">Aprovar</SelectItem>
                <SelectItem value="auto">Auto</SelectItem>
              </SelectContent>
            </Select>
            <Button size="icon" variant="ghost" onClick={load} disabled={loading} className="h-8 w-8">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Mode</TableHead>
                <TableHead className="text-xs">Tipo</TableHead>
                <TableHead className="text-xs">Título</TableHead>
                <TableHead className="text-xs">Domínio</TableHead>
                <TableHead className="text-xs">Criada</TableHead>
                <TableHead className="text-xs"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                  Nenhuma proposta encontrada.
                </TableCell></TableRow>
              )}
              {items.map((p) => (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => setDetail(p)}>
                  <TableCell><Badge variant="outline" className={`text-[10px] ${statusBadgeCls(p.status)}`}>{p.status}</Badge></TableCell>
                  <TableCell>
                    <PolicyDecisionBadge
                      mode={(p.execution_mode ?? "approve") as any}
                      source={p.policy_source ?? undefined}
                      autoExecuted={p.auto_executed ?? false}
                    />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.action_type}</TableCell>
                  <TableCell className="text-sm font-medium max-w-[300px] truncate">{p.title}</TableCell>
                  <TableCell className="text-xs">{p.domain}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(p.created_at), "dd/MM HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell><Button size="sm" variant="ghost" className="h-7 text-xs">Ver</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ActionProposalDetail proposal={detail} onClose={() => setDetail(null)} />
    </div>
  );
};

const MetricCard = ({ label, value, small }: { label: string; value: any; small?: boolean }) => (
  <Card className="bg-card border-border">
    <CardContent className="p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 font-semibold text-foreground ${small ? "text-base" : "text-2xl"}`}>{value}</p>
    </CardContent>
  </Card>
);

export default AdminOrkymActions;
