import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MemoryRow = {
  key: string;
  value: Record<string, unknown>;
  confidence: number;
  source: string;
  memory_type: string;
  last_seen_at: string;
};

export function useMemoryContext(params: {
  entity_type: "user" | "arena" | "organizer" | "company" | "tenant";
  entity_id?: string | null;
  tenant_id?: string | null;
}) {
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!params.entity_id || !params.tenant_id) {
        if (active) { setMemories([]); setLoading(false); }
        return;
      }
      setLoading(true);
      const { data } = await supabase
        .from("conversational_memory")
        .select("key,value,confidence,source,memory_type,last_seen_at")
        .eq("entity_type", params.entity_type)
        .eq("entity_id", params.entity_id)
        .eq("tenant_id", params.tenant_id)
        .order("confidence", { ascending: false })
        .order("last_seen_at", { ascending: false })
        .limit(20);
      if (active) {
        setMemories((data ?? []) as MemoryRow[]);
        setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [params.entity_type, params.entity_id, params.tenant_id]);

  return { memories, loading };
}
