/**
 * Control Tower — non-technical copy mappings.
 * Translates internal action_type / alert kinds / opportunity kinds into
 * plain, user-facing language. Never expose underlying action_type or
 * the word "ORKYM"/"IA" in the UI.
 */

export interface ActionCopy {
  /** Button label (verb-led, human). */
  label: string;
  /** Toast/in-card success message ("Estamos ..."). */
  feedback: string;
}

const ACTION_FALLBACK: ActionCopy = {
  label: "Resolver agora",
  feedback: "Estamos cuidando disso",
};

const ACTION_MAP: Record<string, ActionCopy> = {
  tournament_boost: { label: "Divulgar torneio", feedback: "Estamos divulgando seu torneio agora" },
  fill_idle_slots: { label: "Preencher horário", feedback: "Estamos tentando preencher esse horário" },
  reactivation_message: { label: "Trazer cliente de volta", feedback: "Estamos reativando esse cliente" },
  send_proactive_message: { label: "Incentivar atleta", feedback: "Estamos enviando um incentivo" },
  create_campaign: { label: "Aumentar vendas", feedback: "Estamos impulsionando suas vendas" },
  upsell_plan: { label: "Oferecer upgrade", feedback: "Estamos oferecendo um upgrade" },
  company_boost: { label: "Atrair clientes", feedback: "Estamos atraindo mais clientes" },
  product_boost: { label: "Aumentar vendas", feedback: "Estamos impulsionando suas vendas" },
};

export function copyForAction(actionType?: string | null): ActionCopy {
  if (!actionType) return ACTION_FALLBACK;
  return ACTION_MAP[actionType] ?? ACTION_FALLBACK;
}

const ALERT_TITLES: Record<string, string> = {
  low_enrollment_tournament: "Torneio com poucas inscrições",
  revenue_drop: "Queda na receita esta semana",
  budget_exhausted: "Limite mensal atingido",
  idle_court_slot: "Horário ocioso amanhã",
  inactive_athlete: "Cliente sumiu há semanas",
  near_rank_up: "Atleta perto de subir de nível",
};

export function humanizeKind(kind?: string | null, fallback?: string | null): string {
  if (kind && ALERT_TITLES[kind]) return ALERT_TITLES[kind];
  if (fallback && fallback.trim().length > 0) return fallback;
  return "Algo precisa de atenção";
}

export const SUB_SCORE_LABELS: Record<string, string> = {
  enrollment: "Inscrições",
  revenue: "Receita",
  occupancy: "Ocupação",
  engagement: "Engajamento",
};

/** Sub-scores hidden from UI (kept on backend). */
export const HIDDEN_SUB_SCORES = new Set<string>(["orkym_adoption"]);
