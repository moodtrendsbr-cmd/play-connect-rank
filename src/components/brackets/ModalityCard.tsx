import { motion } from "framer-motion";
import { Users, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ModalityCardProps {
  modality: {
    id: string;
    name: string;
    type: string;
    status: string;
    entryCount?: number;
  };
  onClick: () => void;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  open: { label: "Inscrições Abertas", className: "bg-primary/20 text-primary border-primary/30" },
  closed: { label: "Inscrições Encerradas", className: "bg-secondary/20 text-secondary border-secondary/30" },
  bracket_generated: { label: "Em Andamento", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  finished: { label: "Finalizado", className: "bg-muted text-muted-foreground border-border" },
};

const typeLabels: Record<string, string> = {
  individual: "Individual",
  dupla: "Dupla",
  trio: "Trio",
  equipe: "Equipe",
};

const ModalityCard = ({ modality, onClick }: ModalityCardProps) => {
  const status = statusConfig[modality.status] || statusConfig.open;

  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full text-left rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/30 group"
    >
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h3 className="text-xl font-display text-foreground tracking-wide">
            {modality.name}
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              {typeLabels[modality.type] || modality.type}
            </span>
            <Badge variant="outline" className={status.className}>
              {status.label}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>{modality.entryCount || 0} inscritos</span>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
    </motion.button>
  );
};

export default ModalityCard;
