import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SocialEventCard, type SocialFeedItem } from "./SocialEventCard";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  limit?: number;
  profileId?: string;
  tenantId?: string;
  title?: string;
}

export const SocialActivityFeed = ({ limit = 20, profileId, tenantId, title = "Atividade da rede" }: Props) => {
  const [items, setItems] = useState<SocialFeedItem[] | null>(null);

  useEffect(() => {
    (async () => {
      let q = (supabase as any)
        .from("social_feed_public_v2")
        .select("event_id,event_type,occurred_at,profile_id,username,display_name,avatar_url,arena_name,tenant_name,description,payload")
        .order("occurred_at", { ascending: false })
        .limit(limit);
      if (profileId) q = q.eq("profile_id", profileId);
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { data } = await q;
      setItems((data as SocialFeedItem[]) || []);
    })();
  }, [limit, profileId, tenantId]);

  if (items === null) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
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
