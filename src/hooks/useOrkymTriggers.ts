import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface OrkymTrigger {
  id: string;
  tenant_id: string;
  arena_id: string | null;
  user_id: string | null;
  profile_type: string;
  trigger_type: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown>;
  priority: "high" | "medium" | "low";
  status: "pending" | "claimed" | "processed" | "skipped" | "failed";
  attempts: number;
  last_error: string | null;
  created_at: string;
  processed_at: string | null;
}

interface Options {
  tenantId?: string | null;
  arenaId?: string | null;
  limit?: number;
}

export function useOrkymTriggers({ tenantId, arenaId, limit = 50 }: Options) {
  const [triggers, setTriggers] = useState<OrkymTrigger[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tenantId && !arenaId) return;
    setLoading(true);
    setError(null);
    let q = supabase
      .from("orkym_triggers_queue")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (tenantId) q = q.eq("tenant_id", tenantId);
    if (arenaId) q = q.eq("arena_id", arenaId);
    const { data, error: err } = await q;
    if (err) setError(err.message);
    else setTriggers((data ?? []) as OrkymTrigger[]);
    setLoading(false);
  }, [tenantId, arenaId, limit]);

  useEffect(() => { refresh(); }, [refresh]);

  return { triggers, loading, error, refresh };
}
