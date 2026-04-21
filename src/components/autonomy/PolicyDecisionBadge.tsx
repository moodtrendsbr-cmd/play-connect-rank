import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Zap, Shield, ShieldCheck, ShieldAlert } from "lucide-react";
import { modeLabel, policySourceLabel, type ExecutionMode } from "@/lib/autonomy";

interface Props {
  mode?: ExecutionMode | null;
  source?: string | null;
  autoExecuted?: boolean | null;
  size?: "sm" | "md";
}

const modeStyle: Record<ExecutionMode, string> = {
  suggest: "bg-muted text-muted-foreground border-border",
  approve: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  auto:    "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

const ModeIcon = ({ mode }: { mode: ExecutionMode }) => {
  if (mode === "auto") return <Zap className="h-3 w-3" />;
  if (mode === "approve") return <ShieldCheck className="h-3 w-3" />;
  return <Shield className="h-3 w-3" />;
};

export const PolicyDecisionBadge = ({ mode, source, autoExecuted, size = "sm" }: Props) => {
  if (!mode) return null;
  const sourceTxt = source ? (policySourceLabel[source] ?? source) : "—";
  const heightCls = size === "sm" ? "h-4 px-1.5 text-[10px]" : "h-5 px-2 text-xs";

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1">
            <Badge variant="outline" className={`inline-flex items-center gap-1 ${heightCls} ${modeStyle[mode]}`}>
              <ModeIcon mode={mode} />
              {modeLabel[mode]}
            </Badge>
            {autoExecuted && (
              <Badge variant="outline" className={`inline-flex items-center gap-1 ${heightCls} bg-emerald-600/15 text-emerald-500 border-emerald-600/30`}>
                <Zap className="h-3 w-3" /> auto
              </Badge>
            )}
            {source === "kill_switch" && (
              <Badge variant="outline" className={`inline-flex items-center gap-1 ${heightCls} bg-destructive/15 text-destructive border-destructive/30`}>
                <ShieldAlert className="h-3 w-3" /> kill
              </Badge>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px] text-xs">
          <p className="font-medium">{modeLabel[mode]}</p>
          <p className="text-muted-foreground mt-0.5">Fonte: {sourceTxt}</p>
          {autoExecuted && <p className="text-emerald-500 mt-0.5">⚡ Executada automaticamente</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
