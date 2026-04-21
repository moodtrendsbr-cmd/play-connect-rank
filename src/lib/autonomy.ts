/**
 * Autonomy Policies — Phase 9 client lib.
 * Pure thin wrappers over Supabase. Zero IA local.
 */
import { supabase } from "@/integrations/supabase/client";

export type ExecutionMode = "suggest" | "approve" | "auto";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type PolicyScope = "global" | "tenant" | "arena";
export type KillScope = "global" | "tenant" | "arena" | "domain" | "action_type";

export interface AutonomyPolicy {
  id: string;
  scope_level: PolicyScope;
  tenant_id: string | null;
  arena_id: string | null;
  domain: string | null;
  action_type: string | null;
  execution_mode: ExecutionMode;
  risk_level: RiskLevel;
  is_enabled: boolean;
  conditions: Record<string, unknown>;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface KillSwitch {
  id: string;
  scope_level: KillScope;
  tenant_id: string | null;
  arena_id: string | null;
  domain: string | null;
  action_type: string | null;
  is_active: boolean;
  reason: string;
  activated_at: string;
  activated_by: string | null;
  deactivated_at: string | null;
  deactivated_by: string | null;
}

export interface PolicyLog {
  id: string;
  proposal_id: string | null;
  tenant_id: string | null;
  arena_id: string | null;
  domain: string | null;
  action_type: string | null;
  resolved_mode: ExecutionMode;
  policy_id: string | null;
  policy_source: string;
  guardrail_blocked: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AutonomyMetric {
  day: string;
  tenant_id: string | null;
  action_type: string | null;
  resolved_mode: ExecutionMode;
  total: number;
  auto_count: number;
  approve_count: number;
  suggest_count: number;
  blocked_by_guardrail: number;
  blocked_by_kill_switch: number;
  auto_executed_count: number;
}

// ============== Policies ==============
export interface ListPoliciesFilters {
  scope?: PolicyScope;
  tenantId?: string;
  arenaId?: string;
  domain?: string;
  actionType?: string;
  enabledOnly?: boolean;
}

export async function listPolicies(filters: ListPoliciesFilters = {}): Promise<AutonomyPolicy[]> {
  let q = (supabase as any).from("autonomy_policies").select("*").order("priority", { ascending: true });
  if (filters.scope) q = q.eq("scope_level", filters.scope);
  if (filters.tenantId) q = q.eq("tenant_id", filters.tenantId);
  if (filters.arenaId) q = q.eq("arena_id", filters.arenaId);
  if (filters.domain) q = q.eq("domain", filters.domain);
  if (filters.actionType) q = q.eq("action_type", filters.actionType);
  if (filters.enabledOnly) q = q.eq("is_enabled", true);
  const { data, error } = await q;
  if (error) {
    console.warn("[autonomy] listPolicies", error.message);
    return [];
  }
  return (data ?? []) as AutonomyPolicy[];
}

export async function upsertPolicy(input: Partial<AutonomyPolicy>): Promise<{ ok: boolean; error?: string; data?: AutonomyPolicy }> {
  const payload: any = {
    scope_level: input.scope_level,
    tenant_id: input.tenant_id ?? null,
    arena_id: input.arena_id ?? null,
    domain: input.domain ?? null,
    action_type: input.action_type ?? null,
    execution_mode: input.execution_mode ?? "approve",
    risk_level: input.risk_level ?? "medium",
    is_enabled: input.is_enabled ?? true,
    conditions: input.conditions ?? {},
    priority: input.priority ?? 100,
  };
  if (input.id) {
    const { data, error } = await (supabase as any)
      .from("autonomy_policies").update(payload).eq("id", input.id).select("*").maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  }
  const { data, error } = await (supabase as any)
    .from("autonomy_policies").insert(payload).select("*").maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

export async function togglePolicy(id: string, enabled: boolean): Promise<{ ok: boolean; error?: string }> {
  const { error } = await (supabase as any)
    .from("autonomy_policies").update({ is_enabled: enabled }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deletePolicy(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await (supabase as any).from("autonomy_policies").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ============== Kill Switches ==============
export async function listKillSwitches(filters: { tenantId?: string; activeOnly?: boolean } = {}): Promise<KillSwitch[]> {
  let q = (supabase as any).from("autonomy_kill_switches").select("*").order("activated_at", { ascending: false });
  if (filters.tenantId) q = q.or(`tenant_id.eq.${filters.tenantId},tenant_id.is.null`);
  if (filters.activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) { console.warn("[autonomy] listKillSwitches", error.message); return []; }
  return (data ?? []) as KillSwitch[];
}

export async function activateKillSwitch(input: {
  scope_level: KillScope;
  reason: string;
  tenant_id?: string;
  arena_id?: string;
  domain?: string;
  action_type?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await (supabase as any).from("autonomy_kill_switches").insert({
    scope_level: input.scope_level,
    tenant_id: input.tenant_id ?? null,
    arena_id: input.arena_id ?? null,
    domain: input.domain ?? null,
    action_type: input.action_type ?? null,
    reason: input.reason,
    is_active: true,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deactivateKillSwitch(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await (supabase as any)
    .from("autonomy_kill_switches")
    .update({ is_active: false, deactivated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ============== Policy Logs ==============
export async function fetchPolicyLogs(filters: {
  tenantId?: string;
  arenaId?: string;
  resolvedMode?: ExecutionMode;
  limit?: number;
} = {}): Promise<PolicyLog[]> {
  let q = (supabase as any).from("autonomy_policy_logs").select("*")
    .order("created_at", { ascending: false }).limit(filters.limit ?? 100);
  if (filters.tenantId) q = q.eq("tenant_id", filters.tenantId);
  if (filters.arenaId) q = q.eq("arena_id", filters.arenaId);
  if (filters.resolvedMode) q = q.eq("resolved_mode", filters.resolvedMode);
  const { data, error } = await q;
  if (error) { console.warn("[autonomy] fetchPolicyLogs", error.message); return []; }
  return (data ?? []) as PolicyLog[];
}

// ============== Metrics ==============
export async function fetchAutonomyMetrics(filters: { tenantId?: string; days?: number } = {}): Promise<AutonomyMetric[]> {
  let q = (supabase as any).from("v_autonomy_metrics").select("*");
  if (filters.tenantId) q = q.eq("tenant_id", filters.tenantId);
  const days = filters.days ?? 7;
  const since = new Date(Date.now() - days * 24 * 3600_000).toISOString().slice(0, 10);
  q = q.gte("day", since);
  const { data, error } = await q;
  if (error) { console.warn("[autonomy] metrics", error.message); return []; }
  return (data ?? []) as AutonomyMetric[];
}

// ============== Constants for UI ==============
export const ACTION_TYPES: { value: string; risk: RiskLevel; domain: string; label: string }[] = [
  { value: "create_followup",             risk: "low",      domain: "arena_operations", label: "Criar follow-up" },
  { value: "create_reminder",             risk: "low",      domain: "arena_operations", label: "Criar lembrete" },
  { value: "schedule_operational_review", risk: "low",      domain: "arena_operations", label: "Agendar revisão operacional" },
  { value: "open_communication_thread",   risk: "low",      domain: "arena_operations", label: "Abrir comunicação" },
  { value: "create_occurrence",           risk: "medium",   domain: "arena_operations", label: "Criar ocorrência" },
  { value: "flag_enrollment_attention",   risk: "medium",   domain: "arena_operations", label: "Marcar matrícula em atenção" },
  { value: "recovery_campaign_draft",     risk: "medium",   domain: "arena_operations", label: "Rascunho de campanha de recuperação" },
  { value: "propose_manual_charge",       risk: "medium",   domain: "finance",          label: "Propor cobrança manual" },
  { value: "propose_promotion",           risk: "high",     domain: "growth",           label: "Propor promoção" },
];

export const DOMAINS = ["arena_operations", "finance", "tournaments", "growth"];

export const policySourceLabel: Record<string, string> = {
  kill_switch: "Kill switch ativo",
  arena_action: "Política de arena (ação)",
  arena_domain: "Política de arena (domínio)",
  tenant_action: "Política do tenant (ação)",
  tenant_domain: "Política do tenant (domínio)",
  tenant_catchall: "Política do tenant (geral)",
  global_action: "Política global (ação)",
  global_domain: "Política global (domínio)",
  fallback: "Padrão seguro (aprovar)",
  guardrail_block: "Rebaixada por guardrail",
  legacy: "Migrada (legada)",
};

export const modeLabel: Record<ExecutionMode, string> = {
  suggest: "Sugerir",
  approve: "Aprovação manual",
  auto: "Automático",
};

export const riskLabel: Record<RiskLevel, string> = {
  low: "Baixo",
  medium: "Médio",
  high: "Alto",
  critical: "Crítico",
};
