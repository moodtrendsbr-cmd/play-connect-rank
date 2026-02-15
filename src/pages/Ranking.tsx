import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, TrendingUp, Crown, Trophy } from "lucide-react";

type FilterType = "all" | "victories" | "profiles" | "hashtags";

const filters: { value: FilterType; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "victories", label: "Vitórias" },
  { value: "profiles", label: "Perfis" },
  { value: "hashtags", label: "Hashtags" },
];

const Ranking = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterType>("all");
  const [ranking, setRanking] = useState<any[]>([]);
  const [trendingHashtags, setTrendingHashtags] = useState<{ tag: string; count: number }[]>([]);
  const [topPost, setTopPost] = useState<any>(null);
  const [topProfiles, setTopProfiles] = useState<any[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      // 1. Victory ranking (existing)
      const { data: matchData } = await supabase.from("match_results").select("winner_id").not("winner_id", "is", null);
      if (matchData) {
        const counts: Record<string, number> = {};
        matchData.forEach((r) => { if (r.winner_id) counts[r.winner_id] = (counts[r.winner_id] || 0) + 1; });
        const userIds = Object.keys(counts);
        if (userIds.length > 0) {
          const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, avatar_url, city, state").in("user_id", userIds);
          const ranked = userIds.map((uid) => ({
            user_id: uid, wins: counts[uid], points: counts[uid] * 10,
            profile: profiles?.find((p) => p.user_id === uid),
          })).sort((a, b) => b.points - a.points);
          setRanking(ranked);
        }
      }

      // 2. Trending hashtags (last 7 days)
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: searches } = await supabase.from("hashtag_searches").select("hashtag_id").gte("created_at", weekAgo);
      if (searches && searches.length > 0) {
        const htCounts: Record<string, number> = {};
        searches.forEach((s: any) => { htCounts[s.hashtag_id] = (htCounts[s.hashtag_id] || 0) + 1; });
        const htIds = Object.keys(htCounts);
        const { data: htData } = await supabase.from("hashtags").select("id, tag").in("id", htIds);
        if (htData) {
          const trending = htData.map((h) => ({ tag: h.tag, count: htCounts[h.id] || 0 })).sort((a, b) => b.count - a.count).slice(0, 10);
          setTrendingHashtags(trending);
        }
      }

      // 3. Top post of the week
      const { data: weekLikes } = await supabase.from("likes").select("post_id").gte("created_at", weekAgo).not("post_id", "is", null);
      if (weekLikes && weekLikes.length > 0) {
        const postLikes: Record<string, number> = {};
        weekLikes.forEach((l: any) => { postLikes[l.post_id] = (postLikes[l.post_id] || 0) + 1; });
        const topPostId = Object.entries(postLikes).sort(([, a], [, b]) => b - a)[0]?.[0];
        if (topPostId) {
          const { data: postData } = await supabase.from("posts").select("*").eq("id", topPostId).single();
          if (postData) {
            const { data: prof } = await supabase.from("profiles").select("full_name, avatar_url").eq("user_id", postData.author_id).single();
            const { data: media } = await supabase.from("post_media").select("media_url").eq("post_id", topPostId).order("order_index").limit(1);
            setTopPost({ ...postData, author_name: prof?.full_name || "Atleta", author_avatar: prof?.avatar_url, image: media?.[0]?.media_url, likes: postLikes[topPostId] });
          }
        }
      }

      // 4. Top profiles by followers (50+)
      const { data: allFollows } = await supabase.from("follows").select("following_id");
      if (allFollows && allFollows.length > 0) {
        const fCounts: Record<string, number> = {};
        allFollows.forEach((f: any) => { fCounts[f.following_id] = (fCounts[f.following_id] || 0) + 1; });
        const topUserIds = Object.entries(fCounts).filter(([, c]) => c >= 50).sort(([, a], [, b]) => b - a).map(([uid]) => uid);
        if (topUserIds.length > 0) {
          const { data: profs } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", topUserIds);
          setTopProfiles(topUserIds.map((uid) => {
            const p = profs?.find((pr) => pr.user_id === uid);
            return { user_id: uid, full_name: p?.full_name || "Atleta", avatar_url: p?.avatar_url, followers: fCounts[uid] };
          }));
        }
      }
    };
    fetchAll();
  }, []);

  const medals = ["🥇", "🥈", "🥉"];
  const getInitials = (name: string) => name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  const showHashtags = filter === "all" || filter === "hashtags";
  const showTopPost = filter === "all";
  const showProfiles = filter === "all" || filter === "profiles";
  const showVictories = filter === "all" || filter === "victories";

  return (
    <main className="px-4 py-6 pb-20 max-w-2xl mx-auto space-y-8">
      <h1 className="text-3xl font-display text-white">RANKING</h1>

      {/* Filter Chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className="px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors"
            style={
              filter === f.value
                ? { background: "#2BFF88", color: "#050708" }
                : { background: "rgba(43,255,136,0.1)", color: "#9CA3AF" }
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Trending Hashtags */}
      {showHashtags && trendingHashtags.length > 0 && (
        <section>
          <h2 className="text-lg font-display text-white flex items-center gap-2 mb-3"><TrendingUp className="h-5 w-5" style={{ color: "#2BFF88" }} /> Em Alta</h2>
          <div className="flex flex-wrap gap-2">
            {trendingHashtags.map((ht) => (
              <button
                key={ht.tag}
                onClick={() => navigate(`/feed?search=%23${ht.tag}`)}
                className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors hover:opacity-80"
                style={{ background: "rgba(43,255,136,0.1)", color: "#2BFF88" }}
              >
                #{ht.tag}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Top Post of the Week */}
      {showTopPost && topPost && (
        <section>
          <h2 className="text-lg font-display text-white flex items-center gap-2 mb-3"><Heart className="h-5 w-5" style={{ color: "#ef4444" }} /> Post da Semana</h2>
          <Card className="overflow-hidden" style={{ background: "#0B0F12", border: "1px solid rgba(43,255,136,0.3)", boxShadow: "0 0 20px rgba(43,255,136,0.1)" }}>
            {topPost.image && <img src={topPost.image} alt="" className="w-full h-48 object-cover" />}
            <CardContent className="py-4">
              <div className="flex items-center gap-3 mb-2">
                {topPost.author_avatar ? (
                  <img src={topPost.author_avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "rgba(43,255,136,0.15)", color: "#2BFF88" }}>
                    {getInitials(topPost.author_name)}
                  </div>
                )}
                <span className="text-sm font-semibold text-white">{topPost.author_name}</span>
              </div>
              {topPost.content && <p className="text-sm text-white/80 line-clamp-2 mb-2">{topPost.content}</p>}
              <div className="flex items-center gap-1" style={{ color: "#ef4444" }}>
                <Heart className="h-4 w-4" fill="#ef4444" />
                <span className="text-sm font-bold">{topPost.likes} curtidas</span>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Top Profiles */}
      {showProfiles && topProfiles.length > 0 && (
        <section>
          <h2 className="text-lg font-display text-white flex items-center gap-2 mb-3"><Crown className="h-5 w-5" style={{ color: "#FFD700" }} /> Top Perfis</h2>
          <div className="space-y-2">
            {topProfiles.map((p, i) => (
              <Card key={p.user_id} className="cursor-pointer transition-colors" onClick={() => navigate(`/profile/${p.user_id}`)} style={{ background: "#0B0F12", borderColor: i < 3 ? "rgba(43,255,136,0.3)" : "rgba(43,255,136,0.1)" }}>
                <CardContent className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg w-8 text-center">{medals[i] || `#${i + 1}`}</span>
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "rgba(43,255,136,0.15)", color: "#2BFF88" }}>
                        {getInitials(p.full_name)}
                      </div>
                    )}
                    <span className="text-sm font-semibold text-white">{p.full_name}</span>
                  </div>
                  <span className="text-sm" style={{ color: "#9CA3AF" }}>{p.followers} seguidores</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Victory Ranking */}
      {showVictories && (
        <section>
          <h2 className="text-lg font-display text-white flex items-center gap-2 mb-3"><Trophy className="h-5 w-5" style={{ color: "#2BFF88" }} /> Ranking de Vitórias</h2>
          {ranking.length === 0 ? (
            <Card className="p-8 text-center" style={{ background: "#0B0F12", borderColor: "rgba(43,255,136,0.1)" }}>
              <p style={{ color: "#9CA3AF" }}>Nenhum resultado registrado ainda.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {ranking.map((r, i) => (
                <Card key={r.user_id} className="cursor-pointer transition-colors" onClick={() => navigate(`/profile/${r.user_id}`)} style={{ background: "#0B0F12", borderColor: i < 3 ? "rgba(43,255,136,0.3)" : "rgba(43,255,136,0.1)" }}>
                  <CardContent className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg w-8 text-center">{medals[i] || `#${i + 1}`}</span>
                      <div>
                        <p className="font-bold text-white">{r.profile?.full_name || "Atleta"}</p>
                        {r.profile?.city && <p className="text-xs" style={{ color: "#9CA3AF" }}>{r.profile.city} - {r.profile.state}</p>}
                      </div>
                    </div>
                    <span className="text-lg font-bold" style={{ color: "#2BFF88" }}>{r.points} pts</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
};

export default Ranking;
