import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Bot, Calendar, User, Tag, AlertCircle } from "lucide-react";
import type { OrkymActionProposal } from "@/lib/orkym";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  proposal: OrkymActionProposal | null;
  onClose: () => void;
}

const statusLabel: Record<string, { label: string; cls: string }> = {
  proposed: { label: "Proposta", cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  approved: { label: "Aprovada", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  executing: { label: "Executando", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  executed: { label: "Executada", cls: "bg-emerald-600/15 text-emerald-500 border-emerald-600/30" },
  failed: { label: "Falhou", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  rejected: { label: "Rejeitada", cls: "bg-muted text-muted-foreground border-border" },
  expired: { label: "Expirada", cls: "bg-muted text-muted-foreground border-border" },
  canceled: { label: "Cancelada", cls: "bg-muted text-muted-foreground border-border" },
};

export const ActionProposalDetail = ({ proposal, onClose }: Props) => {
  if (!proposal) return null;
  const s = statusLabel[proposal.status] ?? statusLabel.proposed;
  const human = (proposal.human_summary ?? {}) as Record<string, any>;
  const fmt = (d?: string | null) =>
    d ? format(new Date(d), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "—";

  return (
    <Sheet open={!!proposal} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-3">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <Badge variant="outline" className={`text-xs ${s.cls}`}>{s.label}</Badge>
            <Badge variant="outline" className="text-xs">{proposal.priority}</Badge>
          </div>
          <SheetTitle className="text-left">{proposal.title}</SheetTitle>
          {proposal.description && (
            <SheetDescription className="text-left">{proposal.description}</SheetDescription>
          )}
        </SheetHeader>

        <div className="mt-6 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <Field icon={Tag} label="Tipo" value={proposal.action_type} />
            <Field icon={Tag} label="Domínio" value={proposal.domain} />
            <Field icon={Calendar} label="Criada em" value={fmt(proposal.created_at)} />
            <Field icon={Calendar} label="Expira em" value={fmt(proposal.expires_at)} />
          </div>

          {proposal.related_entity_type && (
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Entidade relacionada</p>
              <p className="text-sm text-foreground">
                {proposal.related_entity_type}
                {proposal.related_entity_id && (
                  <span className="text-muted-foreground"> · {proposal.related_entity_id.slice(0, 8)}…</span>
                )}
              </p>
            </div>
          )}

          {proposal.approved_at && (
            <Field icon={User} label="Aprovada em" value={fmt(proposal.approved_at)} />
          )}
          {proposal.executed_at && (
            <Field icon={User} label="Executada em" value={fmt(proposal.executed_at)} />
          )}
          {proposal.rejection_reason && (
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Motivo da rejeição</p>
              <p className="text-sm text-foreground">{proposal.rejection_reason}</p>
            </div>
          )}
          {proposal.failure_reason && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
              <div>
                <p className="text-xs uppercase tracking-wider text-destructive mb-1">Falha</p>
                <p className="text-sm text-foreground">{proposal.failure_reason}</p>
              </div>
            </div>
          )}

          {Object.keys(human).length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Resumo</p>
              <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-1.5">
                {Object.entries(human).map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
                    <span className="text-foreground text-right break-all">
                      {typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

const Field = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <div className="flex items-start gap-2">
    <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground truncate">{value}</p>
    </div>
  </div>
);
