import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CTScope =
  | { type: "admin" }
  | { type: "tenant"; id: string }
  | { type: "arena"; id: string }
  | { type: "organizer"; id: string }
  | { type: "company"; id: string };

export interface CTRecommendation {
  id: string;
  title: string;
  body: string;
  action_type: string;
  trigger_id?: string;
  entity_type?: string | null;
  entity_id?: string | null;
  impact: number;
  effort: number;
}

export interface CTAlert {
  id?: string;
  severity: "info" | "warning" | "critical";
  kind: string;
  title: string;
  body?: string;
  entity_type?: string | null;
  entity_id?: string | null;
}

export interface CTOpportunity {
  id: string;
  kind: string;
  title: string;
  impact: "low" | "medium" | "high";
  entity_type?: string | null;
  entity_id?: string | null;
  payload?: Record<string, unknown>;
}

export interface CTSummary {
  scope_type: string;
  scope_id: string | null;
  health_score: number | null;
  sub_scores: {
    enrollment: number | null;
    revenue: number | null;
    occupancy: number | null;
    engagement: number | null;
    orkym_adoption: number | null;
  };
  alerts: CTAlert[];
  opportunities: CTOpportunity[];
  recommendations: CTRecommendation[];
  next_best_action: CTRecommendation | null;
  generated_at: string;
}

export function useControlTowerSummary(scope: CTScope, opts?: { pollMs?: number }) {
  const [summary, setSummary] = useState<CTSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const { data, error: err } = await (supabase as any).rpc("control_tower_summary", {
        _scope_type: scope.type,
        _scope_id: scope.type === "admin" ? null : (scope as any).id,
      });
      if (err) throw err;
      setSummary(data as CTSummary);
    } catch (e: any) {
      setError(e?.message ?? "unknown");
    } finally {
      setLoading(false);
    }
  }, [scope.type, (scope as any).id]);

  useEffect(() => {
    refresh();
    const ms = opts?.pollMs ?? 60_000;
    if (ms <= 0) return;
    const t = setInterval(refresh, ms);
    return () => clearInterval(t);
  }, [refresh, opts?.pollMs]);

  return { summary, loading, error, refresh };
}
