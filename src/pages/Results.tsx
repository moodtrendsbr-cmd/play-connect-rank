import { useEffect, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

const isValidUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);

const Results = () => {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [tournament, setTournament] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, any>>({});
  const [dataLoaded, setDataLoaded] = useState(false);

  const fetchProfiles = async (ids: string[]) => {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    if (uniqueIds.length === 0) return {};
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", uniqueIds);
    const map: Record<string, any> = {};
    (profiles || []).forEach((p) => { map[p.user_id] = p; });
    return map;
  };

  const fetchData = async () => {
    if (!id || !isValidUUID(id)) {
      setDataLoaded(true);
      setTournament(null);
      return;
    }
    const { data: t } = await supabase.from("tournaments").select("*").eq("id", id).maybeSingle();
    setTournament(t);
    setDataLoaded(true);
    if (!t) return;

    const { data: m } = await supabase
      .from("match_results")
      .select("*")
      .eq("tournament_id", id!)
      .order("round")
      .order("match_number");
    const matchData = m || [];
    setMatches(matchData);

    const playerIds = matchData.flatMap((mt) => [mt.player1_id, mt.player2_id]);
    const map = await fetchProfiles(playerIds);
    setProfileMap(map);
  };

  useEffect(() => { if (id && user) fetchData(); }, [id, user]);

  const updateResult = async (matchId: string, score1: number, score2: number, winnerId: string | null) => {
    const { error } = await supabase
      .from("match_results")
      .update({ score1, score2, winner_id: winnerId })
      .eq("id", matchId);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Resultado atualizado!" });
      fetchData();
    }
  };

  if (authLoading) return <div className="flex min-h-screen items-center justify-center bg-background text-foreground">Carregando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (dataLoaded && !tournament) return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground gap-4">
      <p className="text-lg text-muted-foreground">Torneio não encontrado ou sem permissão.</p>
      <Button asChild><Link to="/dashboard">Voltar</Link></Button>
    </div>
  );
  if (!tournament) return <div className="flex min-h-screen items-center justify-center bg-background text-foreground">Carregando...</div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-16 items-center">
          <Link to={`/tournaments/${id}/manage`} className="text-2xl font-display text-primary text-glow">🏐 MOOD PLAY</Link>
        </div>
      </header>

      <main className="container max-w-3xl py-8">
        <h1 className="mb-2 text-4xl font-display text-foreground">LANÇAR RESULTADOS</h1>
        <p className="text-muted-foreground mb-8">{tournament.name}</p>

        {matches.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Gere as chaves primeiro.</p>
            <Button className="mt-4" asChild>
              <Link to={`/tournaments/${id}/brackets`}>Gerar Chaves</Link>
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {matches.map((m) => (
              <MatchResultCard key={m.id} match={m} profileMap={profileMap} onUpdate={updateResult} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

const MatchResultCard = ({ match, profileMap, onUpdate }: { match: any; profileMap: Record<string, any>; onUpdate: (id: string, s1: number, s2: number, w: string | null) => void }) => {
  const [score1, setScore1] = useState(match.score1?.toString() || "");
  const [score2, setScore2] = useState(match.score2?.toString() || "");
  const [winner, setWinner] = useState(match.winner_id || "");

  const p1Name = profileMap[match.player1_id]?.full_name || "A definir";
  const p2Name = profileMap[match.player2_id]?.full_name || "A definir";

  const handleSave = () => {
    onUpdate(match.id, parseInt(score1) || 0, parseInt(score2) || 0, winner || null);
  };

  return (
    <Card className={match.winner_id ? "border-primary/30" : ""}>
      <CardContent className="py-4 space-y-3">
        <p className="text-xs text-muted-foreground">Rodada {match.round} — Partida {match.match_number}</p>

        <div className="grid grid-cols-5 items-center gap-2">
          <span className="col-span-2 text-sm font-medium truncate">{p1Name}</span>
          <Input type="number" value={score1} onChange={(e) => setScore1(e.target.value)} className="text-center" placeholder="0" />
          <span className="text-center text-muted-foreground">vs</span>
          <div />
        </div>
        <div className="grid grid-cols-5 items-center gap-2">
          <span className="col-span-2 text-sm font-medium truncate">{p2Name}</span>
          <Input type="number" value={score2} onChange={(e) => setScore2(e.target.value)} className="text-center" placeholder="0" />
          <div />
          <div />
        </div>

        {match.player1_id && match.player2_id && (
          <div>
            <label className="text-xs text-muted-foreground">Vencedor</label>
            <Select value={winner} onValueChange={setWinner}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={match.player1_id}>{p1Name}</SelectItem>
                <SelectItem value={match.player2_id}>{p2Name}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <Button size="sm" onClick={handleSave} disabled={!match.player1_id || !match.player2_id}>
          Salvar resultado
        </Button>
      </CardContent>
    </Card>
  );
};

export default Results;
