import { STAGES, stageIndex, type StageId, type NextAction } from "@/lib/tournamentStage";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  current: StageId;
  nextAction: NextAction;
  onAction: (a: NextAction) => void;
}

export default function StageProgress({ current, nextAction, onAction }: Props) {
  const currentIdx = stageIndex(current);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      {/* Steps */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none -mx-1 px-1">
        {STAGES.map((s, idx) => {
          const done = idx < currentIdx;
          const active = idx === currentIdx;
          return (
            <div key={s.id} className="flex items-center gap-1 shrink-0">
              <div
                className={cn(
                  "flex items-center gap-2 px-2.5 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors",
                  active && "bg-primary text-primary-foreground font-semibold",
                  done && !active && "bg-primary/15 text-primary",
                  !done && !active && "bg-muted text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "h-5 w-5 rounded-full grid place-items-center text-[10px] font-bold",
                    active ? "bg-primary-foreground/25" : done ? "bg-primary/25" : "bg-muted-foreground/20"
                  )}
                >
                  {done ? <Check className="h-3 w-3" /> : idx + 1}
                </span>
                <span>{s.label}</span>
              </div>
              {idx < STAGES.length - 1 && (
                <span className={cn("h-px w-4", done ? "bg-primary/40" : "bg-border")} />
              )}
            </div>
          );
        })}
      </div>

      {/* Next action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Próxima ação</p>
          {nextAction.hint && (
            <p className="text-sm text-foreground mt-0.5">{nextAction.hint}</p>
          )}
        </div>
        <Button
          size="lg"
          onClick={() => onAction(nextAction)}
          className="h-12 px-6 text-base font-semibold shrink-0"
        >
          {nextAction.label}
        </Button>
      </div>
    </div>
  );
}
