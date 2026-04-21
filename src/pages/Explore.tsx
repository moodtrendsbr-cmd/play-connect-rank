import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, Trophy, Store, MapPin, Users } from "lucide-react";
import AdSlot from "@/components/ads/AdSlot";

export default function Explore() {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<any>({ athletes: [], arenas: [], tournaments: [], products: [] });
  const [topAthletes, setTopAthletes] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from("athletes_public")
      .select("user_id, full_name, avatar_url, wins, city")
      .order("wins", { ascending: false })
      .limit(8)
      .then(({ data }) => setTopAthletes(data || []));
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
          </>
        )}
      </main>
    </div>
  );
}
