import { useEffect, useState } from "react";
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
    <main className="px-4 py-6 pb-20 max-w-2xl mx-auto">
      <h1 className="mb-6 text-3xl font-display" style={{ color: "#fff" }}>RANKING GERAL</h1>

      {ranking.length === 0 ? (
        <Card className="p-8 text-center" style={{ background: "#0B0F12", borderColor: "rgba(43,255,136,0.1)" }}>
          <p style={{ color: "#9CA3AF" }}>Nenhum resultado registrado ainda.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {ranking.map((r, i) => (
            <Card key={r.user_id} className="transition-colors" style={{ background: "#0B0F12", borderColor: i < 3 ? "rgba(43,255,136,0.3)" : "rgba(43,255,136,0.1)" }}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <span className="text-2xl w-10 text-center">{medals[i] || `#${i + 1}`}</span>
                  <div>
                    <p className="font-bold" style={{ color: "#fff" }}>{r.profile?.full_name || "Atleta"}</p>
                    {r.profile?.city && <p className="text-xs" style={{ color: "#9CA3AF" }}>{r.profile.city} - {r.profile.state}</p>}
                  </div>
                </div>
                <span className="text-xl font-bold" style={{ color: "#2BFF88" }}>{r.points} pts</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
};

export default Ranking;
