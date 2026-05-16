import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LiveCheckin = {
  id: string;
  display_name: string | null;
  phone_e164: string | null;
  sport: string | null;
  source: string;
  booking_id: string | null;
  created_at: string;
};

/** Subscribes to today's arena_checkins for an arena. Realtime INSERT + 30s safety poll. */
export function useArenaCheckinsLive(arenaId: string | undefined, limit = 20) {
  const [items, setItems] = useState<LiveCheckin[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    if (!arenaId) return;
    const since = new Date(); since.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("arena_checkins")
      .select("id, display_name, phone_e164, sport, source, booking_id, created_at")
      .eq("arena_id", arenaId)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(limit);
    setItems((data as any) || []);
    setLoading(false);
  }, [arenaId, limit]);

  useEffect(() => {
    if (!arenaId) return;
    fetchItems();
    const channel = supabase
      .channel(`arena-checkins-live-${arenaId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "arena_checkins", filter: `arena_id=eq.${arenaId}` },
        () => fetchItems()
      )
      .subscribe();
    const t = setInterval(fetchItems, 30_000);
    return () => { supabase.removeChannel(channel); clearInterval(t); };
  }, [arenaId, fetchItems]);

  return { items, loading, refresh: fetchItems };
}
