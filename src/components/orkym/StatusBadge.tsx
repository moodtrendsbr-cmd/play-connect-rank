import { cn } from "@/lib/utils";
import { Bot, CloudOff, AlertTriangle } from "lucide-react";

export type OrkymStatus = "online" | "degraded" | "offline";

interface Props {
  status: OrkymStatus;
  className?: string;
}

const map: Record<OrkymStatus, { label: string; icon: any; cls: string }> = {
  online:   { label: "ORKYM conectada", icon: Bot,           cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  degraded: { label: "ORKYM degradada", icon: AlertTriangle, cls: "bg-amber-500/15  text-amber-400  border-amber-500/30" },
  offline:  { label: "ORKYM offline",   icon: CloudOff,      cls: "bg-muted        text-muted-foreground border-border" },
};

export const OrkymStatusBadge = ({ status, className }: Props) => {
  const cfg = map[status];
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border", cfg.cls, className)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
};
