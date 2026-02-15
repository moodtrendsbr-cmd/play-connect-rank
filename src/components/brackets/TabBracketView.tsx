import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import GenerateBracketDialog from "./GenerateBracketDialog";

interface TabBracketViewProps {
  modalityId: string;
  isOrganizer: boolean;
}

const TabBracketView = ({ modalityId, isOrganizer }: TabBracketViewProps) => {
  const [matches, setMatches] = useState<any[]>([]);
  const [entries, setEntries] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const { data: matchData } = await supabase
      .from("modality_matches")
      .select("*")
      .eq("modality_id", modalityId)
      .is("group_id", null)
      .order("round_number")
      .order("match_number");

    const mList = matchData || [];
    setMatches(mList);

    const entryIds = [...new Set(mList.flatMap((m) => [m.entry_a_id, m.entry_b_id, m.winner_entry_id].filter(Boolean)))];
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
      <div className="flex gap-8 overflow-x-auto pb-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-4 min-w-[200px]">
            {[1, 2, 3, 4].map((j) => (
              <Skeleton key={j} className="h-16 rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-12">
        <GitBranch className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
        <p className="text-muted-foreground mb-4">Chaveamento ainda não gerado.</p>
        {isOrganizer && (
          <>
            <Button onClick={() => setShowGenerate(true)} className="box-glow">
              ✨ Gerar Chaveamento
            </Button>
            <GenerateBracketDialog
              open={showGenerate}
              onOpenChange={setShowGenerate}
              modalityId={modalityId}
              onGenerated={fetchData}
            />
          </>
        )}
      </div>
    );
  }

  // Group by round
  const rounds: Record<number, any[]> = {};
  matches.forEach((m) => {
    if (!rounds[m.round_number]) rounds[m.round_number] = [];
    rounds[m.round_number].push(m);
  });

  const roundKeys = Object.keys(rounds).map(Number).sort((a, b) => a - b);

  const getEntryName = (id: string | null) => {
    if (!id) return "A definir";
    return entries[id]?.name || "A definir";
  };

  return (
    <div>
      {isOrganizer && (
        <>
          <Button variant="outline" size="sm" onClick={() => setShowGenerate(true)} className="mb-4">
            Regerar Chaveamento
          </Button>
          <GenerateBracketDialog
            open={showGenerate}
            onOpenChange={setShowGenerate}
            modalityId={modalityId}
            onGenerated={fetchData}
          />
        </>
      )}

      <div className="flex gap-6 overflow-x-auto pb-4">
        {roundKeys.map((round, roundIdx) => {
          const roundMatches = rounds[round];
          const isLast = roundIdx === roundKeys.length - 1;

          return (
            <div key={round} className="flex flex-col min-w-[220px]">
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 text-center font-display">
                {isLast && roundKeys.length > 1 ? "Final" : `Rodada ${round}`}
              </h4>
              <div
                className="flex flex-col justify-around flex-1"
                style={{ gap: `${Math.pow(2, roundIdx) * 8}px` }}
              >
                {roundMatches.map((m: any) => {
                  const isFinished = m.status === "finished";
                  const aWon = m.winner_entry_id === m.entry_a_id;
                  const bWon = m.winner_entry_id === m.entry_b_id;

                  return (
                    <div
                      key={m.id}
                      className={`rounded-lg border bg-card overflow-hidden transition-all ${
                        isFinished ? "border-primary/30" : "border-border"
                      }`}
                    >
                      <div
                        className={`flex items-center justify-between px-3 py-2 text-sm border-b border-border/50 ${
                          aWon ? "bg-primary/10" : ""
                        }`}
                      >
                        <span className={`truncate ${aWon ? "text-primary font-semibold" : "text-foreground"}`}>
                          {getEntryName(m.entry_a_id)}
                        </span>
                        {m.score_a !== null && (
                          <span className="text-muted-foreground font-mono ml-2">{m.score_a}</span>
                        )}
                      </div>
                      <div
                        className={`flex items-center justify-between px-3 py-2 text-sm ${
                          bWon ? "bg-primary/10" : ""
                        }`}
                      >
                        <span className={`truncate ${bWon ? "text-primary font-semibold" : "text-foreground"}`}>
                          {getEntryName(m.entry_b_id)}
                        </span>
                        {m.score_b !== null && (
                          <span className="text-muted-foreground font-mono ml-2">{m.score_b}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TabBracketView;
