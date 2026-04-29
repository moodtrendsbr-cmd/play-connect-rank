import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Search, Trophy, MapPin, Calendar } from "lucide-react";
import { useFeaturedSet } from "@/hooks/useFeaturedSet";
import FeaturedBadge from "@/components/featured/FeaturedBadge";

type StatusFilter = "all" | "active" | "upcoming" | "finished";

const getTournamentStatus = (t: any) => {
  const now = new Date();
  const start = new Date(t.start_date);
  const end = new Date(t.end_date);
  if (now >= start && now <= end) return "active";
  if (now < start) return "upcoming";
  return "finished";
};

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: "Em andamento", className: "bg-primary/20 text-primary border-primary/30" },
  upcoming: { label: "Inscrições abertas", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  finished: { label: "Finalizado", className: "bg-muted text-muted-foreground border-border" },
};

const Tournaments = () => {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const { featuredSet: featuredTournaments } = useFeaturedSet("tournament");

  useEffect(() => {
    const fetch = async () => {
      const { data: tdata } = await supabase
        .from("tournaments")
        .select("*")
        .eq("is_public", true)
        .order("start_date", { ascending: false });

      const list = tdata || [];

      // Public aggregated counts (works for anon, post-P2 view)
      if (list.length > 0) {
        const ids = list.map((t: any) => t.id);
        const { data: counts } = await supabase
          .from("tournament_enrollment_counts")
          .select("tournament_id, paid_count, total_count")
          .in("tournament_id", ids);
        const map: Record<string, any> = {};
        (counts || []).forEach((c: any) => { map[c.tournament_id] = c; });
        list.forEach((t: any) => {
          const c = map[t.id];
          t.enrollments = [{ count: c?.total_count || 0 }];
          t.paid_count = c?.paid_count || 0;
        });
      }

      setTournaments(list);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = tournaments
    .filter((t) => {
      const matchesSearch = search === "" ||
        t.city?.toLowerCase().includes(search.toLowerCase()) ||
        t.state?.toLowerCase().includes(search.toLowerCase()) ||
        t.name?.toLowerCase().includes(search.toLowerCase());
      const status = getTournamentStatus(t);
      const matchesFilter = filter === "all" || status === filter;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      const aFeat = featuredTournaments.has(a.id);
      const bFeat = featuredTournaments.has(b.id);
      if (aFeat !== bFeat) return aFeat ? -1 : 1;
      return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
    });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-16 items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
          </Button>
          <Link to="/dashboard" className="text-2xl font-display text-primary text-glow">🏐 MOOD PLAY</Link>
        </div>
      </header>

      <main className="px-4 py-6 pb-20 max-w-3xl mx-auto">
        <h1 className="mb-6 text-3xl font-display text-foreground">TORNEIOS DISPONÍVEIS</h1>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cidade, estado ou nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {([
            { key: "all", label: "Todos" },
            { key: "active", label: "Em andamento" },
            { key: "upcoming", label: "Próximos" },
            { key: "finished", label: "Finalizados" },
          ] as { key: StatusFilter; label: string }[]).map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filter === f.key ? "default" : "outline"}
              onClick={() => setFilter(f.key)}
              className="text-xs"
            >
              {f.label}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2 mt-2" /></CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-9 w-full mt-3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              {search ? "Nenhum torneio encontrado para essa busca." : "Nenhum torneio disponível no momento."}
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map((t) => {
              const status = getTournamentStatus(t);
              const statusInfo = statusConfig[status];
              return (
              <Card key={t.id} className="overflow-hidden hover:border-primary/30 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="font-sans text-lg">🏐 {t.name}</CardTitle>
                      <Badge variant="outline" className={statusInfo.className}>
                        {statusInfo.label}
                      </Badge>
                    </div>
                    {featuredTournaments.has(t.id) && (
                      <div className="mt-1">
                        <FeaturedBadge entityType="tournament" entityId={t.id} />
                      </div>
                    )}
                    {t.arena && (
                      <p className="text-sm text-muted-foreground">🏟️ {t.arena}</p>
                    )}
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {t.city} - {t.state}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" /> {t.start_date} — {t.end_date}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      💰 R$ {Number(t.entry_fee).toFixed(2)}
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button className="flex-1" asChild>
                        <Link to={`/tournaments/${t.id}`}>Ver detalhes</Link>
                      </Button>
                      {status === "active" || status === "finished" ? (
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/tournaments/${t.id}/brackets`} className="gap-1">
                            <Trophy className="h-3.5 w-3.5" /> Chaves
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Tournaments;
