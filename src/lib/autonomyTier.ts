/**
 * Autonomy Tier — Phase 10 client lib (AI Control Tower).
 * Thin wrappers over Supabase RPCs/views. Zero IA local.
 */
import { supabase } from "@/integrations/supabase/client";

export type AutonomyTier = "free" | "growth" | "pro" | "business" | "enterprise";

export interface TenantTier {
  tier: AutonomyTier;
  plan_id: string | null;
  calls_limit: number;
  suggestions_limit: number;
  auto_limit: number;
  allowed_domains: string[];
  source: "override" | "subscription" | "fallback";
}

export interface UsageSummary {
  tenant_id: string;
  tenant_name: string | null;
  tier: AutonomyTier;
  period_month: string;
  total_calls: number;
  total_suggestions: number;
  total_actions_proposed: number;
  total_auto_executed: number;
  total_approved: number;
  total_rejected: number;
  total_blocked_by_quota: number;
  estimated_time_saved_minutes: number;
  calls_limit: number;
  suggestions_limit: number;
  auto_limit: number;
  pct_calls: number;
  pct_suggestions: number;
  pct_auto: number;
  projected_calls_eom: number;
  last_activity: string | null;
}

export const TIER_LABELS: Record<AutonomyTier, string> = {
  free: "Free",
  growth: "Growth",
  pro: "Pro",
  business: "Business",
  enterprise: "Enterprise",
};

export const TIER_FEATURES: Record<AutonomyTier, { autoRiskLevels: string[]; description: string; rank: number }> = {
  free:       { autoRiskLevels: [],                  description: "Apenas sugestões. Sem auto-execução.",            rank: 0 },
  growth:     { autoRiskLevels: [],                  description: "Sugestões + aprovação manual.",                   rank: 1 },
  pro:        { autoRiskLevels: ["low"],             description: "Auto-execução de ações de baixo risco.",          rank: 2 },
  business:   { autoRiskLevels: ["low","medium"],    description: "Auto-execução de ações de risco baixo e médio.",  rank: 3 },
  enterprise: { autoRiskLevels: ["low","medium","high"], description: "Autonomia ampliada com guardrails.",          rank: 4 },
};

export const nextTier = (tier: AutonomyTier): AutonomyTier | null => {
  const order: AutonomyTier[] = ["free", "growth", "pro", "business", "enterprise"];
  const i = order.indexOf(tier);
  return i >= 0 && i < order.length - 1 ? order[i + 1] : null;
};

export async function fetchTenantTier(tenantId: string): Promise<TenantTier | null> {
  const { data, error } = await (supabase as any).rpc("orkym_get_tenant_tier", { _tenant: tenantId });
  if (error) {
    console.warn("[autonomyTier] fetchTenantTier", error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    tier: row.tier as AutonomyTier,
    plan_id: row.plan_id ?? null,
    calls_limit: row.calls_limit ?? 0,
    suggestions_limit: row.suggestions_limit ?? 0,
    auto_limit: row.auto_limit ?? 0,
    allowed_domains: row.allowed_domains ?? [],
    source: (row.source as TenantTier["source"]) ?? "fallback",
  };
}

export async function fetchUsageSummary(tenantId: string): Promise<UsageSummary | null> {
  const period = new Date();
  const periodStr = new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const { data, error } = await (supabase as any)
    .from("v_orkym_usage_summary")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("period_month", periodStr)
    .maybeSingle();
  if (error) {
    console.warn("[autonomyTier] fetchUsageSummary", error.message);
  }
  if (data) return data as UsageSummary;

  // Sem registro = mês zerado. Buscar tier para preencher limites.
  const tier = await fetchTenantTier(tenantId);
  if (!tier) return null;
  return {
    tenant_id: tenantId,
    tenant_name: null,
    tier: tier.tier,
    period_month: periodStr,
    total_calls: 0,
    total_suggestions: 0,
    total_actions_proposed: 0,
    total_auto_executed: 0,
    total_approved: 0,
    total_rejected: 0,
    total_blocked_by_quota: 0,
    estimated_time_saved_minutes: 0,
    calls_limit: tier.calls_limit,
    suggestions_limit: tier.suggestions_limit,
    auto_limit: tier.auto_limit,
    pct_calls: 0,
    pct_suggestions: 0,
    pct_auto: 0,
    projected_calls_eom: 0,
    last_activity: null,
  };
}

export async function fetchUsageHistory(tenantId: string, months = 6): Promise<UsageSummary[]> {
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  const sinceStr = new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const { data, error } = await (supabase as any)
    .from("v_orkym_usage_summary")
    .select("*")
    .eq("tenant_id", tenantId)
    .gte("period_month", sinceStr)
    .order("period_month", { ascending: false });
  if (error) {
    console.warn("[autonomyTier] fetchUsageHistory", error.message);
    return [];
  }
  return (data ?? []) as UsageSummary[];
}

export async function fetchAllTenantsUsage(): Promise<UsageSummary[]> {
  const period = new Date();
  const periodStr = new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const { data, error } = await (supabase as any)
    .from("v_orkym_usage_summary")
    .select("*")
    .eq("period_month", periodStr)
    .order("total_auto_executed", { ascending: false });
  if (error) {
    console.warn("[autonomyTier] fetchAllTenantsUsage", error.message);
    return [];
  }
  return (data ?? []) as UsageSummary[];
}

export const formatTimeSaved = (minutes: number): string => {
  if (!minutes || minutes <= 0) return "0 min";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
};
