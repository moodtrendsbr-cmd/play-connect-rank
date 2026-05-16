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
    try {
      const { data, error } = await supabase.functions.invoke("generate-bracket", {
        body: { modality_id: modalityId, format, num_groups: format === "groups" ? numGroups : undefined },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Chaves geradas com sucesso! 🏐" });
      onOpenChange(false);
      onGenerated();
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || "Falha ao gerar chaves", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
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
                <SelectItem value="double_elimination" disabled>Eliminatória Dupla (em breve)</SelectItem>
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
