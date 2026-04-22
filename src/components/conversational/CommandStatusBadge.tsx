import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending:           { label: "Pendente",   cls: "bg-muted text-muted-foreground border-border" },
  dispatched:        { label: "Sugerido",   cls: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  executed:          { label: "Executado",  cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  failed:            { label: "Falhou",     cls: "bg-destructive/15 text-destructive border-destructive/30" },
  no_action:         { label: "Sem ação",   cls: "bg-muted text-muted-foreground border-border" },
  rate_limited:      { label: "Limitado",   cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  identity_required: { label: "Sem WhatsApp", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
};

interface Props {
  status: string;
  className?: string;
}

export const CommandStatusBadge = ({ status, className }: Props) => {
  const meta = STATUS_MAP[status] ?? { label: status, cls: "bg-muted text-muted-foreground border-border" };
  return (
    <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 font-medium", meta.cls, className)}>
      {meta.label}
    </Badge>
  );
};
