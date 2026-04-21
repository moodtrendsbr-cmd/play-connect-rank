import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Check, X, Loader2 } from "lucide-react";
import {
  listActionProposals, approveAction, executeAction, rejectAction,
  type OrkymActionProposal, type OrkymActionStatus,
} from "@/lib/orkym";
import { ActionProposalDetail } from "@/components/orkym/ActionProposalDetail";
import { PolicyDecisionBadge } from "@/components/autonomy/PolicyDecisionBadge";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const TABS: { key: string; label: string; statuses: OrkymActionStatus[] }[] = [
  { key: "pending", label: "Pendentes", statuses: ["proposed"] },
  { key: "approved", label: "Aprovadas", statuses: ["approved", "executing"] },
  { key: "executed", label: "Executadas", statuses: ["executed"] },
  { key: "issues", label: "Rejeitadas/Falhas", statuses: ["rejected", "failed", "expired"] },
];

const statusBadge = (s: OrkymActionStatus) => {
  const map: Record<string, string> = {
    proposed: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    executing: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    executed: "bg-emerald-600/15 text-emerald-500 border-emerald-600/30",
    failed: "bg-destructive/15 text-destructive border-destructive/30",
    rejected: "bg-muted text-muted-foreground border-border",
    expired: "bg-muted text-muted-foreground border-border",
    canceled: "bg-muted text-muted-foreground border-border",
  };
  return map[s] ?? map.proposed;
};

const ArenaActions = () => {
  const { arena } = useOutletContext<{ arena: any }>();
  const [tab, setTab] = useState("pending");
  const [items, setItems] = useState<OrkymActionProposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrkymActionProposal | null>(null);
  const [modeFilter, setModeFilter] = useState<string>("all");

  const load = async () => {
    if (!arena?.id || !arena?.tenant_id) return;
    setLoading(true);
    const statuses = TABS.find((t) => t.key === tab)?.statuses ?? ["proposed"];
    const data = await listActionProposals({
      tenantId: arena.tenant_id, arenaId: arena.id, status: statuses, limit: 100,
    });
    const filtered = modeFilter === "all" ? data : data.filter((p) => (p.execution_mode ?? "approve") === modeFilter);
    setItems(filtered);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tab, arena?.id, modeFilter]);

  const handleApprove = async (p: OrkymActionProposal) => {
    setBusyId(p.id);
    const ap = await approveAction(p.id);
    if (!ap.ok) { toast.error("Falha ao aprovar", { description: ap.error }); setBusyId(null); return; }
    const ex = await executeAction(p.id);
    setBusyId(null);
    if ((ex as any).ok) toast.success("Ação executada");
    else toast.error("Falha ao executar", { description: (ex as any).error });
    load();
  };

  const handleReject = async (p: OrkymActionProposal) => {
    const reason = window.prompt("Motivo da rejeição:", "Não aplicável");
    if (reason === null) return;
    setBusyId(p.id);
    const r = await rejectAction(p.id, reason || "no_reason");
    setBusyId(null);
    if (!r.ok) toast.error("Falha", { description: r.error });
    else toast.success("Rejeitada");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">Ações sugeridas pela ORKYM</h1>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-4">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((t) => (
          <TabsContent key={t.key} value={t.key} className="mt-4 space-y-3">
            {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
            {!loading && items.length === 0 && (
              <Card className="bg-card border-border">
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  Nenhuma ação nesta categoria.
                </CardContent>
              </Card>
            )}
            {items.map((p) => (
              <Card key={p.id} className="bg-card border-border">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] ${statusBadge(p.status)}`}>
                          {p.status}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{p.priority}</Badge>
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          {p.action_type}
                        </Badge>
                      </div>
                      <CardTitle className="text-sm font-medium">{p.title}</CardTitle>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {format(new Date(p.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {p.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>
                  )}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {p.status === "proposed" && (
                      <>
                        <Button size="sm" className="h-7 text-xs" disabled={busyId === p.id}
                          onClick={() => handleApprove(p)}>
                          {busyId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          Aprovar
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={busyId === p.id}
                          onClick={() => handleReject(p)}>
                          <X className="h-3 w-3" /> Rejeitar
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 text-xs ml-auto"
                      onClick={() => setDetail(p)}>
                      Detalhes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        ))}
      </Tabs>

      <ActionProposalDetail proposal={detail} onClose={() => setDetail(null)} />
    </div>
  );
};

export default ArenaActions;
