/**
 * ORKYM Bridge — single entrypoint for all intelligence/automation calls.
 *
 * Architectural rule:
 *   MoodPlay does NOT implement intelligence locally.
 *   Any reasoning, prediction, ranking, optimization, recommendation, or
 *   decision-making MUST go through ORKYM via this wrapper.
 */
import { supabase } from "@/integrations/supabase/client";

export type OrkymDomain = "arena_operations" | "finance" | "tournaments" | "growth";

export interface OrkymPayload {
  tenant_id: string;
  arena_id?: string;
  context?: Record<string, unknown>;
  entity?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface OrkymTask {
  title: string;
  description?: string;
  priority?: 1 | 2 | 3;
  task_type?: string;
  related_entity_type?: string;
  related_entity_id?: string;
}

export interface OrkymSuggestion {
  id: string;
  title: string;
  body: string;
  cta?: { label: string; href?: string };
}

export interface OrkymAlert {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  body?: string;
}

// ============== Phase 8: Action Proposals ==============
export type OrkymActionType =
  | "create_followup"
  | "create_reminder"
  | "create_occurrence"
  | "propose_manual_charge"
  | "flag_enrollment_attention"
  | "propose_promotion"
  | "schedule_operational_review"
  | "open_communication_thread"
  | "recovery_campaign_draft";

export type OrkymActionStatus =
  | "proposed" | "approved" | "rejected"
  | "executing" | "executed" | "failed"
  | "expired" | "canceled";

export interface OrkymActionProposal {
  id: string;
  tenant_id: string;
  arena_id: string | null;
  domain: OrkymDomain;
  action_type: OrkymActionType;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high";
  status: OrkymActionStatus;
  related_entity_type: string | null;
  related_entity_id: string | null;
  human_summary: Record<string, unknown>;
  expires_at: string;
  created_at: string;
  approved_by?: string | null;
  approved_at?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
  executed_at?: string | null;
  execution_result?: Record<string, unknown> | null;
  failure_reason?: string | null;
  // Phase 9
  execution_mode?: "suggest" | "approve" | "auto" | null;
  policy_id?: string | null;
  policy_source?: string | null;
  auto_executed?: boolean | null;
  initial_status?: string | null;
}

export interface OrkymResponse {
  ok: boolean;
  degraded?: boolean;
  deduped?: boolean;
  tasks_created?: number;
  actions_proposed?: number;
  suggestions?: OrkymSuggestion[];
  alerts?: OrkymAlert[];
  meta?: Record<string, unknown>;
  request_id?: string;
  error?: string;
  actions_auto_executed?: number;
}

/**
 * Calls the ORKYM bridge. Always resolves — never throws to the caller.
 */
export async function invokeOrkym(
  domain: OrkymDomain,
  action: string,
  payload: OrkymPayload,
): Promise<OrkymResponse> {
  try {
    const { data, error } = await supabase.functions.invoke("orkym-invoke", {
      body: { domain, action, payload },
    });
    if (error) {
      console.warn("[orkym] transport error", error.message);
      return { ok: false, degraded: true, error: error.message };
    }
    return data as OrkymResponse;
  } catch (e: any) {
    console.warn("[orkym] unexpected error", e?.message);
    return { ok: false, degraded: true, error: e?.message ?? "unknown" };
  }
}

// ============== Action Proposals helpers ==============

export interface ListActionFilters {
  tenantId?: string;
  arenaId?: string;
  status?: OrkymActionStatus | OrkymActionStatus[];
  domain?: OrkymDomain;
  limit?: number;
}

export async function listActionProposals(filters: ListActionFilters = {}): Promise<OrkymActionProposal[]> {
  let q = (supabase as any)
    .from("orkym_action_proposals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 50);
  if (filters.tenantId) q = q.eq("tenant_id", filters.tenantId);
  if (filters.arenaId) q = q.eq("arena_id", filters.arenaId);
  if (filters.domain) q = q.eq("domain", filters.domain);
  if (filters.status) {
    if (Array.isArray(filters.status)) q = q.in("status", filters.status);
    else q = q.eq("status", filters.status);
  }
  const { data, error } = await q;
  if (error) {
    console.warn("[orkym] listActionProposals error", error.message);
    return [];
  }
  return (data ?? []) as OrkymActionProposal[];
}

export async function approveAction(proposalId: string): Promise<{ ok: boolean; error?: string; data?: OrkymActionProposal }> {
  const { data, error } = await (supabase as any).rpc("orkym_action_approve", { _proposal_id: proposalId });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data as OrkymActionProposal };
}

export async function rejectAction(proposalId: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await (supabase as any).rpc("orkym_action_reject", { _proposal_id: proposalId, _reason: reason });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function executeAction(proposalId: string): Promise<OrkymResponse & { status?: string; result?: any }> {
  try {
    const { data, error } = await supabase.functions.invoke("orkym-execute-action", {
      body: { proposal_id: proposalId },
    });
    if (error) return { ok: false, error: error.message };
    return data as any;
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "unknown" };
  }
}
