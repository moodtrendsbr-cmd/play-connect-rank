import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  label: string;
  used: number;
  limit: number; // -1 = unlimited, 0 = disabled
  projected?: number;
  icon?: React.ReactNode;
}

export const UsageMeter = ({ label, used, limit, projected, icon }: Props) => {
  const isUnlimited = limit === -1;
  const isDisabled = limit === 0;
  const pct = isUnlimited || isDisabled ? 0 : Math.min(100, Math.round((used / limit) * 100));

  const barColor =
    isDisabled ? "bg-muted-foreground/40"
    : isUnlimited ? "bg-emerald-500/70"
    : pct >= 80 ? "bg-destructive"
    : pct >= 50 ? "bg-amber-500"
    : "bg-emerald-500";

  const limitDisplay =
    isUnlimited ? "ilimitado"
    : isDisabled ? "indisponível neste plano"
    : limit.toLocaleString("pt-BR");

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="text-muted-foreground shrink-0">{icon}</span>}
          <span className="text-sm font-medium text-foreground truncate">{label}</span>
        </div>
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground tabular-nums">
                {used.toLocaleString("pt-BR")} / {limitDisplay}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs max-w-[260px]">
              {isDisabled ? (
                <p>Recurso indisponível no plano atual. Faça upgrade para liberar.</p>
              ) : isUnlimited ? (
                <p>Uso ilimitado neste plano.</p>
              ) : (
                <>
                  <p>{pct}% consumido este mês</p>
                  {projected !== undefined && projected > 0 && (
                    <p className="text-muted-foreground mt-0.5">
                      Projeção fim do mês: {Math.round(projected).toLocaleString("pt-BR")}
                    </p>
                  )}
                </>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full transition-all ${barColor}`}
          style={{ width: isUnlimited ? "100%" : `${pct}%` }}
        />
      </div>
    </div>
  );
};
