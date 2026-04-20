/**
 * ORKYM Bridge — single entrypoint for all intelligence/automation calls.
 *
 * Architectural rule:
 *   MoodPlay does NOT implement intelligence locally.
 *   Any reasoning, prediction, ranking, optimization, recommendation, or
 *   decision-making MUST go through ORKYM via this wrapper.
 *
 * The edge function `orkym-invoke` validates JWT and routes to ORKYM.
 * In Phase 1 the function returns 501 (placeholder) — the boundary is
 * defined; concrete domains/actions are wired in later phases.
 */
import { supabase } from "@/integrations/supabase/client";

export interface OrkymRequest<P = unknown> {
  domain: string;   // e.g. "tournaments", "ranking", "matchmaking", "feed"
  action: string;   // e.g. "seed-bracket", "score-pair", "rank-feed"
  payload?: P;
}

export interface OrkymResponse<R = unknown> {
  ok: boolean;
  data?: R;
  error?: string;
}

export async function invokeOrkym<R = unknown, P = unknown>(
  req: OrkymRequest<P>
): Promise<OrkymResponse<R>> {
  const { data, error } = await supabase.functions.invoke("orkym-invoke", {
    body: req,
  });
  if (error) return { ok: false, error: error.message };
  return data as OrkymResponse<R>;
}
