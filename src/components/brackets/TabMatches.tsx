import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList } from "lucide-react";
import ScoreEntryDialog from "./ScoreEntryDialog";
import { useEntryMembers } from "@/hooks/useEntryMembers";
import AthleteAvatar from "./AthleteAvatar";

interface TabMatchesProps {
  modalityId: string;
  isOrganizer: boolean;
}

const TabMatches = ({ modalityId, isOrganizer }: TabMatchesProps) => {
  const [matches, setMatches] = useState<any[]>([]);
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

    setMatches(matchData || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [modalityId]);

  const allEntryIds = useMemo(() => {
    return [...new Set(matches.flatMap((m) => [m.entry_a_id, m.entry_b_id].filter(Boolean)))];
  }, [matches]);

  const { entryMembers, membersLoading } = useEntryMembers(allEntryIds);

  if (loading || membersLoading) {
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

  const renderEntryName = (entryId: string | null, isWinner: boolean) => {
    if (!entryId) return <span className="text-muted-foreground text-sm">A definir</span>;
    const em = entryMembers[entryId];
    const members = em?.members || [];

    if (members.length === 0) {
      return (
        <span className={`text-sm font-medium ${isWinner ? "text-primary" : "text-foreground"}`}>
          {em?.entryName || "A definir"}
        </span>
      );
    }

    return (
      <div className="flex flex-wrap gap-2">
        {members.map((m) => (
          <AthleteAvatar key={m.memberId} member={m} showFullName={false} size="h-7 w-7" />
        ))}
      </div>
    );
  };

  const getEntryLabel = (entryId: string | null) => {
    if (!entryId) return "A definir";
    const em = entryMembers[entryId];
    return em?.members?.map((m) => m.firstName).join(" / ") || em?.entryName || "A definir";
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
            <div className="flex-1 space-y-1">
              {renderEntryName(m.entry_a_id, m.winner_entry_id === m.entry_a_id)}
              <p className="text-xs text-muted-foreground">vs</p>
              {renderEntryName(m.entry_b_id, m.winner_entry_id === m.entry_b_id)}
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
          entryAName={getEntryLabel(editingMatch.entry_a_id)}
          entryBName={getEntryLabel(editingMatch.entry_b_id)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
};

export default TabMatches;
