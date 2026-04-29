import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Layers, Trophy, Shuffle, Loader2 } from "lucide-react";
import { useEntryMembers } from "@/hooks/useEntryMembers";
import AthleteAvatar from "./AthleteAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface TabGroupsProps {
  modalityId: string;
  numGroups?: number;
  canManage?: boolean;
}

interface Standing {
  entryId: string;
  played: number;
  wins: number;
  losses: number;
  pf: number;
  pa: number;
  diff: number;
  points: number;
}

const TabGroups = ({ modalityId, canManage = false }: TabGroupsProps) => {
  const [groups, setGroups] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [numGroupsInput, setNumGroupsInput] = useState("2");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: groupsData } = await supabase
      .from("modality_groups")
      .select("*")
      .eq("modality_id", modalityId)
      .order("group_name");

    const gList = groupsData || [];

    if (gList.length > 0) {
      const groupIds = gList.map((g) => g.id);
      const [{ data: members }, { data: matchData }] = await Promise.all([
        supabase
          .from("modality_group_members")
          .select("*, modality_entries(*)")
          .in("group_id", groupIds),
        supabase
          .from("modality_matches")
          .select("*")
          .in("group_id", groupIds),
      ]);

      const enriched = gList.map((g) => ({
        ...g,
        members: (members || []).filter((m) => m.group_id === g.id),
      }));
      setGroups(enriched);
      setMatches(matchData || []);
    } else {
      setGroups([]);
    }
    setLoading(false);
  }, [modalityId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSortear = async () => {
    const n = parseInt(numGroupsInput, 10);
    if (!n || n < 1 || n > 32) {
      toast.error("Informe um número de grupos entre 1 e 32");
      return;
    }
    setDrawing(true);
    const { data, error } = await supabase.rpc("sortear_grupos", {
      _modality_id: modalityId,
      _num_groups: n,
    });
    setDrawing(false);
    if (error) {
      toast.error("Falha ao sortear", { description: error.message });
      return;
    }
    toast.success(`Sorteio concluído: ${(data as any)?.distributed ?? 0} entradas em ${n} grupos`);
    fetchData();
  };

  const allEntryIds = useMemo(() => {
    const ids: string[] = [];
    groups.forEach((g) => g.members?.forEach((m: any) => m.entry_id && ids.push(m.entry_id)));
    return [...new Set(ids)];
  }, [groups]);

  const { entryMembers, membersLoading } = useEntryMembers(allEntryIds);

  const computeStandings = (group: any): Standing[] => {
    const entryIds: string[] = group.members.map((m: any) => m.entry_id);
    const standings: Record<string, Standing> = {};
    entryIds.forEach((id) => {
      standings[id] = { entryId: id, played: 0, wins: 0, losses: 0, pf: 0, pa: 0, diff: 0, points: 0 };
    });

    matches
      .filter((m) => m.group_id === group.id && m.status === "finished")
      .forEach((m) => {
        const a = standings[m.entry_a_id];
        const b = standings[m.entry_b_id];
        if (!a || !b) return;
        a.played += 1; b.played += 1;
        a.pf += m.score_a || 0; a.pa += m.score_b || 0;
        b.pf += m.score_b || 0; b.pa += m.score_a || 0;
        if (m.winner_entry_id === m.entry_a_id) { a.wins += 1; a.points += 2; b.losses += 1; }
        else if (m.winner_entry_id === m.entry_b_id) { b.wins += 1; b.points += 2; a.losses += 1; }
      });

    Object.values(standings).forEach((s) => { s.diff = s.pf - s.pa; });

    return Object.values(standings).sort((a, b) =>
      b.points - a.points || b.diff - a.diff || b.pf - a.pf
    );
  };

  if (loading || membersLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
      </div>
    );
  }

  const drawPanel = canManage ? (
    <div className="rounded-lg border border-border bg-card/50 p-3 mb-4 flex flex-wrap items-center gap-2">
      <Shuffle className="h-4 w-4 text-primary" />
      <span className="text-sm text-foreground">Sortear automaticamente em</span>
      <Input
        type="number"
        min={1}
        max={32}
        value={numGroupsInput}
        onChange={(e) => setNumGroupsInput(e.target.value)}
        className="w-20 h-8"
      />
      <span className="text-sm text-muted-foreground">grupos</span>
      <Button size="sm" onClick={handleSortear} disabled={drawing} className="ml-auto">
        {drawing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Shuffle className="h-3.5 w-3.5 mr-1" />}
        Sortear
      </Button>
    </div>
  ) : null;

  if (groups.length === 0) {
    return (
      <div>
        {drawPanel}
        <div className="text-center py-12 text-muted-foreground">
          <Layers className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Nenhum grupo definido para esta modalidade.</p>
        </div>
      </div>
    );
  }

  const renderEntryName = (entryId: string) => {
    const em = entryMembers[entryId];
    const members = em?.members || [];
    if (members.length === 0) return <span className="text-sm">{em?.entryName || "—"}</span>;
    return (
      <div className="flex items-center gap-1">
        {members.map((m) => (
          <AthleteAvatar key={m.memberId} member={m} showFullName={false} size="h-6 w-6" />
        ))}
        <span className="text-xs text-foreground ml-1 truncate">
          {members.map((m) => m.firstName).join(" / ")}
        </span>
      </div>
    );
  };

  // Top half qualifies (or top 2 if group small)
  const qualifiers = (size: number) => Math.max(2, Math.floor(size / 2));

  return (
    <div>
      {drawPanel}
      <div className="grid gap-4 sm:grid-cols-2">
      {groups.map((group) => {
        const standings = computeStandings(group);
        const cut = qualifiers(standings.length);

        return (
          <div key={group.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-display text-primary">
                Grupo {group.group_name}
              </h3>
              <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                {group.members.length} {group.members.length === 1 ? "equipe" : "equipes"}
              </span>
            </div>

            {standings.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem participantes</p>
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="text-left px-1 py-1.5 w-6">#</th>
                      <th className="text-left px-1 py-1.5">Equipe</th>
                      <th className="text-center px-1 py-1.5 w-7">J</th>
                      <th className="text-center px-1 py-1.5 w-7">V</th>
                      <th className="text-center px-1 py-1.5 w-7">D</th>
                      <th className="text-center px-1 py-1.5 w-9">SG</th>
                      <th className="text-center px-1 py-1.5 w-7">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((s, idx) => {
                      const qualified = idx < cut;
                      return (
                        <tr
                          key={s.entryId}
                          className={`border-t border-border/50 ${qualified ? "text-primary" : "text-foreground"}`}
                        >
                          <td className="px-1 py-2 font-mono">
                            <span className="inline-flex items-center gap-0.5">
                              {qualified && <Trophy className="h-3 w-3" />}
                              {idx + 1}
                            </span>
                          </td>
                          <td className="px-1 py-2 min-w-0">{renderEntryName(s.entryId)}</td>
                          <td className="px-1 py-2 text-center font-mono">{s.played}</td>
                          <td className="px-1 py-2 text-center font-mono">{s.wins}</td>
                          <td className="px-1 py-2 text-center font-mono">{s.losses}</td>
                          <td className="px-1 py-2 text-center font-mono">
                            {s.diff > 0 ? `+${s.diff}` : s.diff}
                          </td>
                          <td className="px-1 py-2 text-center font-mono font-semibold">{s.points}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
};

export default TabGroups;
