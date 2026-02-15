import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import TabEntries from "./TabEntries";
import TabGroups from "./TabGroups";
import TabBracketView from "./TabBracketView";
import TabMatches from "./TabMatches";
import TabPlacements from "./TabPlacements";
import TabPartners from "./TabPartners";

interface ModalityDetailProps {
  modality: any;
  tournamentId: string;
  isOrganizer: boolean;
  onBack: () => void;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  open: { label: "Inscrições Abertas", className: "bg-primary/20 text-primary border-primary/30" },
  closed: { label: "Inscrições Encerradas", className: "bg-secondary/20 text-secondary border-secondary/30" },
  bracket_generated: { label: "Em Andamento", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  finished: { label: "Finalizado", className: "bg-muted text-muted-foreground border-border" },
};

const ModalityDetail = ({ modality, tournamentId, isOrganizer, onBack }: ModalityDetailProps) => {
  const status = statusConfig[modality.status] || statusConfig.open;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-3xl font-display text-foreground tracking-wide">
            {modality.name}
          </h2>
          <Badge variant="outline" className={status.className}>
            {status.label}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="entries" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto bg-card border border-border mb-6">
          <TabsTrigger value="entries">Inscritos</TabsTrigger>
          <TabsTrigger value="groups">Grupos</TabsTrigger>
          <TabsTrigger value="bracket">Chaveamento</TabsTrigger>
          <TabsTrigger value="matches">Jogos</TabsTrigger>
          <TabsTrigger value="placements">Top 4</TabsTrigger>
          <TabsTrigger value="partners">Parceiros</TabsTrigger>
        </TabsList>

        <TabsContent value="entries">
          <TabEntries modalityId={modality.id} isOrganizer={isOrganizer} />
        </TabsContent>
        <TabsContent value="groups">
          <TabGroups modalityId={modality.id} />
        </TabsContent>
        <TabsContent value="bracket">
          <TabBracketView modalityId={modality.id} isOrganizer={isOrganizer} />
        </TabsContent>
        <TabsContent value="matches">
          <TabMatches modalityId={modality.id} isOrganizer={isOrganizer} />
        </TabsContent>
        <TabsContent value="placements">
          <TabPlacements modalityId={modality.id} />
        </TabsContent>
        <TabsContent value="partners">
          <TabPartners tournamentId={tournamentId} />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default ModalityDetail;
