import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Users, Trophy, Layers, Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import TabEntries from "./TabEntries";
import TabGroups from "./TabGroups";
import TabMatches from "./TabMatches";
import TabPlacements from "./TabPlacements";

interface ModalityDetailProps {
  modality: any;
  tournamentId: string;
  isOrganizer: boolean;
  onBack: () => void;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  open: { label: "Inscrições Abertas", className: "bg-primary/15 text-primary border-primary/30" },
  closed: { label: "Inscrições Encerradas", className: "bg-secondary/15 text-secondary border-secondary/30" },
  bracket_generated: { label: "Em Andamento", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  finished: { label: "Finalizado", className: "bg-muted text-muted-foreground border-border" },
};

const formatLabels: Record<string, string> = {
  single_elimination: "Eliminatória Simples",
  double_elimination: "Eliminatória Dupla",
  round_robin: "Todos contra Todos",
  groups: "Grupos + Mata-Mata",
};

const Pill = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${className}`}>
    {children}
  </span>
);

const ModalityDetail = ({ modality, tournamentId, isOrganizer, onBack }: ModalityDetailProps) => {
  const status = statusConfig[modality.status] || statusConfig.open;
  const [entryCount, setEntryCount] = useState(0);

  useEffect(() => {
    const fetch = async () => {
      const { count } = await supabase
        .from("modality_entries")
        .select("id", { count: "exact", head: true })
        .eq("modality_id", modality.id);
      setEntryCount(count || 0);
    };
    fetch();
  }, [modality.id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 mt-1">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl sm:text-3xl font-display text-foreground tracking-wide leading-tight">
            {modality.name}
          </h2>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {modality.sport && <Pill className="bg-muted text-muted-foreground border-border">{modality.sport}</Pill>}
            {modality.level && <Pill className="bg-muted text-muted-foreground border-border">{modality.level}</Pill>}
            {modality.gender && <Pill className="bg-muted text-muted-foreground border-border">{modality.gender}</Pill>}
            <Pill className={status.className}>{status.label}</Pill>
          </div>
        </div>
      </div>

      {/* Resumo card */}
      <div className="rounded-xl border border-border bg-card p-4 mb-6 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Formato</p>
          <p className="font-medium text-foreground mt-0.5">
            {formatLabels[modality.bracket_format] || "—"}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Equipes</p>
          <p className="font-medium text-foreground mt-0.5">
            {entryCount}{modality.max_entries ? ` / ${modality.max_entries}` : ""}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Sets para vencer</p>
          <p className="font-medium text-foreground mt-0.5">{modality.sets_to_win || 1}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Pontos por set</p>
          <p className="font-medium text-foreground mt-0.5">{modality.points_per_set || 21}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="entries" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto bg-card border border-border mb-6">
          <TabsTrigger value="entries" className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Inscritos
          </TabsTrigger>
          <TabsTrigger value="groups" className="gap-1.5">
            <Layers className="h-3.5 w-3.5" /> Grupos
          </TabsTrigger>
          <TabsTrigger value="matches" className="gap-1.5">
            <Gamepad2 className="h-3.5 w-3.5" /> Jogos
          </TabsTrigger>
          <TabsTrigger value="placements" className="gap-1.5">
            <Trophy className="h-3.5 w-3.5" /> Pódio
          </TabsTrigger>
        </TabsList>

        <TabsContent value="entries">
          <TabEntries modalityId={modality.id} tournamentId={tournamentId} isOrganizer={isOrganizer} />
        </TabsContent>
        <TabsContent value="groups">
          <TabGroups modalityId={modality.id} numGroups={modality.num_groups || 0} />
        </TabsContent>
        <TabsContent value="matches">
          <TabMatches modalityId={modality.id} tournamentId={tournamentId} isOrganizer={isOrganizer} />
        </TabsContent>
        <TabsContent value="placements">
          <TabPlacements modalityId={modality.id} />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default ModalityDetail;
