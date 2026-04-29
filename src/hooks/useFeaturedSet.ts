import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns a Set of entity_ids that are currently featured for a given entity_type.
 * Use in lists (Marketplace, Tournaments) to render a Featured badge per row
 * without N+1 queries.
 */
export function useFeaturedSet(
  entityType: "tournament" | "product" | "company" | "arena" | "sponsored_post"
) {
  const [set, setSet] = useState<Set<string>>(new Set());
  const [tierMap, setTierMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("featured_active_v")
        .select("entity_id, tier")
        .eq("entity_type", entityType);
      if (!mounted) return;
      const ids = new Set<string>();
      const map: Record<string, string> = {};
      ((data as any[]) || []).forEach((r) => {
        ids.add(r.entity_id);
        // keep highest tier (spotlight > premium > basic)
        const order = { basic: 1, premium: 2, spotlight: 3 } as Record<string, number>;
        if (!map[r.entity_id] || (order[r.tier] || 0) > (order[map[r.entity_id]] || 0)) {
          map[r.entity_id] = r.tier;
        }
      });
      setSet(ids);
      setTierMap(map);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [entityType]);

  return { featuredSet: set, tierMap, loading };
}
