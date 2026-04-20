import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ScoreEntryDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  match: any;
  entryAName: string;
  entryBName: string;
  courts?: { id: string; name: string }[];
  onSaved: () => void;
}

const ScoreEntryDialog = ({ open, onOpenChange, match, entryAName, entryBName, courts = [], onSaved }: ScoreEntryDialogProps) => {
  const [scoreA, setScoreA] = useState(match.score_a?.toString() || "");
  const [scoreB, setScoreB] = useState(match.score_b?.toString() || "");
  const [status, setStatus] = useState<string>(match.status || "scheduled");
  const [courtId, setCourtId] = useState<string>(match.court_id || "none");
  const [saving, setSaving] = useState(false);

  const advanceWinner = async (winnerId: string | null) => {
    if (!winnerId) return;
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
  };

  const setBye = async (toEntry: "a" | "b") => {
    setSaving(true);
    const winnerId = toEntry === "a" ? match.entry_a_id : match.entry_b_id;
    if (!winnerId) {
      toast({ title: "Erro", description: "Equipe não definida.", variant: "destructive" });
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from("modality_matches")
      .update({
        status: "bye",
        winner_entry_id: winnerId,
        score_a: null,
        score_b: null,
        court_id: courtId === "none" ? null : courtId,
      })
      .eq("id", match.id);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    await advanceWinner(winnerId);
    toast({ title: "BYE registrado ✅" });
    setSaving(false);
    onOpenChange(false);
    onSaved();
  };

  const save = async () => {
    setSaving(true);

    const update: any = {
      status,
      court_id: courtId === "none" ? null : courtId,
    };

    if (status === "finished") {
      const a = parseInt(scoreA);
      const b = parseInt(scoreB);
      if (isNaN(a) || isNaN(b)) {
        toast({ title: "Erro", description: "Insira placares válidos.", variant: "destructive" });
        setSaving(false);
        return;
      }
      const winnerId = a > b ? match.entry_a_id : a < b ? match.entry_b_id : null;
      update.score_a = a;
      update.score_b = b;
      update.winner_entry_id = winnerId;
    } else {
      const a = scoreA === "" ? null : parseInt(scoreA);
      const b = scoreB === "" ? null : parseInt(scoreB);
      update.score_a = isNaN(a as any) ? null : a;
      update.score_b = isNaN(b as any) ? null : b;
      update.winner_entry_id = null;
    }

    const { error } = await supabase.from("modality_matches").update(update).eq("id", match.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    if (status === "finished" && update.winner_entry_id && !match.group_id) {
      await advanceWinner(update.winner_entry_id);
    }

    toast({ title: "Resultado salvo ✅" });
    setSaving(false);
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Agendada</SelectItem>
                <SelectItem value="in_progress">Em andamento</SelectItem>
                <SelectItem value="finished">Finalizada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Quadra</label>
            <Select value={courtId} onValueChange={setCourtId}>
              <SelectTrigger>
                <SelectValue placeholder="Sem quadra atribuída" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem quadra atribuída</SelectItem>
                {courts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={save} disabled={saving} className="w-full box-glow">
            {saving ? "Salvando..." : "Salvar"}
          </Button>

          {!match.group_id && (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setBye("a")} disabled={saving || !match.entry_a_id}>
                BYE → A
              </Button>
              <Button variant="outline" size="sm" onClick={() => setBye("b")} disabled={saving || !match.entry_b_id}>
                BYE → B
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ScoreEntryDialog;
