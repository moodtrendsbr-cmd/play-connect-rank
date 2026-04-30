// Deterministic proactive message templates (Phase H WA loop).
// One observation + one suggestion + one question. No AI, no jargon.
// Each template maps a trigger_type to (a) the human message and
// (b) the action_type that gets executed if the user replies affirmatively.

export type ProactiveActionType =
  | "tournament_boost"
  | "fill_idle_slots"
  | "reactivation_message"
  | "create_campaign"
  | "product_boost"
  | "company_boost"
  | "send_proactive_message";

export interface PendingAction {
  action_type: ProactiveActionType;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown>;
  scope: { type: "tenant" | "arena" | "company"; id: string };
}

export interface TemplateContext {
  trigger_type: string;
  profile_type: string;
  tenant_id: string;
  arena_id: string | null;
  user_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown>;
}

export interface ProactiveTemplate {
  message: string;
  pending: PendingAction;
}

function pickName(p: Record<string, unknown>, fallback: string): string {
  const candidates = [p.name, p.title, p.tournament_name, p.product_name, p.label];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return fallback;
}

function pickWhen(p: Record<string, unknown>): string {
  const w = p.when || p.slot_label || p.day_label || p.period_label;
  if (typeof w === "string" && w.trim()) return w.trim();
  return "essa semana";
}

function pickNumber(p: Record<string, unknown>, key: string, fallback: number): number {
  const v = (p as any)[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function defaultScope(ctx: TemplateContext): PendingAction["scope"] {
  if (ctx.arena_id) return { type: "arena", id: ctx.arena_id };
  return { type: "tenant", id: ctx.tenant_id };
}

/**
 * Build a proactive template (deterministic). Returns null when the trigger
 * cannot produce a clear 1-question message — caller should skip the trigger.
 */
export function buildProactiveTemplate(ctx: TemplateContext): ProactiveTemplate | null {
  const p = ctx.payload || {};
  const scope = defaultScope(ctx);

  switch (ctx.trigger_type) {
    case "tournament_low_enrollment":
    case "low_enrollment": {
      const name = pickName(p, "seu torneio");
      return {
        message:
          `Percebi que ${ctx.trigger_type === "low_enrollment" ? "o torneio" : "seu torneio"} "${name}" ainda está com poucas inscrições. ` +
          `Posso ajudar a atrair mais jogadores agora. Quer que eu faça isso?`,
        pending: {
          action_type: "tournament_boost",
          entity_type: ctx.entity_type ?? "tournament",
          entity_id: ctx.entity_id,
          payload: { ...p, source: "proactive_wa" },
          scope,
        },
      };
    }

    case "idle_court_slot":
    case "idle_slot": {
      const when = pickWhen(p);
      return {
        message:
          `Você tem horário disponível ${when} ainda sem reservas. ` +
          `Posso divulgar para quem costuma jogar nesse dia. Quer que eu faça?`,
        pending: {
          action_type: "fill_idle_slots",
          entity_type: ctx.entity_type ?? "court_slot",
          entity_id: ctx.entity_id,
          payload: { ...p, source: "proactive_wa" },
          scope,
        },
      };
    }

    case "inactive_athlete": {
      const name = pickName(p, "Um aluno seu");
      const days = Math.max(1, Math.round(pickNumber(p, "days_inactive", 14)));
      return {
        message:
          `${name} não aparece há ${days} dias. ` +
          `Posso enviar um convite pra ele(a) voltar. Quer?`,
        pending: {
          action_type: "reactivation_message",
          entity_type: ctx.entity_type ?? "user",
          entity_id: ctx.entity_id,
          payload: { ...p, source: "proactive_wa" },
          scope,
        },
      };
    }

    case "low_message_performance":
    case "low_campaign_performance": {
      return {
        message:
          `Sua última campanha está com baixa resposta. ` +
          `Posso impulsionar agora pra mais gente ver. Quer?`,
        pending: {
          action_type: "create_campaign",
          entity_type: ctx.entity_type ?? "campaign",
          entity_id: ctx.entity_id,
          payload: { ...p, source: "proactive_wa", reason: "low_performance" },
          scope,
        },
      };
    }

    case "top_product": {
      const name = pickName(p, "seu produto");
      return {
        message:
          `Seu produto "${name}" está vendendo bem. ` +
          `Posso divulgar pra ampliar as vendas. Quer?`,
        pending: {
          action_type: "product_boost",
          entity_type: ctx.entity_type ?? "product",
          entity_id: ctx.entity_id,
          payload: { ...p, source: "proactive_wa" },
          scope,
        },
      };
    }

    case "revenue_drop": {
      const pct = Math.max(1, Math.round(pickNumber(p, "drop_pct", 10)));
      return {
        message:
          `Sua receita esta semana caiu cerca de ${pct}%. ` +
          `Posso ativar uma divulgação pra recuperar. Quer?`,
        pending: {
          action_type: "create_campaign",
          entity_type: ctx.entity_type ?? null,
          entity_id: ctx.entity_id,
          payload: { ...p, source: "proactive_wa", reason: "revenue_drop" },
          scope,
        },
      };
    }

    case "relevant_tournament": {
      const name = pickName(p, "um novo torneio");
      return {
        message:
          `Tem um torneio que combina com você: ${name}. ` +
          `Quer que eu te mande o link pra se inscrever?`,
        pending: {
          action_type: "send_proactive_message",
          entity_type: ctx.entity_type ?? "tournament",
          entity_id: ctx.entity_id,
          payload: { ...p, source: "proactive_wa", purpose: "share_link" },
          scope,
        },
      };
    }

    case "near_rank_up": {
      const pts = Math.max(1, Math.round(pickNumber(p, "points_to_next", 30)));
      return {
        message:
          `Você está bem perto de subir no ranking. Faltam só ${pts} pontos. ` +
          `Quer dicas rápidas pra acelerar?`,
        pending: {
          action_type: "send_proactive_message",
          entity_type: ctx.entity_type ?? "user",
          entity_id: ctx.entity_id,
          payload: { ...p, source: "proactive_wa", purpose: "tips" },
          scope,
        },
      };
    }

    // Trigger types that we explicitly don't want to render as
    // 1-action proactive prompts (billing, transactional notices, etc.)
    default:
      return null;
  }
}
