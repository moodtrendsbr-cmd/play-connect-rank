import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Check, X, RefreshCw, ArrowRight, Loader2 } from "lucide-react";
import {
  listActionProposals, approveAction, executeAction, rejectAction,
  type OrkymActionProposal,
} from "@/lib/orkym";
import { toast } from "sonner";
import { ActionProposalDetail } from "./ActionProposalDetail";
import { PolicyDecisionBadge } from "@/components/autonomy/PolicyDecisionBadge";
import { WhatsAppCTA } from "@/components/conversational/WhatsAppCTA";
import { Link } from "react-router-dom";

interface Props {
  tenantId: string;
  arenaId?: string;
  arenaSlug?: string;
  maxItems?: number;
  showSeeAllLink?: boolean;
}

const priorityColor = (p: string) =>
  p === "high" ? "bg-destructive/15 text-destructive border-destructive/30"
  : p === "medium" ? "bg-amber-500/15 text-amber-500 border-amber-500/30"
  : "bg-muted text-muted-foreground border-border";

const domainLabel: Record<string, string> = {
  arena_operations: "Operações",
  finance: "Financeiro",
  tournaments: "Torneios",
  growth: "Crescimento",
};

export const OrkymActionsCard = ({
  tenantId, arenaId, arenaSlug, maxItems = 3, showSeeAllLink = true,
}: Props) => {
  const [items, setItems] = useState<OrkymActionProposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrkymActionProposal | null>(null);

  const load = async () => {
    setLoading(true);
    const data = await listActionProposals({
      tenantId, arenaId, status: "proposed", limit: maxItems,
    });
    setItems(data);
    setLoading(false);
  };

  useEffect(() => { if (tenantId) load(); }, [tenantId, arenaId]);

  const handleApprove = async (p: OrkymActionProposal) => {
    setBusyId(p.id);
    const ap = await approveAction(p.id);
    if (!ap.ok) {
      toast.error("Não foi possível aprovar", { description: ap.error });
      setBusyId(null);
      return;
    }
    const ex = await executeAction(p.id);
    setBusyId(null);
    if ((ex as any).ok) {
      toast.success("Ação executada com sucesso");
    } else {
      toast.error("Falha ao executar", { description: (ex as any).error });
    }
    load();
  };

  const handleReject = async (p: OrkymActionProposal) => {
    const reason = window.prompt("Motivo da rejeição (opcional):", "Não aplicável agora");
    if (reason === null) return;
    setBusyId(p.id);
    const r = await rejectAction(p.id, reason || "no_reason");
    setBusyId(null);
    if (!r.ok) toast.error("Não foi possível rejeitar", { description: r.error });
    else toast.success("Proposta rejeitada");
    load();
  };

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Ações sugeridas pela ORKYM
            {items.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 text-xs">{items.length}</Badge>
            )}
          </CardTitle>
          <Button size="icon" variant="ghost" onClick={load} disabled={loading} className="h-8 w-8">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading && items.length === 0 && (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          )}
          {!loading && items.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma ação aguardando aprovação.</p>
          )}
          {items.map((p) => (
            <div key={p.id} className="p-3 rounded-lg bg-muted/30 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" className={`text-[10px] h-4 px-1.5 ${priorityColor(p.priority)}`}>
                      {p.priority === "high" ? "alta" : p.priority === "medium" ? "média" : "baixa"}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground border-border">
                      {domainLabel[p.domain] ?? p.domain}
                    </Badge>
                    <PolicyDecisionBadge
                      mode={p.execution_mode ?? null}
                      source={p.policy_source ?? null}
                      autoExecuted={p.auto_executed ?? false}
                    />
                    {(p.policy_source === "quota_auto" ||
                      p.policy_source === "quota_suggestions" ||
                      p.policy_source === "tier_no_auto" ||
                      p.policy_source === "tier_domain_block") && (
                      <Badge
                        variant="outline"
                        className="text-[10px] h-4 px-1.5 bg-muted text-muted-foreground border-border"
                        title="Modo rebaixado por limite ou plano"
                      >
                        rebaixada por plano
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground line-clamp-2">{p.title}</p>
                  {p.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm" variant="default" className="h-7 text-xs"
                  disabled={busyId === p.id}
                  onClick={() => handleApprove(p)}
                >
                  {busyId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  Aprovar
                </Button>
                <Button
                  size="sm" variant="ghost" className="h-7 text-xs"
                  disabled={busyId === p.id}
                  onClick={() => handleReject(p)}
                >
                  <X className="h-3 w-3" /> Rejeitar
                </Button>
                <Button
                  size="sm" variant="ghost" className="h-7 text-xs ml-auto"
                  onClick={() => setDetail(p)}
                >
                  Detalhes
                </Button>
              </div>
              <WhatsAppCTA
                variant="inline"
                command={`Aprovar ação ${p.id} — ${p.title}`}
                label="Continuar no WhatsApp"
                payload={{
                  channel: "dashboard_cta",
                  profile_type: arenaSlug ? "arena" : "tenant",
                  input_text: `Aprovar ação ${p.id} — ${p.title}`,
                  parsed_intent: { intent: "approve_action", proposal_id: p.id },
                  arena_id: arenaId,
                  tenant_id: tenantId,
                }}
              />
            </div>
          ))}
          {showSeeAllLink && arenaSlug && (
            <Link
              to={`/arena/${arenaSlug}/actions`}
              className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
            >
              Ver todas as ações <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </CardContent>
      </Card>

      <ActionProposalDetail proposal={detail} onClose={() => setDetail(null)} />
    </>
  );
};
