import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RevenueKpisScope =
  | { type: "arena"; id: string }
  | { type: "tenant"; id: string }
  | { type: "company"; id: string }
  | { type: "admin" };

export interface RevenueKpis {
  revenue_total: number;
  revenue_orkym: number;
  bookings_total?: number;
  bookings_via_wa?: number;
  orders_total?: number;
  orders_via_wa?: number;
  messages_sent?: number;
  conversions?: number;
  arenas?: Array<{ arena_id: string; name: string; revenue_orkym: number; conversions: number }>;
}

export interface MessagePerformanceRow {
  trigger_type: string;
  sent: number;
  delivered: number;
  responded: number;
  converted: number;
  revenue: number;
  conversion_rate: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function useRevenueKpis(scope: RevenueKpisScope, days = 30) {
  const [data, setData] = useState<RevenueKpis | null>(null);
  const [perf, setPerf] = useState<MessagePerformanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const to = new Date();
    const from = new Date(to.getTime() - days * DAY_MS);
    const fromIso = from.toISOString();
    const toIso = to.toISOString();

    try {
      let kpis: any = null;
      let perfScope: { type: "tenant" | "arena" | "admin"; id: string | null } | null = null;

      if (scope.type === "arena") {
        const { data: d, error } = await supabase.rpc("orkym_revenue_kpis_arena", {
          _arena_id: scope.id, _from: fromIso, _to: toIso,
        });
        if (error) throw error;
        kpis = d;
        perfScope = { type: "arena", id: scope.id };
      } else if (scope.type === "tenant") {
        const { data: d, error } = await supabase.rpc("orkym_revenue_kpis_tenant", {
          _tenant_id: scope.id, _from: fromIso, _to: toIso,
        });
        if (error) throw error;
        kpis = d;
        perfScope = { type: "tenant", id: scope.id };
      } else if (scope.type === "company") {
        const { data: d, error } = await supabase.rpc("orkym_revenue_kpis_company", {
          _company_id: scope.id, _from: fromIso, _to: toIso,
        });
        if (error) throw error;
        kpis = d;
      } else {
        const { data: d, error } = await supabase.rpc("orkym_revenue_kpis_admin", {
          _from: fromIso, _to: toIso,
        });
        if (error) throw error;
        kpis = d;
        perfScope = { type: "admin", id: null };
      }

      setData(kpis as RevenueKpis);

      if (perfScope) {
        const { data: rows, error: pe } = await supabase.rpc("orkym_message_performance", {
          _scope_type: perfScope.type,
          _scope_id: perfScope.id,
          _from: fromIso,
          _to: toIso,
        });
        if (pe) throw pe;
        setPerf((rows as MessagePerformanceRow[]) ?? []);
      } else {
        setPerf([]);
      }
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [scope.type, (scope as any).id, days]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, perf, loading, error, refresh };
}
