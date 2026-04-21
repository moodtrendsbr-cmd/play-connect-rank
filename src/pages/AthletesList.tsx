import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Users } from "lucide-react";

export default function AthletesList() {
  const [athletes, setAthletes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState("");

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      let q = supabase
        .from("athletes_public")
        .select("user_id, full_name, avatar_url, city, state, wins, participations")
        .order("wins", { ascending: false })
        .limit(60);
      if (city.trim()) q = q.ilike("city", `%${city.trim()}%`);
      const { data } = await q;
      setAthletes(data || []);
      setLoading(false);
    };
    fetch();
  }, [city]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <h1 className="text-lg font-display tracking-wide text-primary flex items-center gap-2">
            <Users className="h-5 w-5" /> ATLETAS
          </h1>
          <input
            type="text"
            placeholder="Filtrar por cidade..."
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="mt-2 w-full bg-card text-sm text-foreground placeholder:text-muted-foreground outline-none px-3 py-2 rounded-full"
          />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4">
        {loading ? (
          <p className="text-center text-muted-foreground py-10">Carregando...</p>
        ) : athletes.length === 0 ? (
          <p className="text-center text-muted-foreground py-10">Nenhum atleta encontrado</p>
        ) : (
          <ul className="space-y-2">
            {athletes.map((a, idx) => (
              <li key={a.user_id}>
                <Link to={`/profile/${a.user_id}`} className="flex items-center gap-3 p-3 rounded-lg bg-card hover:bg-accent">
                  <span className="w-6 text-xs text-muted-foreground text-right">#{idx + 1}</span>
                  {a.avatar_url ? (
                    <img src={a.avatar_url} className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-muted" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{a.full_name || "Atleta"}</p>
                    <p className="text-xs text-muted-foreground">{a.city || "—"} · {a.participations} participações</p>
                  </div>
                  <div className="flex items-center gap-1 text-primary">
                    <Trophy className="h-3 w-3" />
                    <span className="text-sm font-semibold">{a.wins}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
