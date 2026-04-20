import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Save, Settings2 } from "lucide-react";

interface Props {
  tournamentId: string;
}

const TabCategorias = ({ tournamentId }: Props) => {
  const [modalities, setModalities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tournament_modalities")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("created_at");
    setModalities(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tournamentId]);

  const updateField = (id: string, field: string, value: any) => {
    setModalities((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  };

  const save = async (m: any) => {
    setSaving(m.id);
    const { error } = await supabase
      .from("tournament_modalities")
      .update({
        team_size: Number(m.team_size) || 1,
        phase: m.phase || "groups_then_ko",
        rules_json: m.rules_json || {},
      })
      .eq("id", m.id);
    setSaving(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Categoria atualizada");
  };

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>;
  }

  if (modalities.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Settings2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>Nenhuma categoria configurada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {modalities.map((m) => (
        <Card key={m.id} className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {m.sport || "Modalidade"} · {m.gender || "—"} · {m.level || "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Tamanho de equipe</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={m.team_size ?? 1}
                  onChange={(e) => updateField(m.id, "team_size", parseInt(e.target.value) || 1)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Número de atletas por inscrição</p>
              </div>
              <div>
                <Label className="text-xs">Fase</Label>
                <Select value={m.phase || "groups_then_ko"} onValueChange={(v) => updateField(m.id, "phase", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="groups_only">Apenas grupos</SelectItem>
                    <SelectItem value="ko_only">Apenas mata-mata</SelectItem>
                    <SelectItem value="groups_then_ko">Grupos + mata-mata</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Regras adicionais (JSON)</Label>
              <textarea
                className="mt-1 w-full min-h-[80px] rounded-md border border-input bg-background p-2 text-xs font-mono"
                value={JSON.stringify(m.rules_json || {}, null, 2)}
                onChange={(e) => {
                  try {
                    updateField(m.id, "rules_json", JSON.parse(e.target.value || "{}"));
                  } catch {
                    /* keep typing */
                  }
                }}
                placeholder='{"tiebreak": "super-tiebreak", "match_duration_min": 60}'
              />
            </div>
            <Button onClick={() => save(m)} disabled={saving === m.id} size="sm" className="gap-2">
              <Save className="h-4 w-4" />
              {saving === m.id ? "Salvando..." : "Salvar"}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default TabCategorias;
