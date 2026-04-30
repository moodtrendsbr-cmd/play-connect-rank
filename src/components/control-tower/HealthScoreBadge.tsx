import { cn } from "@/lib/utils";

export function scoreColor(score: number | null): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 80) return "text-emerald-500";
  if (score >= 50) return "text-amber-500";
  return "text-destructive";
}

export function scoreBg(score: number | null): string {
  if (score == null) return "bg-muted";
  if (score >= 80) return "bg-emerald-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-destructive";
}

export function HealthScoreBadge({ score, size = "md" }: { score: number | null; size?: "sm" | "md" | "lg" }) {
  const cls = scoreColor(score);
  const sizes = { sm: "text-xl", md: "text-3xl", lg: "text-5xl" };
  return (
    <span className={cn("font-display tabular-nums leading-none", cls, sizes[size])}>
      {score == null ? "—" : score}
    </span>
  );
}
