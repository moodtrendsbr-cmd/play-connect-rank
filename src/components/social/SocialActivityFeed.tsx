import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SocialEventCard, type SocialFeedItem } from "./SocialEventCard";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  limit?: number;
  profileId?: string;
  tenantId?: string;
  arenaId?: string;
  tournamentId?: string;
  title?: string;
  realtime?: boolean;
}

export const SocialActivityFeed = ({
  limit = 20, profileId, tenantId, arenaId, tournamentId, title = "Atividade da rede", realtime = false,
}: Props) => {
  const [items, setItems] = useState<SocialFeedItem[] | null>(null);

  const load = async () => {
    let q = (supabase as any)
      .from("social_feed_public_v2")
      .select("event_id,event_type,occurred_at,profile_id,username,display_name,avatar_url,arena_name,tenant_name,description,payload,arena_id,tenant_id")
      .order("occurred_at", { ascending: false })
      .limit(limit);
    if (profileId) q = q.eq("profile_id", profileId);
    if (tenantId) q = q.eq("tenant_id", tenantId);
    if (arenaId) q = q.eq("arena_id", arenaId);
    const { data } = await q;
    let rows = (data as SocialFeedItem[]) || [];
    if (tournamentId) {
      rows = rows.filter((r) => r.payload?.tournament_id === tournamentId);
    }
    setItems(rows);
  };

  // Incremental merge: fetch the single new row from the view and prepend it,
  // respecting filters and dedup by event_id. Avoids a global refetch per event.
  const mergeOne = async (newEventId: string) => {
    let q = (supabase as any)
      .from("social_feed_public_v2")
      .select("event_id,event_type,occurred_at,profile_id,username,display_name,avatar_url,arena_name,tenant_name,description,payload,arena_id,tenant_id")
      .eq("event_id", newEventId)
      .limit(1);
    if (profileId) q = q.eq("profile_id", profileId);
    if (tenantId) q = q.eq("tenant_id", tenantId);
    if (arenaId) q = q.eq("arena_id", arenaId);
    const { data } = await q;
    const row = (data as SocialFeedItem[] | null)?.[0];
    if (!row) return;
    if (tournamentId && row.payload?.tournament_id !== tournamentId) return;
    setItems((prev) => {
      const base = prev ?? [];
      if (base.some((r) => r.event_id === row.event_id)) return base;
      return [row, ...base].slice(0, limit);
    });
  };

  useEffect(() => {
    load();
    if (!realtime) return;
    const channel = (supabase as any)
      .channel(`social-feed-${arenaId || tournamentId || profileId || "global"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "social_events" },
        (payload: any) => {
          const id = payload?.new?.id;
          if (id) mergeOne(id);
        }
      )
      .subscribe();
    return () => { (supabase as any).removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, profileId, tenantId, arenaId, tournamentId, realtime]);

  if (items === null) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" />
      </div>
    );
  }
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">Sem atividades por aqui ainda.</p>;
  }
  return (
    <div className="space-y-2">
      {title && <h3 className="text-sm font-semibold text-foreground/80 px-1">{title}</h3>}
      {items.map((it) => <SocialEventCard key={it.event_id} item={it} />)}
    </div>
  );
};
