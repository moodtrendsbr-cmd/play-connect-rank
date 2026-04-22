/**
 * Shared ORKYM action handlers (Phase 12.5).
 * Extracted from orkym-execute-action so both that function AND
 * moodplay-execute-action can dispatch the same handlers.
 *
 * These wrap EXISTING tables/RPCs. ZERO new business logic.
 */

export interface DispatchResult {
  ok: boolean;
  result?: Record<string, unknown>;
  error?: string;
}

export interface ProposalLike {
  id: string;
  tenant_id: string;
  arena_id: string | null;
  title: string;
  description: string | null;
  priority: string | null;
  action_type: string;
  proposed_payload: Record<string, unknown> | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  correlation_id: string | null;
}

const priorityNum = (p: string | null): number =>
  p === "high" ? 1 : p === "medium" ? 2 : 3;

/**
 * Dispatches a proposal action via existing tables/RPCs.
 * Returns { ok, result, error }.
 */
export async function dispatchAction(
  admin: any,
  p: ProposalLike,
): Promise<DispatchResult> {
  const payload = p.proposed_payload ?? {};
  const baseTask = {
    tenant_id: p.tenant_id,
    arena_id: p.arena_id,
    title: p.title,
    description: p.description,
    priority: priorityNum(p.priority),
    source: "orkym",
    correlation_id: p.correlation_id,
    related_entity_type: p.related_entity_type,
    related_entity_id: p.related_entity_id,
    metadata: {
      proposal_id: p.id,
      action_type: p.action_type,
      ...((payload as any).metadata ?? {}),
    },
  };

  switch (p.action_type) {
    case "create_followup":
    case "open_communication_thread":
    case "recovery_campaign_draft": {
      if (!p.arena_id) return { ok: false, error: "arena_id_required" };
      const taskType =
        p.action_type === "open_communication_thread"
          ? "outreach"
          : p.action_type === "recovery_campaign_draft"
          ? "recovery"
          : "followup";
      const { data, error } = await admin
        .from("arena_operational_tasks")
        .insert({ ...baseTask, task_type: taskType })
        .select("id")
        .single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, result: { task_id: data.id, kind: "task" } };
    }

    case "create_reminder":
    case "schedule_operational_review": {
      if (!p.arena_id) return { ok: false, error: "arena_id_required" };
      const dueAt =
        (payload as any).due_at ??
        new Date(Date.now() + 24 * 3600_000).toISOString();
      const taskType =
        p.action_type === "schedule_operational_review" ? "review" : "reminder";
      const priority =
        p.action_type === "schedule_operational_review"
          ? 1
          : baseTask.priority;
      const { data, error } = await admin
        .from("arena_operational_tasks")
        .insert({ ...baseTask, task_type: taskType, priority, due_at: dueAt })
        .select("id")
        .single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, result: { task_id: data.id, due_at: dueAt } };
    }

    case "flag_enrollment_attention": {
      if (!p.arena_id) return { ok: false, error: "arena_id_required" };
      if (p.related_entity_type === "enrollment" && p.related_entity_id) {
        await admin
          .from("arena_class_enrollments")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", p.related_entity_id);
      }
      const { data, error } = await admin
        .from("arena_operational_tasks")
        .insert({ ...baseTask, task_type: "enrollment_attention" })
        .select("id")
        .single();
      if (error) return { ok: false, error: error.message };
      return {
        ok: true,
        result: {
          task_id: data.id,
          flagged_enrollment: p.related_entity_id,
        },
      };
    }

    case "create_occurrence": {
      if (!p.arena_id) return { ok: false, error: "arena_id_required" };
      const { data, error } = await admin
        .from("arena_occurrences")
        .insert({
          tenant_id: p.tenant_id,
          arena_id: p.arena_id,
          title: p.title,
          description: p.description,
          severity: (payload as any).severity ?? "medium",
          category: (payload as any).category ?? "general",
          status: "open",
          related_entity_type: p.related_entity_type,
          related_entity_id: p.related_entity_id,
        })
        .select("id")
        .single();
      if (error) return { ok: false, error: error.message };
      return { ok: true, result: { occurrence_id: data.id } };
    }

    case "propose_manual_charge": {
      if (!p.arena_id) return { ok: false, error: "arena_id_required" };
      const subId = (payload as any).subscription_id;
      if (!subId) return { ok: false, error: "subscription_id_required" };
      const { data, error } = await admin.rpc("arena_generate_billing_cycle", {
        _subscription_id: subId,
      });
      if (error) return { ok: false, error: error.message };
      return {
        ok: true,
        result: { billing_cycle_id: data, proposed_by: "orkym" },
      };
    }

    case "propose_promotion": {
      const { data, error } = await admin
        .from("ad_campaigns")
        .insert({
          tenant_id: p.tenant_id,
          company_id: (payload as any).company_id,
          name: p.title,
          title: p.title,
          kind: (payload as any).kind ?? "feed",
          status: "pending",
          priority: 5,
          budget: (payload as any).budget ?? 0,
          target_type: (payload as any).target_type ?? null,
          target_id: (payload as any).target_id ?? null,
          starts_at:
            (payload as any).starts_at ?? new Date().toISOString(),
          ends_at:
            (payload as any).ends_at ??
            new Date(Date.now() + 30 * 24 * 3600_000).toISOString(),
        })
        .select("id")
        .single();
      if (error) return { ok: false, error: error.message };
      return {
        ok: true,
        result: { ad_campaign_id: data.id, status: "pending" },
      };
    }

    default:
      return { ok: false, error: `unknown_action_type:${p.action_type}` };
  }
}

/**
 * Builds a short human-readable summary from a dispatch result.
 * Used by moodplay-execute-action to populate response_summary.
 */
export function summarizeResult(
  actionType: string,
  result: Record<string, unknown> | undefined,
): string {
  if (!result) return "Ação registrada.";
  switch (actionType) {
    case "create_followup":
    case "open_communication_thread":
    case "recovery_campaign_draft":
      return "📋 Tarefa criada na arena.";
    case "create_reminder":
    case "schedule_operational_review":
      return `⏰ Lembrete agendado.`;
    case "flag_enrollment_attention":
      return "🚩 Inscrição sinalizada para atenção.";
    case "create_occurrence":
      return "📌 Ocorrência registrada.";
    case "propose_manual_charge":
      return "💰 Cobrança gerada.";
    case "propose_promotion":
      return "📣 Campanha proposta (pendente de aprovação).";
    default:
      return "✅ Ação executada.";
  }
}
