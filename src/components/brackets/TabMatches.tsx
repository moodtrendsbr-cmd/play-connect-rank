import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ClipboardList, MapPin } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ScoreEntryDialog from "./ScoreEntryDialog";
import TabBracketView from "./TabBracketView";
import { useEntryMembers } from "@/hooks/useEntryMembers";
import AthleteAvatar from "./AthleteAvatar";

interface TabMatchesProps {
  modalityId: string;
  tournamentId: string;
  isOrganizer: boolean;
}

const Pill = ({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "primary" | "blue" | "warning" }) => {
  const map = {
    muted: "bg-muted text-muted-foreground border-border",
    primary: "bg-primary/15 text-primary border-primary/30",
    blue: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    warning: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${map[tone]}`}>
      {children}
    </span>
  );
};

const TabMatches = ({ modalityId, tournamentId, isOrganizer }: TabMatchesProps) => {
  const [matches, setMatches] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [courts, setCourts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMatch, setEditingMatch] = useState<any>(null);
  const [groupFilter, setGroupFilter] = useState<string>("all");

  const fetchData = async () => {
    setLoading(true);
    const [{ data: matchData }, { data: groupData }, { data: tData }] = await Promise.all([
      supabase
        .from("modality_matches")
        .select("*")
        .eq("modality_id", modalityId)
        .order("round_number")
        .order("match_number"),
      supabase.from("modality_groups").select("*").eq("modality_id", modalityId).order("group_name"),
      supabase.from("tournaments").select("organizer_id").eq("id", tournamentId).maybeSingle(),
    ]);

    setMatches(matchData || []);
    setGroups(groupData || []);

    // Fetch courts from arenas owned by tournament's organizer (if any)
    if (tData?.organizer_id) {
      const { data: arenas } = await supabase
        .from("arenas")
        .select("id")
        .eq("owner_user_id", tData.organizer_id);
      const arenaIds = (arenas || []).map((a) => a.id);
      if (arenaIds.length > 0) {
        const { data: courtsData } = await supabase
          .from("courts")
          .select("id, name")
          .in("arena_id", arenaIds)
          .eq("is_active", true);
        setCourts(courtsData || []);
      }
    }

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [modalityId, tournamentId]);

  const allEntryIds = useMemo(() => {
    return [...new Set(matches.flatMap((m) => [m.entry_a_id, m.entry_b_id].filter(Boolean)))];
  }, [matches]);

  const { entryMembers, membersLoading } = useEntryMembers(allEntryIds);

  const courtMap = useMemo(() => {
    const m: Record<string, string> = {};
    courts.forEach((c) => { m[c.id] = c.name; });
    return m;
  }, [courts]);

  if (loading || membersLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
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
    if (!entryId) return <span className="text-muted-foreground text-xs">A definir</span>;
    const em = entryMembers[entryId];
    const members = em?.members || [];

    if (members.length === 0) {
      return (
        <span className={`text-sm ${isWinner ? "text-primary font-semibold" : "text-foreground"}`}>
          {em?.entryName || "A definir"}
        </span>
      );
    }

    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {members.map((m) => (
          <AthleteAvatar key={m.memberId} member={m} showFullName={false} size="h-6 w-6" />
        ))}
        <span className={`text-sm ${isWinner ? "text-primary font-semibold" : "text-foreground"}`}>
          {members.map((m) => m.firstName).join(" / ")}
        </span>
      </div>
    );
  };

  const getEntryLabel = (entryId: string | null) => {
    if (!entryId) return "A definir";
    const em = entryMembers[entryId];
    return em?.members?.map((m) => m.firstName).join(" / ") || em?.entryName || "A definir";
  };

  const statusPill = (status: string) => {
    if (status === "finished") return <Pill tone="primary">Finalizada</Pill>;
    if (status === "in_progress") return <Pill tone="blue">Em andamento</Pill>;
    if (status === "bye") return <Pill tone="warning">BYE</Pill>;
    return <Pill>Agendada</Pill>;
  };

  const renderMatch = (m: any) => (
    <div key={m.id} className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          R{m.round_number} · Jogo {m.match_number}
          {m.court_id && courtMap[m.court_id] && (
            <span className="ml-2 inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {courtMap[m.court_id]}
            </span>
          )}
        </span>
        {statusPill(m.status)}
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          {renderEntryName(m.entry_a_id, m.winner_entry_id === m.entry_a_id)}
          {renderEntryName(m.entry_b_id, m.winner_entry_id === m.entry_b_id)}
        </div>
        <div className="text-right shrink-0">
          {m.score_a !== null && m.score_b !== null && (
            <p className="text-base font-display text-foreground leading-none">
              {m.score_a} <span className="text-muted-foreground text-xs">×</span> {m.score_b}
            </p>
          )}
          {isOrganizer && m.status !== "finished" && (
            <div className="flex flex-col gap-1.5 items-end mt-2">
              <Button size="sm" variant="outline" onClick={() => setEditingMatch(m)} className="h-7 text-xs">
                Editar
              </Button>
              {(m.entry_a_id && m.entry_b_id) && (
                <Button size="sm" variant="ghost" onClick={() => notifyPlayers(m)} className="h-7 text-xs gap-1">
                  📲 Avisar jogadores
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const notifyPlayers = async (m: any) => {
    const entryIds = [m.entry_a_id, m.entry_b_id].filter(Boolean);
    const { data: members } = await supabase
      .from("modality_entry_members")
      .select("user_id")
      .in("entry_id", entryIds);
    const userIds = [...new Set((members || []).map((x: any) => x.user_id))];
    if (userIds.length === 0) {
      window.alert("Sem contatos de jogadores cadastrados para este jogo.");
      return;
    }
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, whatsapp")
      .in("user_id", userIds);
    const phones = (profs || [])
      .map((p: any) => (p.whatsapp || "").replace(/\D/g, ""))
      .filter(Boolean);
    if (phones.length === 0) {
      window.alert("Nenhum jogador tem WhatsApp cadastrado.");
      return;
    }
    const link = `${window.location.origin}/tournaments/${tournamentId}`;
    const text = encodeURIComponent(
      `Seu jogo começa em breve. Confira horário e quadra: ${link}`,
    );
    phones.forEach((phone, i) => {
      setTimeout(() => {
        window.open(`https://wa.me/${phone}?text=${text}`, "_blank", "noopener");
      }, i * 250);
    });
  };

  // Group matches
  const groupMatches = matches.filter((m) => m.group_id);
  const koMatches = matches.filter((m) => !m.group_id);

  // Court usage
  const inUseByCourtId: Record<string, any> = {};
  matches.filter((m) => m.status === "in_progress" && m.court_id).forEach((m) => {
    inUseByCourtId[m.court_id] = m;
  });

  const filteredGroupMatches = groupFilter === "all"
    ? groupMatches
    : groupMatches.filter((m) => m.group_id === groupFilter);

  const byRound: Record<number, any[]> = {};
  matches.forEach((m) => {
    if (!byRound[m.round_number]) byRound[m.round_number] = [];
    byRound[m.round_number].push(m);
  });
  const roundKeys = Object.keys(byRound).map(Number).sort((a, b) => a - b);

  return (
    <>
      <Tabs defaultValue={groupMatches.length > 0 ? "groups" : "ko"} className="w-full">
        <TabsList className="bg-card border border-border mb-4">
          {groupMatches.length > 0 && <TabsTrigger value="groups">Grupos</TabsTrigger>}
          {koMatches.length > 0 && <TabsTrigger value="ko">Mata-Mata</TabsTrigger>}
          <TabsTrigger value="list">Lista</TabsTrigger>
        </TabsList>

        {/* Quadras em uso */}
        {courts.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-3 mb-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Quadras</p>
            <div className="flex flex-wrap gap-1.5">
              {courts.map((c) => {
                const inUse = inUseByCourtId[c.id];
                return inUse ? (
                  <Pill key={c.id} tone="blue">
                    {c.name} · {getEntryLabel(inUse.entry_a_id)} vs {getEntryLabel(inUse.entry_b_id)}
                  </Pill>
                ) : (
                  <Pill key={c.id}>{c.name} · Livre</Pill>
                );
              })}
            </div>
          </div>
        )}

        {groupMatches.length > 0 && (
          <TabsContent value="groups" className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setGroupFilter("all")}
                className={`rounded-full border px-3 py-1 text-xs ${groupFilter === "all" ? "border-primary bg-primary/15 text-primary" : "border-border bg-card text-muted-foreground"}`}
              >
                Todos
              </button>
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGroupFilter(g.id)}
                  className={`rounded-full border px-3 py-1 text-xs ${groupFilter === g.id ? "border-primary bg-primary/15 text-primary" : "border-border bg-card text-muted-foreground"}`}
                >
                  Grupo {g.group_name}
                </button>
              ))}
            </div>
            {filteredGroupMatches.map(renderMatch)}
          </TabsContent>
        )}

        {koMatches.length > 0 && (
          <TabsContent value="ko">
            <TabBracketView modalityId={modalityId} isOrganizer={isOrganizer} />
          </TabsContent>
        )}

        <TabsContent value="list" className="space-y-5">
          {roundKeys.map((r) => (
            <div key={r}>
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-display">
                Rodada {r}
              </h4>
              <div className="space-y-2">
                {byRound[r].map(renderMatch)}
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      {editingMatch && (
        <ScoreEntryDialog
          open={!!editingMatch}
          onOpenChange={(v) => !v && setEditingMatch(null)}
          match={editingMatch}
          entryAName={getEntryLabel(editingMatch.entry_a_id)}
          entryBName={getEntryLabel(editingMatch.entry_b_id)}
          courts={courts}
          onSaved={fetchData}
        />
      )}
    </>
  );
};

export default TabMatches;
