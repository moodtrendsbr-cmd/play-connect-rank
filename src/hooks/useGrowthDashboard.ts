import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type GrowthScope =
  | { type: "tenant"; id: string }
  | { type: "arena"; id: string }
  | { type: "company"; id: string }
  | { type: "admin" };

export interface GrowthDashboardRow {
  tenant_id: string | null;
  arena_id: string | null;
  action_type: string;
  execution_mode: string | null;
  policy_source: string | null;
  total_30d: number;
  suggested_30d: number;
  approve_30d: number;
  auto_30d: number;
  blocked_30d: number;
  revenue_30d: number;
}

export interface GrowthBudget {
  id: string;
  scope_type: string;
  scope_id: string | null;
  period: string;
  budget_brl: number;
  spent_brl: number;
  boost_count_limit: number | null;
  boost_count_used: number;
  active: boolean;
  notes: string | null;
  period_started_at: string;
}

export interface GrowthTotals {
  suggested: number;
  auto: number;
  blocked: number;
  revenue: number;
  byActionType: Array<{ action_type: string; total: number; auto: number; blocked: number; revenue: number }>;
}

export function useGrowthDashboard(scope: GrowthScope) {
  const [rows, setRows] = useState<GrowthDashboardRow[]>([]);
  const [budgets, setBudgets] = useState<GrowthBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let q = supabase.from("v_growth_dashboard" as any).select("*");
      if (scope.type === "tenant") q = q.eq("tenant_id", scope.id);
      else if (scope.type === "arena") q = q.eq("arena_id", scope.id);
      // company/admin: RLS no underlying proposals view enforces filtering

      const { data, error: err } = await q;
      if (err) throw err;
      setRows(((data ?? []) as unknown) as GrowthDashboardRow[]);

      // Budgets visible to current user (RLS scopes them automatically)
      let bq = supabase.from("growth_budgets").select("*").eq("active", true);
      if (scope.type === "tenant") bq = bq.or(`scope_id.eq.${scope.id},scope_type.eq.global`);
      else if (scope.type === "arena") bq = bq.or(`scope_id.eq.${scope.id},scope_type.eq.global`);
      else if (scope.type === "company") bq = bq.or(`scope_id.eq.${scope.id},scope_type.eq.global`);
      const { data: bd, error: be } = await bq;
      if (be) throw be;
      setBudgets((bd ?? []) as GrowthBudget[]);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [scope.type, (scope as any).id]);

  useEffect(() => { refresh(); }, [refresh]);

  const totals: GrowthTotals = (() => {
    const out: GrowthTotals = { suggested: 0, auto: 0, blocked: 0, revenue: 0, byActionType: [] };
    const map = new Map<string, GrowthTotals["byActionType"][number]>();
    for (const r of rows) {
      out.suggested += Number(r.suggested_30d) || 0;
      out.auto += Number(r.auto_30d) || 0;
      out.blocked += Number(r.blocked_30d) || 0;
      out.revenue += Number(r.revenue_30d) || 0;
      const k = r.action_type;
      const prev = map.get(k) ?? { action_type: k, total: 0, auto: 0, blocked: 0, revenue: 0 };
      prev.total += Number(r.total_30d) || 0;
      prev.auto += Number(r.auto_30d) || 0;
      prev.blocked += Number(r.blocked_30d) || 0;
      prev.revenue += Number(r.revenue_30d) || 0;
      map.set(k, prev);
    }
    out.byActionType = Array.from(map.values()).sort((a, b) => b.total - a.total);
    return out;
  })();

  return { rows, budgets, totals, loading, error, refresh };
}
