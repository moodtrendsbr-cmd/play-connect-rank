import { useEffect, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

type BracketType = "single_elimination" | "double_elimination" | "round_robin" | "custom";

const isValidUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);

const Brackets = () => {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [tournament, setTournament] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, any>>({});
  const [bracketType, setBracketType] = useState<BracketType>("single_elimination");
  const [generated, setGenerated] = useState(false);
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

  const fetchMatches = async () => {
    const { data: m } = await supabase
      .from("match_results")
      .select("*")
      .eq("tournament_id", id!)
      .order("round")
      .order("match_number");
    const matchData = m || [];

    if (matchData.length > 0) {
      const playerIds = matchData.flatMap((mt) => [mt.player1_id, mt.player2_id, mt.winner_id]);
      const map = await fetchProfiles(playerIds);
      setProfileMap((prev) => ({ ...prev, ...map }));
      setMatches(matchData);
      setGenerated(true);
    }
    return matchData;
  };

  useEffect(() => {
    const fetch = async () => {
      if (!id || !isValidUUID(id)) {
        setDataLoaded(true);
        setTournament(null);
        return;
      }
      const { data: t } = await supabase.from("tournaments").select("*").eq("id", id).maybeSingle();
      setTournament(t);
      setDataLoaded(true);
      if (!t) return;

      await fetchMatches();

      // Get paid enrollments for bracket generation
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("user_id")
        .eq("tournament_id", id!)
        .eq("status", "paid");
      const enrollData = enrollments || [];

      // Fetch profile names for enrolled players
      const userIds = enrollData.map((e) => e.user_id).filter(Boolean);
      const map = await fetchProfiles(userIds);
      setProfileMap((prev) => ({ ...prev, ...map }));
      setPlayers(enrollData);
    };
    if (id && user) fetch();
  }, [id]);

  const generateBracket = async () => {
    if (players.length < 2) {
      toast({ title: "Erro", description: "Mínimo de 2 jogadores confirmados necessário.", variant: "destructive" });
      return;
    }

    // Shuffle players
    const shuffled = [...players].sort(() => Math.random() - 0.5);

    let newMatches: any[] = [];

    if (bracketType === "single_elimination") {
      const totalRounds = Math.ceil(Math.log2(shuffled.length));
      const firstRoundMatches = Math.ceil(shuffled.length / 2);

      for (let i = 0; i < firstRoundMatches; i++) {
        newMatches.push({
          tournament_id: id!,
          round: 1,
          match_number: i + 1,
          player1_id: shuffled[i * 2]?.user_id || null,
          player2_id: shuffled[i * 2 + 1]?.user_id || null,
        });
      }

      for (let round = 2; round <= totalRounds; round++) {
        const matchesInRound = Math.ceil(firstRoundMatches / Math.pow(2, round - 1));
        for (let i = 0; i < matchesInRound; i++) {
          newMatches.push({
            tournament_id: id!,
            round,
            match_number: i + 1,
            player1_id: null,
            player2_id: null,
          });
        }
      }
    } else if (bracketType === "round_robin") {
      let matchNum = 1;
      for (let i = 0; i < shuffled.length; i++) {
        for (let j = i + 1; j < shuffled.length; j++) {
          newMatches.push({
            tournament_id: id!,
            round: 1,
            match_number: matchNum++,
            player1_id: shuffled[i].user_id,
            player2_id: shuffled[j].user_id,
          });
        }
      }
    } else if (bracketType === "double_elimination") {
      const firstRoundMatches = Math.ceil(shuffled.length / 2);
      for (let i = 0; i < firstRoundMatches; i++) {
        newMatches.push({
          tournament_id: id!,
          round: 1,
          match_number: i + 1,
          player1_id: shuffled[i * 2]?.user_id || null,
          player2_id: shuffled[i * 2 + 1]?.user_id || null,
        });
      }
      for (let i = 0; i < firstRoundMatches; i++) {
        newMatches.push({
          tournament_id: id!,
          round: 2,
          match_number: i + 1,
          player1_id: null,
          player2_id: null,
        });
      }
    }

    const { error } = await supabase.from("match_results").insert(newMatches);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Chaves geradas!" });
      await fetchMatches();
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

  const getName = (playerId: string | null) => {
    if (!playerId) return "A definir";
    return profileMap[playerId]?.full_name || "A definir";
  };

  // Group matches by round
  const rounds = matches.reduce((acc: Record<number, any[]>, m) => {
    if (!acc[m.round]) acc[m.round] = [];
    acc[m.round].push(m);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-16 items-center justify-between">
          <Link to={`/tournaments/${id}/manage`} className="text-2xl font-display text-primary text-glow">🏐 MOOD PLAY</Link>
        </div>
      </header>

      <main className="container py-8">
        <h1 className="mb-2 text-4xl font-display text-foreground">CHAVES</h1>
        <p className="text-muted-foreground mb-8">{tournament.name}</p>

        {!generated && (
          <Card className="mb-8 p-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Tipo de chaveamento</label>
                <Select value={bracketType} onValueChange={(v) => setBracketType(v as BracketType)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single_elimination">Eliminatória simples</SelectItem>
                    <SelectItem value="double_elimination">Eliminatória dupla</SelectItem>
                    <SelectItem value="round_robin">Todos contra todos</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">{players.length} jogador(es) confirmado(s)</p>
              <Button onClick={generateBracket} className="box-glow">Gerar Chaves</Button>
            </div>
          </Card>
        )}

        {generated && Object.keys(rounds).length > 0 && (
          <div className="space-y-8">
            {Object.entries(rounds).map(([round, roundMatches]) => (
              <div key={round}>
                <h2 className="text-2xl font-display text-foreground mb-4">
                  {bracketType === "round_robin" ? "PARTIDAS" : `RODADA ${round}`}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(roundMatches as any[]).map((m: any) => (
                    <Card key={m.id} className={`${m.winner_id ? "border-primary/30" : "border-border"}`}>
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <p className={`text-sm font-medium ${m.winner_id === m.player1_id ? "text-primary" : ""}`}>
                              {getName(m.player1_id)}
                              {m.score1 !== null && <span className="ml-2 text-muted-foreground">{m.score1}</span>}
                            </p>
                            <p className="text-xs text-muted-foreground">vs</p>
                            <p className={`text-sm font-medium ${m.winner_id === m.player2_id ? "text-primary" : ""}`}>
                              {getName(m.player2_id)}
                              {m.score2 !== null && <span className="ml-2 text-muted-foreground">{m.score2}</span>}
                            </p>
                          </div>
                          {m.winner_id && <span className="text-primary text-lg">✅</span>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8">
          <Button variant="outline" asChild>
            <Link to={`/tournaments/${id}/results`}>Lançar Resultados</Link>
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Brackets;
