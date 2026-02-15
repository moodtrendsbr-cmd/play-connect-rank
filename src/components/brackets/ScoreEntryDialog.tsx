import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ScoreEntryDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  match: any;
  entryAName: string;
  entryBName: string;
  onSaved: () => void;
}

const ScoreEntryDialog = ({ open, onOpenChange, match, entryAName, entryBName, onSaved }: ScoreEntryDialogProps) => {
  const [scoreA, setScoreA] = useState(match.score_a?.toString() || "");
  const [scoreB, setScoreB] = useState(match.score_b?.toString() || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const a = parseInt(scoreA);
    const b = parseInt(scoreB);
    if (isNaN(a) || isNaN(b)) {
      toast({ title: "Erro", description: "Insira placares válidos.", variant: "destructive" });
      return;
    }

    setSaving(true);

    const winnerId = a > b ? match.entry_a_id : a < b ? match.entry_b_id : null;

    const { error } = await supabase
      .from("modality_matches")
      .update({ score_a: a, score_b: b, winner_entry_id: winnerId, status: "finished" })
      .eq("id", match.id);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    // Advance winner in bracket (single elimination)
    if (winnerId) {
      const nextRound = match.round_number + 1;
      const nextMatchNumber = Math.ceil(match.match_number / 2);

      const { data: nextMatch } = await supabase
        .from("modality_matches")
        .select("*")
        .eq("modality_id", match.modality_id)
        .eq("round_number", nextRound)
        .eq("match_number", nextMatchNumber)
        .is("group_id", null)
        .maybeSingle();

      if (nextMatch) {
        const isFirstSlot = match.match_number % 2 === 1;
        await supabase
          .from("modality_matches")
          .update(isFirstSlot ? { entry_a_id: winnerId } : { entry_b_id: winnerId })
          .eq("id", nextMatch.id);
      }
    }

    toast({ title: "Resultado salvo! ✅" });
    setSaving(false);
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Lançar Resultado</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">{entryAName}</label>
              <Input
                type="number"
                min={0}
                value={scoreA}
                onChange={(e) => setScoreA(e.target.value)}
                className="text-center text-lg font-display"
              />
            </div>
            <span className="text-muted-foreground font-display text-lg mt-4">×</span>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">{entryBName}</label>
              <Input
                type="number"
                min={0}
                value={scoreB}
                onChange={(e) => setScoreB(e.target.value)}
                className="text-center text-lg font-display"
              />
            </div>
          </div>
          <Button onClick={save} disabled={saving} className="w-full box-glow">
            {saving ? "Salvando..." : "Salvar Resultado"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ScoreEntryDialog;
