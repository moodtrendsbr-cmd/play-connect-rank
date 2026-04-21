/**
 * ORKYM Bridge — single entrypoint for all intelligence/automation calls.
 *
 * Architectural rule:
 *   MoodPlay does NOT implement intelligence locally.
 *   Any reasoning, prediction, ranking, optimization, recommendation, or
 *   decision-making MUST go through ORKYM via this wrapper.
 *
 * The edge function `orkym-invoke` validates JWT, forwards to ORKYM with
 * service token, dedups, retries, and logs every call.
 * In degraded mode (missing secrets / upstream down) the wrapper resolves
 * silently with `degraded:true` so the app never crashes.
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

export interface OrkymResponse {
  ok: boolean;
  degraded?: boolean;
  deduped?: boolean;
  tasks_created?: number;
  suggestions?: OrkymSuggestion[];
  alerts?: OrkymAlert[];
  meta?: Record<string, unknown>;
  request_id?: string;
  error?: string;
}

/**
 * Calls the ORKYM bridge. Always resolves — never throws to the caller.
 * Callers should check `ok` and `degraded`.
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
