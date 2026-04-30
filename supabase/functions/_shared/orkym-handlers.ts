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
          kind: (payload as any).kind ?? "feed_highlight",
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

    // ===========================================================
    // Phase H — Growth Engine handlers (Control Tower 1-click)
    // All flows reuse existing tables; ZERO new business logic.
    // ===========================================================

    case "tournament_boost":
    case "create_campaign":
    case "product_boost":
    case "company_boost": {
      const kindMap: Record<string, string> = {
        tournament_boost: "tournament_highlight",
        product_boost: "marketplace_highlight",
        company_boost: "arena_highlight",
        create_campaign: "feed_highlight",
      };
      const kind = kindMap[p.action_type];
      const targetType =
        p.action_type === "tournament_boost" ? "tournament"
        : p.action_type === "product_boost" ? "product"
        : p.action_type === "company_boost" ? "arena"
        : ((payload as any).target_type ?? null);
      const targetId =
        (payload as any).target_id ?? p.related_entity_id ?? null;

      // company_id fallback: payload → first company of tenant
      let companyId = (payload as any).company_id as string | undefined;
      if (!companyId) {
        const { data: c } = await admin
          .from("companies")
          .select("id")
          .eq("tenant_id", p.tenant_id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        companyId = (c as any)?.id;
      }
      if (!companyId) return { ok: false, error: "no_company_for_tenant" };

      const durationDays = Number((payload as any).duration_days ?? 7);
      const { data, error } = await admin
        .from("ad_campaigns")
        .insert({
          tenant_id: p.tenant_id,
          company_id: companyId,
          name: p.title,
          title: p.title,
          kind,
          status: "active",
          priority: 5,
          budget: Number((payload as any).budget ?? 0),
          target_type: targetType,
          target_id: targetId,
          duration_days: durationDays,
          starts_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + durationDays * 24 * 3600_000).toISOString(),
        })
        .select("id")
        .single();
      if (error) return { ok: false, error: error.message };

      // Best-effort: enqueue audience trigger for tournament_boost
      let queued = 0;
      if (p.action_type === "tournament_boost" && targetId) {
        const dedup = `ct:tb:${targetId}:${new Date().toISOString().slice(0, 10)}`;
        const { error: qErr } = await admin
          .from("orkym_triggers_queue")
          .insert({
            tenant_id: p.tenant_id,
            arena_id: p.arena_id,
            profile_type: "tenant",
            trigger_type: "relevant_tournament",
            entity_type: "tournament",
            entity_id: targetId,
            priority: "medium",
            dedup_key: dedup,
            payload: { source: "control_tower", campaign_id: data.id },
          });
        if (!qErr) queued = 1;
      }
      return {
        ok: true,
        result: { ad_campaign_id: data.id, kind, queued },
      };
    }

    case "fill_idle_slots": {
      if (!p.arena_id) return { ok: false, error: "arena_id_required" };
      const dedup = `ct:fill:${p.arena_id}:${new Date().toISOString().slice(0, 10)}`;
      const { error } = await admin
        .from("orkym_triggers_queue")
        .insert({
          tenant_id: p.tenant_id,
          arena_id: p.arena_id,
          profile_type: "arena",
          trigger_type: "idle_court_slot",
          entity_type: p.related_entity_type,
          entity_id: p.related_entity_id,
          priority: "medium",
          dedup_key: dedup,
          payload: { source: "control_tower", ...payload },
        });
      if (error && !String(error.message).includes("duplicate")) {
        return { ok: false, error: error.message };
      }
      return { ok: true, result: { queued: 1, kind: "idle_court_slot" } };
    }

    case "reactivation_message": {
      const dedup = `ct:react:${p.tenant_id}:${p.arena_id ?? "-"}:${new Date().toISOString().slice(0, 10)}`;
      const { error } = await admin
        .from("orkym_triggers_queue")
        .insert({
          tenant_id: p.tenant_id,
          arena_id: p.arena_id,
          user_id: p.related_entity_type === "athlete" ? p.related_entity_id : null,
          profile_type: "athlete",
          trigger_type: "inactive_athlete",
          entity_type: p.related_entity_type,
          entity_id: p.related_entity_id,
          priority: "medium",
          dedup_key: dedup,
          payload: { source: "control_tower", ...payload },
        });
      if (error && !String(error.message).includes("duplicate")) {
        return { ok: false, error: error.message };
      }
      return { ok: true, result: { queued: 1, kind: "inactive_athlete" } };
    }

    case "send_proactive_message": {
      const triggerType = (payload as any).trigger_type ?? "relevant_tournament";
      const dedup =
        (payload as any).dedup_key ??
        `ct:msg:${p.tenant_id}:${triggerType}:${p.related_entity_id ?? "-"}:${new Date().toISOString().slice(0, 10)}`;
      const { error } = await admin
        .from("orkym_triggers_queue")
        .insert({
          tenant_id: p.tenant_id,
          arena_id: p.arena_id,
          user_id: (payload as any).user_id ?? null,
          profile_type: (payload as any).profile_type ?? "athlete",
          trigger_type: triggerType,
          entity_type: p.related_entity_type,
          entity_id: p.related_entity_id,
          priority: (p.priority as any) ?? "medium",
          dedup_key: dedup,
          payload: { source: "control_tower", ...payload },
        });
      if (error && !String(error.message).includes("duplicate")) {
        return { ok: false, error: error.message };
      }
      return { ok: true, result: { queued: 1, kind: triggerType } };
    }

    case "recommend_product":
    case "upsell_plan": {
      const triggerType =
        p.action_type === "recommend_product" ? "top_product" : "relevant_tournament";
      const dedup = `ct:${p.action_type}:${p.tenant_id}:${p.related_entity_id ?? "-"}:${new Date().toISOString().slice(0, 10)}`;
      const { error } = await admin
        .from("orkym_triggers_queue")
        .insert({
          tenant_id: p.tenant_id,
          arena_id: p.arena_id,
          profile_type: "athlete",
          trigger_type: triggerType,
          entity_type: p.related_entity_type,
          entity_id: p.related_entity_id,
          priority: "medium",
          dedup_key: dedup,
          payload: { source: "control_tower", ...payload },
        });
      if (error && !String(error.message).includes("duplicate")) {
        return { ok: false, error: error.message };
      }
      return { ok: true, result: { queued: 1, kind: triggerType } };
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
    case "tournament_boost":
      return "📣 Torneio em destaque.";
    case "create_campaign":
    case "product_boost":
      return "📣 Campanha ativa.";
    case "company_boost":
      return "📣 Empresa em destaque.";
    case "fill_idle_slots":
      return "🎯 Horários sendo divulgados.";
    case "reactivation_message":
      return "✉️ Reativação iniciada.";
    case "send_proactive_message":
      return "✉️ Mensagem agendada.";
    case "recommend_product":
      return "🛍️ Recomendação enviada.";
    case "upsell_plan":
      return "⬆️ Upgrade oferecido.";
    default:
      return "✅ Ação executada.";
  }
}
