import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface GenerateBracketDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  modalityId: string;
  onGenerated: () => void;
}

const GenerateBracketDialog = ({ open, onOpenChange, modalityId, onGenerated }: GenerateBracketDialogProps) => {
  const [format, setFormat] = useState("single_elimination");
  const [numGroups, setNumGroups] = useState(2);
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    setGenerating(true);

    // Fetch entries
    const { data: entriesData } = await supabase
      .from("modality_entries")
      .select("id")
      .eq("modality_id", modalityId);

    const entries = entriesData || [];
    if (entries.length < 2) {
      toast({ title: "Erro", description: "Mínimo de 2 inscritos necessário.", variant: "destructive" });
      setGenerating(false);
      return;
    }

    // Delete existing matches for this modality
    await supabase.from("modality_matches").delete().eq("modality_id", modalityId);
    await supabase.from("modality_groups").delete().eq("modality_id", modalityId);

    // Shuffle
    const shuffled = [...entries].sort(() => Math.random() - 0.5);
    const newMatches: any[] = [];

    if (format === "single_elimination") {
      const totalRounds = Math.ceil(Math.log2(shuffled.length));
      const firstRoundSize = Math.ceil(shuffled.length / 2);

      for (let i = 0; i < firstRoundSize; i++) {
        newMatches.push({
          modality_id: modalityId,
          round_number: 1,
          match_number: i + 1,
          entry_a_id: shuffled[i * 2]?.id || null,
          entry_b_id: shuffled[i * 2 + 1]?.id || null,
        });
      }

      for (let round = 2; round <= totalRounds; round++) {
        const matchesInRound = Math.ceil(firstRoundSize / Math.pow(2, round - 1));
        for (let i = 0; i < matchesInRound; i++) {
          newMatches.push({
            modality_id: modalityId,
            round_number: round,
            match_number: i + 1,
            entry_a_id: null,
            entry_b_id: null,
          });
        }
      }
    } else if (format === "round_robin") {
      let matchNum = 1;
      for (let i = 0; i < shuffled.length; i++) {
        for (let j = i + 1; j < shuffled.length; j++) {
          newMatches.push({
            modality_id: modalityId,
            round_number: 1,
            match_number: matchNum++,
            entry_a_id: shuffled[i].id,
            entry_b_id: shuffled[j].id,
          });
        }
      }
    } else if (format === "groups") {
      // Create groups
      const groupNames = "ABCDEFGH".split("").slice(0, numGroups);
      const { data: createdGroups } = await supabase
        .from("modality_groups")
        .insert(groupNames.map((name) => ({ modality_id: modalityId, group_name: name })))
        .select();

      if (createdGroups) {
        // Distribute entries into groups
        const groupMembers: any[] = [];
        shuffled.forEach((entry, idx) => {
          const groupIdx = idx % createdGroups.length;
          groupMembers.push({
            group_id: createdGroups[groupIdx].id,
            entry_id: entry.id,
          });
        });
        await supabase.from("modality_group_members").insert(groupMembers);

        // Create round-robin matches within each group
        let matchNum = 1;
        for (const group of createdGroups) {
          const groupEntries = groupMembers
            .filter((gm) => gm.group_id === group.id)
            .map((gm) => gm.entry_id);

          for (let i = 0; i < groupEntries.length; i++) {
            for (let j = i + 1; j < groupEntries.length; j++) {
              newMatches.push({
                modality_id: modalityId,
                group_id: group.id,
                round_number: 1,
                match_number: matchNum++,
                entry_a_id: groupEntries[i],
                entry_b_id: groupEntries[j],
              });
            }
          }
        }
      }
    } else if (format === "double_elimination") {
      const firstRoundSize = Math.ceil(shuffled.length / 2);
      for (let i = 0; i < firstRoundSize; i++) {
        newMatches.push({
          modality_id: modalityId,
          round_number: 1,
          match_number: i + 1,
          entry_a_id: shuffled[i * 2]?.id || null,
          entry_b_id: shuffled[i * 2 + 1]?.id || null,
        });
      }
      for (let i = 0; i < firstRoundSize; i++) {
        newMatches.push({
          modality_id: modalityId,
          round_number: 2,
          match_number: i + 1,
          entry_a_id: null,
          entry_b_id: null,
        });
      }
    }

    if (newMatches.length > 0) {
      const { error } = await supabase.from("modality_matches").insert(newMatches);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        setGenerating(false);
        return;
      }
    }

    // Update modality status
    await supabase
      .from("tournament_modalities")
      .update({ status: "bracket_generated", bracket_format: format, num_groups: format === "groups" ? numGroups : 0 })
      .eq("id", modalityId);

    toast({ title: "Chaves geradas com sucesso! 🏐" });
    setGenerating(false);
    onOpenChange(false);
    onGenerated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Gerar Chaveamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Formato</label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="single_elimination">Eliminatória Simples</SelectItem>
                <SelectItem value="double_elimination">Eliminatória Dupla</SelectItem>
                <SelectItem value="round_robin">Todos contra Todos</SelectItem>
                <SelectItem value="groups">Fase de Grupos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {format === "groups" && (
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Quantidade de grupos</label>
              <Input
                type="number"
                min={2}
                max={8}
                value={numGroups}
                onChange={(e) => setNumGroups(Number(e.target.value))}
              />
            </div>
          )}

          <Button onClick={generate} disabled={generating} className="w-full box-glow">
            {generating ? "Gerando..." : "✨ Gerar Automaticamente"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GenerateBracketDialog;
