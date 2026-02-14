import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

const Ranking = () => {
  const [ranking, setRanking] = useState<any[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("match_results")
        .select("winner_id")
        .not("winner_id", "is", null);

      if (data) {
        const counts: Record<string, number> = {};
        data.forEach((r) => {
          if (r.winner_id) counts[r.winner_id] = (counts[r.winner_id] || 0) + 1;
        });

        const userIds = Object.keys(counts);
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, full_name, city, state")
            .in("user_id", userIds);

          const ranked = userIds
            .map((uid) => ({
              user_id: uid,
              wins: counts[uid],
              points: counts[uid] * 10,
              profile: profiles?.find((p) => p.user_id === uid),
            }))
            .sort((a, b) => b.points - a.points);

          setRanking(ranked);
        }
      }
    };
    fetch();
  }, []);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="text-2xl font-display text-primary text-glow">🏐 MOOD PLAY</Link>
          <div className="flex items-center gap-4">
            <Link to="/feed" className="text-sm text-muted-foreground hover:text-foreground">Feed</Link>
            <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">Dashboard</Link>
          </div>
        </div>
      </header>

      <main className="container max-w-2xl py-8">
        <h1 className="mb-8 text-4xl font-display text-foreground">RANKING GERAL</h1>

        {ranking.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Nenhum resultado registrado ainda.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {ranking.map((r, i) => (
              <Card key={r.user_id} className={`hover:border-primary/40 transition-colors ${i < 3 ? "border-primary/30" : ""}`}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl w-10 text-center">{medals[i] || `#${i + 1}`}</span>
                    <div>
                      <p className="font-bold">{r.profile?.full_name || "Atleta"}</p>
                      {r.profile?.city && <p className="text-xs text-muted-foreground">{r.profile.city} - {r.profile.state}</p>}
                    </div>
                  </div>
                  <span className="text-xl font-bold text-primary">{r.points} pts</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Ranking;
