import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList } from "lucide-react";
import ScoreEntryDialog from "./ScoreEntryDialog";

interface TabMatchesProps {
  modalityId: string;
  isOrganizer: boolean;
}

const TabMatches = ({ modalityId, isOrganizer }: TabMatchesProps) => {
  const [matches, setMatches] = useState<any[]>([]);
  const [entries, setEntries] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [editingMatch, setEditingMatch] = useState<any>(null);

  const fetchData = async () => {
    setLoading(true);
    const { data: matchData } = await supabase
      .from("modality_matches")
      .select("*")
      .eq("modality_id", modalityId)
      .order("round_number")
      .order("match_number");

    const mList = matchData || [];
    setMatches(mList);

    const entryIds = [...new Set(mList.flatMap((m) => [m.entry_a_id, m.entry_b_id].filter(Boolean)))];
    if (entryIds.length > 0) {
      const { data: entryData } = await supabase
        .from("modality_entries")
        .select("*")
        .in("id", entryIds);
      const map: Record<string, any> = {};
      (entryData || []).forEach((e) => { map[e.id] = e; });
      setEntries(map);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [modalityId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>Nenhuma partida registrada.</p>
      </div>
    );
  }

  const getEntryName = (id: string | null) => {
    if (!id) return "A definir";
    return entries[id]?.name || "A definir";
  };

  const statusBadge = (status: string) => {
    const configs: Record<string, { label: string; className: string }> = {
      scheduled: { label: "Agendado", className: "bg-muted text-muted-foreground" },
      in_progress: { label: "Em jogo", className: "bg-blue-500/20 text-blue-400" },
      finished: { label: "Finalizado", className: "bg-primary/20 text-primary" },
    };
    const c = configs[status] || configs.scheduled;
    return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
  };

  return (
    <div className="space-y-3">
      {matches.map((m) => (
        <div key={m.id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">
              Rodada {m.round_number} • Jogo {m.match_number}
            </span>
            {statusBadge(m.status)}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className={`text-sm font-medium ${m.winner_entry_id === m.entry_a_id ? "text-primary" : "text-foreground"}`}>
                {getEntryName(m.entry_a_id)}
              </p>
              <p className="text-xs text-muted-foreground my-1">vs</p>
              <p className={`text-sm font-medium ${m.winner_entry_id === m.entry_b_id ? "text-primary" : "text-foreground"}`}>
                {getEntryName(m.entry_b_id)}
              </p>
            </div>
            <div className="text-right">
              {m.score_a !== null && m.score_b !== null && (
                <p className="text-lg font-display text-foreground">
                  {m.score_a} × {m.score_b}
                </p>
              )}
              {isOrganizer && m.status !== "finished" && m.entry_a_id && m.entry_b_id && (
                <Button size="sm" variant="outline" onClick={() => setEditingMatch(m)} className="mt-1">
                  Lançar
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}

      {editingMatch && (
        <ScoreEntryDialog
          open={!!editingMatch}
          onOpenChange={(v) => !v && setEditingMatch(null)}
          match={editingMatch}
          entryAName={getEntryName(editingMatch.entry_a_id)}
          entryBName={getEntryName(editingMatch.entry_b_id)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
};

export default TabMatches;
