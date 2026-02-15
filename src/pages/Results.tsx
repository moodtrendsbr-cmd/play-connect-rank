import { useEffect, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Trophy, Users, ChevronRight } from "lucide-react";

const isValidUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);

const statusConfig: Record<string, { label: string; className: string }> = {
  open: { label: "Inscrições Abertas", className: "bg-primary/20 text-primary border-primary/30" },
  closed: { label: "Encerradas", className: "bg-secondary/20 text-secondary border-secondary/30" },
  bracket_generated: { label: "Em Andamento", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  finished: { label: "Finalizado", className: "bg-muted text-muted-foreground border-border" },
};

const Results = () => {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [tournament, setTournament] = useState<any>(null);
  const [modalities, setModalities] = useState<any[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!id || !isValidUUID(id)) {
        setDataLoaded(true);
        return;
      }
      const [tRes, mRes] = await Promise.all([
        supabase.from("tournaments").select("*").eq("id", id).maybeSingle(),
        supabase.from("tournament_modalities").select("*, modality_matches(count), modality_entries(count)").eq("tournament_id", id!),
      ]);
      setTournament(tRes.data);
      setModalities(mRes.data || []);
      setDataLoaded(true);
    };
    if (id && user) fetchData();
  }, [id, user]);

  if (authLoading) return <div className="flex min-h-screen items-center justify-center bg-background text-foreground">Carregando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (dataLoaded && !tournament) return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground gap-4">
      <p className="text-lg text-muted-foreground">Torneio não encontrado ou sem permissão.</p>
      <Button asChild><Link to="/dashboard">Voltar</Link></Button>
    </div>
  );
  if (!tournament) return (
    <div className="min-h-screen bg-background p-8 max-w-3xl mx-auto">
      <Skeleton className="h-10 w-1/2 mb-4" />
      <Skeleton className="h-6 w-1/3 mb-8" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-16 items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/tournaments/${id}/manage`} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
          </Button>
          <Link to={`/tournaments/${id}/manage`} className="text-2xl font-display text-primary text-glow">🏐 MOOD PLAY</Link>
        </div>
      </header>

      <main className="container max-w-3xl py-8">
        <h1 className="mb-2 text-4xl font-display text-foreground">RESULTADOS</h1>
        <p className="text-muted-foreground mb-8">{tournament.name}</p>

        {modalities.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-3">Nenhuma modalidade cadastrada neste torneio.</p>
            <Button asChild>
              <Link to={`/tournaments/${id}/manage`}>Ir para gerenciamento</Link>
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {modalities.map((mod) => {
              const status = statusConfig[mod.status] || statusConfig.open;
              const matchCount = mod.modality_matches?.[0]?.count || 0;
              const entryCount = mod.modality_entries?.[0]?.count || 0;
              return (
                <Link
                  key={mod.id}
                  to={`/tournaments/${id}/brackets`}
                  className="block rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1.5">
                      <h3 className="text-xl font-display text-foreground">{mod.name}</h3>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={status.className}>{status.label}</Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="h-3 w-3" /> {entryCount} inscritos
                        </span>
                        <span className="text-xs text-muted-foreground">
                          🏐 {matchCount} jogos
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Results;
