import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UnifiedFeedItem {
  item_key: string;
  item_type: string; // 'tournament_boost' | 'company_boost' | 'product_boost' | 'sponsored_post'
  item_id: string | null;
  occurred_at: string;
  type: "boost" | "sponsored";
  campaign_id: string | null;
  company_id: string | null;
  target_type: string | null;
  target_id: string | null;
  priority_score: number;
  payload: any;
  // enriched
  company_name?: string | null;
  company_logo?: string | null;
}

/** Fetches active boosts + sponsored posts ordered by priority_score. */
export function useFeedUnified(limit = 10) {
  const [items, setItems] = useState<UnifiedFeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await (supabase as any)
        .from("feed_unified_v")
        .select("*")
        .order("priority_score", { ascending: false })
        .order("occurred_at", { ascending: false })
        .limit(limit);

      const rows = (data ?? []) as UnifiedFeedItem[];
      const companyIds = Array.from(
        new Set(rows.map((r) => r.company_id).filter(Boolean))
      ) as string[];

      let companyMap: Record<string, { name: string; logo_url: string | null }> = {};
      if (companyIds.length) {
        const { data: comps } = await supabase
          .from("companies")
          .select("id,name,logo_url")
          .in("id", companyIds);
        (comps ?? []).forEach((c: any) => {
          companyMap[c.id] = { name: c.name, logo_url: c.logo_url };
        });
      }

      const enriched = rows.map((r) => ({
        ...r,
        company_name: r.company_id ? companyMap[r.company_id]?.name ?? null : null,
        company_logo: r.company_id ? companyMap[r.company_id]?.logo_url ?? null : null,
      }));

      if (active) {
        setItems(enriched);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [limit]);

  return { items, loading };
}
