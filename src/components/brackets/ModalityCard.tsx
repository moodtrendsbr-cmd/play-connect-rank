import { motion } from "framer-motion";
import { Users, Clock, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ModalityCardProps {
  modality: {
    id: string;
    name: string;
    type: string;
    status: string;
    sport?: string | null;
    level?: string | null;
    gender?: string | null;
    start_time?: string | null;
    max_entries?: number | null;
    entryCount?: number;
  };
  onClick: () => void;
}

const typeLabels: Record<string, string> = {
  individual: "Individual",
  dupla: "Dupla",
  trio: "Trio",
  equipe: "Equipe",
  quarteto: "Quarteto",
};

const Pill = ({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "primary" | "secondary" | "danger" }) => {
  const map = {
    muted: "bg-muted text-muted-foreground border-border",
    primary: "bg-primary/15 text-primary border-primary/30",
    secondary: "bg-secondary/15 text-secondary border-secondary/30",
    danger: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${map[tone]}`}>
      {children}
    </span>
  );
};

const formatTime = (t?: string | null) => (t ? t.slice(0, 5) : null);

const ModalityCard = ({ modality, onClick }: ModalityCardProps) => {
  const count = modality.entryCount || 0;
  const max = modality.max_entries || 0;
  const isFull = max > 0 && count >= max;
  const time = formatTime(modality.start_time);

  return (
    <motion.button
      whileHover={{ scale: 1.01, y: -1 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="w-full text-left rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30 group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-2.5">
          <h3 className="text-lg font-display text-foreground tracking-wide leading-tight">
            {modality.name}
          </h3>

          <div className="flex flex-wrap gap-1.5">
            {modality.sport && <Pill>{modality.sport}</Pill>}
            {modality.level && <Pill>{modality.level}</Pill>}
            {modality.gender && <Pill>{modality.gender}</Pill>}
            <Pill>{typeLabels[modality.type] || modality.type}</Pill>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-0.5">
            {time && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {time}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">
                {count}{max > 0 ? ` / ${max}` : ""}
              </span>
              {max > 0 ? " equipes" : count === 1 ? " equipe" : " equipes"}
            </span>
          </div>

          <div>
            {isFull ? (
              <Pill tone="danger">Lotado</Pill>
            ) : (
              <Pill tone="primary">Aberto</Pill>
            )}
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
      </div>
    </motion.button>
  );
};

export default ModalityCard;
