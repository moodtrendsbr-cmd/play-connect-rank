import { stages } from "./mock/tournamentData";
import { cn } from "@/lib/utils";

export default function StepStepper({ current, onChange }: { current: number; onChange: (id: number) => void }) {
  return (
    <div className="w-full overflow-x-auto scrollbar-none border-b border-border/60 bg-card/40 backdrop-blur">
      <div className="flex items-center gap-1 px-3 py-2 min-w-max">
        {stages.map((s) => {
          const active = s.id === current;
          const done = s.id < current;
          return (
            <button
              key={s.id}
              onClick={() => onChange(s.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all",
                active && "bg-primary text-primary-foreground font-semibold shadow-[0_0_20px_hsl(var(--primary)/0.4)]",
                !active && done && "bg-muted text-foreground/70",
                !active && !done && "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className={cn(
                "h-5 w-5 rounded-full grid place-items-center text-[10px] font-bold",
                active ? "bg-primary-foreground/20" : "bg-muted-foreground/20"
              )}>{s.id}</span>
              <span>{s.short}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
