import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MapPin, Users, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface Suggestion {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  city: string | null;
  state: string | null;
  mutual_count: number;
  reason: "mutual" | "location";
}

const FriendSuggestions = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const fetchSuggestions = useCallback(async () => {
    if (!user) { setLoading(false); return; }

    // 1. Get my profile (city/state) and who I follow
    const [profileRes, followsRes] = await Promise.all([
      supabase.from("profiles").select("city, state").eq("user_id", user.id).maybeSingle(),
      supabase.from("follows").select("following_id").eq("follower_id", user.id),
    ]);

    const myCity = profileRes.data?.city?.toLowerCase() || "";
    const myState = profileRes.data?.state?.toLowerCase() || "";
    const followingIds = (followsRes.data || []).map((f) => f.following_id);
    const excludeSet = new Set([user.id, ...followingIds]);

    // 2. Friends of friends (mutual)
    const mutualMap = new Map<string, number>();
    if (followingIds.length > 0) {
      const { data: fof } = await supabase
        .from("follows")
        .select("following_id")
        .in("follower_id", followingIds)
        .limit(500);

      (fof || []).forEach((f) => {
        if (!excludeSet.has(f.following_id)) {
          mutualMap.set(f.following_id, (mutualMap.get(f.following_id) || 0) + 1);
        }
      });
    }

    // 3. Get profiles for mutual suggestions
    const mutualIds = Array.from(mutualMap.keys()).slice(0, 20);
    let mutualProfiles: Suggestion[] = [];
    if (mutualIds.length > 0) {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, city, state")
        .in("user_id", mutualIds);
      mutualProfiles = (data || []).map((p) => ({
        ...p,
        mutual_count: mutualMap.get(p.user_id) || 0,
        reason: "mutual" as const,
      }));
      mutualProfiles.sort((a, b) => b.mutual_count - a.mutual_count);
    }

    // 4. Location-based suggestions
    let locationProfiles: Suggestion[] = [];
    if (myCity || myState) {
      let q = supabase.from("profiles").select("user_id, full_name, avatar_url, city, state").limit(30);
      if (myCity) q = q.ilike("city", myCity);
      else if (myState) q = q.ilike("state", myState);

      const { data } = await q;
      const mutualSet = new Set(mutualIds);
      locationProfiles = (data || [])
        .filter((p) => !excludeSet.has(p.user_id) && !mutualSet.has(p.user_id))
        .map((p) => ({ ...p, mutual_count: 0, reason: "location" as const }));
    }

    // 5. Combine: mutual first, then location, limit 10
    const combined = [...mutualProfiles, ...locationProfiles].slice(0, 10);
    setSuggestions(combined);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchSuggestions(); }, [fetchSuggestions]);

  const handleFollow = async (targetId: string) => {
    if (!user) return;
    setSuggestions((prev) => prev.filter((s) => s.user_id !== targetId));
    await supabase.from("follows").insert({ follower_id: user.id, following_id: targetId });
  };

  const handleDismiss = (targetId: string) => {
    setDismissed((prev) => new Set(prev).add(targetId));
  };

  const visible = suggestions.filter((s) => !dismissed.has(s.user_id));

  if (loading || visible.length === 0) return null;

  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-muted-foreground mb-2 px-1">Sugestões para você</h3>
      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-2">
          {visible.map((s) => (
            <div
              key={s.user_id}
              className="relative flex-shrink-0 w-[120px] flex flex-col items-center rounded-xl border border-border bg-card p-3 gap-2"
            >
              <button
                onClick={() => handleDismiss(s.user_id)}
                className="absolute top-1 right-1 p-0.5 rounded-full text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
              <div
                className="cursor-pointer"
                onClick={() => navigate(`/profile/${s.user_id}`)}
              >
                <Avatar className="h-14 w-14 border-2 border-primary/30">
                  <AvatarImage src={s.avatar_url || ""} />
                  <AvatarFallback className="bg-muted text-foreground text-sm font-bold">
                    {(s.full_name || "A").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
              <span
                className="text-xs font-medium text-foreground text-center truncate w-full cursor-pointer"
                onClick={() => navigate(`/profile/${s.user_id}`)}
              >
                {s.full_name || "Atleta"}
              </span>
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                {s.reason === "mutual" ? (
                  <><Users className="h-3 w-3" />{s.mutual_count} em comum</>
                ) : (
                  <><MapPin className="h-3 w-3" />{s.city || s.state || ""}</>
                )}
              </span>
              <Button
                size="sm"
                className="w-full h-7 text-xs font-bold"
                onClick={() => handleFollow(s.user_id)}
              >
                Seguir
              </Button>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
};

export default FriendSuggestions;
