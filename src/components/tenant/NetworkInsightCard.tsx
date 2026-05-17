import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  label: string;
  value: string | number | null;
  hint?: string;
  accent?: "primary" | "emerald" | "amber" | "sky" | "violet";
}

const accentMap = {
  primary: "bg-primary/10 text-primary",
  emerald: "bg-emerald-500/10 text-emerald-500",
  amber:   "bg-amber-500/10 text-amber-500",
  sky:     "bg-sky-500/10 text-sky-500",
  violet:  "bg-violet-500/10 text-violet-500",
};

export function NetworkInsightCard({ icon: Icon, label, value, hint, accent = "primary" }: Props) {
  const display = value ?? "—";
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 flex items-start gap-3">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${accentMap[accent]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground leading-tight">{label}</p>
          <p className="text-base font-semibold text-foreground truncate mt-0.5">{display}</p>
          {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
