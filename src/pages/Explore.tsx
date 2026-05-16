import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, Trophy, Store, MapPin, Users, Flame, Clock } from "lucide-react";
import AdSlot from "@/components/ads/AdSlot";
import { LiveBadge } from "@/components/social/LiveBadge";
import { SocialActivityFeed } from "@/components/social/SocialActivityFeed";

export default function Explore() {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<any>({ athletes: [], arenas: [], tournaments: [], products: [] });
  const [topAthletes, setTopAthletes] = useState<any[]>([]);
  const [upcomingTournaments, setUpcomingTournaments] = useState<any[]>([]);
  const [busyArenas, setBusyArenas] = useState<any[]>([]);
  const [liveMatches, setLiveMatches] = useState<number>(0);

  useEffect(() => {
    supabase
      .from("athletes_public")
      .select("user_id, full_name, avatar_url, wins, city")
      .order("wins", { ascending: false })
      .limit(8)
      .then(({ data }) => setTopAthletes(data || []));

    // Próximos torneios
    supabase
      .from("tournaments")
      .select("id, name, start_date, city, state")
      .gte("start_date", new Date().toISOString().slice(0, 10))
      .order("start_date", { ascending: true })
      .limit(6)
      .then(({ data }) => setUpcomingTournaments(data || []));

    // Matches em andamento
    (supabase as any)
      .from("modality_matches").select("id", { count: "exact", head: true }).eq("status", "in_progress")
      .then(({ count }: any) => setLiveMatches(count ?? 0));

    // Arenas movimentadas (últimas 24h de attendance)
    (async () => {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data: att } = await (supabase as any)
        .from("arena_attendance").select("arena_id").gte("attended_at", since).limit(500);
      const counts: Record<string, number> = {};
      (att || []).forEach((r: any) => { if (r.arena_id) counts[r.arena_id] = (counts[r.arena_id] || 0) + 1; });
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, n]) => ({ id, n }));
      if (top.length === 0) { setBusyArenas([]); return; }
      const { data: arenas } = await supabase.from("arenas_public").select("id, name, slug, city").in("id", top.map((t) => t.id));
      setBusyArenas((arenas || []).map((a: any) => ({ ...a, checkins: top.find((t) => t.id === a.id)?.n || 0 })));
    })();
  }, []);

  useEffect(() => {
    if (term.trim().length < 2) {
      setResults({ athletes: [], arenas: [], tournaments: [], products: [] });
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("search_global", { _term: term });
      if (data) setResults(data);
    }, 300);
    return () => clearTimeout(t);
  }, [term]);

  const hasResults =
    results.athletes?.length || results.arenas?.length || results.tournaments?.length || results.products?.length;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <h1 className="text-lg font-display tracking-wide text-primary mb-2">EXPLORAR</h1>
          <div className="flex items-center gap-2 rounded-full px-3 py-2 bg-card">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar atletas, arenas, torneios, produtos..."
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
            />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-6">
        {term.trim().length >= 2 && hasResults ? (
          <>
            {results.athletes?.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2"><Users className="h-4 w-4" /> Atletas</h2>
                <div className="grid grid-cols-2 gap-2">
                  {results.athletes.map((a: any) => (
                    <Link key={a.user_id} to={`/profile/${a.user_id}`} className="flex items-center gap-2 p-2 rounded-lg bg-card hover:bg-accent">
                      {a.avatar_url ? <img src={a.avatar_url} className="h-9 w-9 rounded-full object-cover" /> : <div className="h-9 w-9 rounded-full bg-muted" />}
                      <div className="min-w-0">
                        <p className="text-sm text-foreground truncate">{a.full_name}</p>
                        <p className="text-xs text-muted-foreground">{a.wins} vitórias</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
            {results.tournaments?.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2"><Trophy className="h-4 w-4" /> Torneios</h2>
                <div className="space-y-2">
                  {results.tournaments.map((t: any) => (
                    <Link key={t.id} to={`/tournaments/${t.id}`} className="block p-3 rounded-lg bg-card hover:bg-accent">
                      <p className="text-sm font-medium text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.start_date}</p>
                    </Link>
                  ))}
                </div>
              </section>
            )}
            {results.arenas?.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2"><MapPin className="h-4 w-4" /> Arenas</h2>
                <div className="space-y-2">
                  {results.arenas.map((a: any) => (
                    <Link key={a.id} to={`/arenas/${a.slug}`} className="block p-3 rounded-lg bg-card hover:bg-accent">
                      <p className="text-sm font-medium text-foreground">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.city}</p>
                    </Link>
                  ))}
                </div>
              </section>
            )}
            {results.products?.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2"><Store className="h-4 w-4" /> Produtos</h2>
                <div className="grid grid-cols-2 gap-2">
                  {results.products.map((p: any) => (
                    <Link key={p.id} to={`/marketplace/product/${p.id}`} className="p-2 rounded-lg bg-card hover:bg-accent">
                      <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                      <p className="text-xs text-primary">R$ {Number(p.price).toFixed(2)}</p>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <>
            <AdSlot code="home.hero" />

            {/* Acontecendo agora */}
            {liveMatches > 0 && (
              <section className="rounded-xl p-4" style={{ background: "linear-gradient(135deg, rgba(43,255,136,0.08), transparent)", border: "1px solid rgba(43,255,136,0.2)" }}>
                <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Flame className="h-4 w-4" style={{ color: "#2BFF88" }} /> Acontecendo agora
                </h2>
                <LiveBadge variant="playing_now" count={liveMatches} />
              </section>
            )}

            {/* Próximos torneios */}
            {upcomingTournaments.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><Clock className="h-4 w-4" /> Próximos torneios</h2>
                  <Link to="/tournaments" className="text-xs text-primary">Ver todos</Link>
                </div>
                <div className="space-y-2">
                  {upcomingTournaments.map((t) => (
                    <Link key={t.id} to={`/tournaments/${t.id}`} className="block p-3 rounded-lg bg-card hover:bg-accent">
                      <p className="text-sm font-medium text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.start_date} · {t.city}/{t.state}</p>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Arenas movimentadas */}
            {busyArenas.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Flame className="h-4 w-4" /> Arenas movimentadas</h2>
                <div className="grid grid-cols-2 gap-2">
                  {busyArenas.map((a) => (
                    <Link key={a.id} to={`/arenas/${a.slug}`} className="block p-3 rounded-lg bg-card hover:bg-accent">
                      <p className="text-sm font-medium text-foreground truncate">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.checkins} check-ins hoje</p>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><Users className="h-4 w-4" /> Atletas em alta</h2>
                <Link to="/athletes" className="text-xs text-primary">Ver todos</Link>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {topAthletes.map((a) => (
                  <Link key={a.user_id} to={`/profile/${a.user_id}`} className="flex items-center gap-2 p-2 rounded-lg bg-card hover:bg-accent">
                    {a.avatar_url ? <img src={a.avatar_url} className="h-10 w-10 rounded-full object-cover" /> : <div className="h-10 w-10 rounded-full bg-muted" />}
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{a.full_name || "Atleta"}</p>
                      <p className="text-xs text-muted-foreground">{a.wins} vitórias</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            {/* Atividade global */}
            <section>
              <h2 className="text-sm font-semibold text-foreground mb-3">Movimento da rede</h2>
              <SocialActivityFeed limit={10} title="" realtime />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
