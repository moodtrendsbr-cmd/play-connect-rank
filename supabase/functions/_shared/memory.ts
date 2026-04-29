// Phase 12.8 — Memory helper for ORKYM injection
// Deterministic, no AI. Used by moodplay-execute-action, moodplay-session-step, wa-bridge.

export type MemoryParams = {
  tenant_id?: string | null;
  arena_id?: string | null;
  user_id?: string | null;
  company_id?: string | null;
  organizer_user_id?: string | null;
  profile_type: "athlete" | "arena" | "organizer" | "company" | "tenant";
  context?: string;
  max_items?: number;
};

export type MemoryItem = {
  key: string;
  value: unknown;
  confidence: number;
  source: string;
  memory_type: string;
  last_seen_at: string;
};

export type MemoryContext = {
  entity_type: string;
  entity_id: string;
  memories: MemoryItem[];
  summary: string;
};

const CONTEXT_KEYS: Record<string, string[]> = {
  booking: ["preferred_time_window", "preferred_arena", "preferred_sport"],
  billing: ["chronic_overdue_subscriptions", "recurring_students"],
  tournament: ["preferred_sport", "level_category", "frequent_categories", "frequent_tournament_modality"],
  marketplace: ["top_products"],
  growth: ["top_arenas", "recurring_issues", "low_occupancy_classes"],
  general: [],
};

function resolveEntity(p: MemoryParams): { entity_type: string; entity_id: string | null } {
  switch (p.profile_type) {
    case "athlete":   return { entity_type: "user",      entity_id: p.user_id ?? null };
    case "arena":     return { entity_type: "arena",     entity_id: p.arena_id ?? null };
    case "organizer": return { entity_type: "organizer", entity_id: p.organizer_user_id ?? null };
    case "company":   return { entity_type: "company",   entity_id: p.company_id ?? null };
    case "tenant":    return { entity_type: "tenant",    entity_id: p.tenant_id ?? null };
  }
}

function buildSummary(profile: string, items: MemoryItem[]): string {
  if (items.length === 0) return "Sem padrões identificados ainda.";
  const top = items.slice(0, 3);
  const parts: string[] = [];
  for (const m of top) {
    const v = m.value as Record<string, unknown>;
    if (m.key === "preferred_sport" && v?.value) parts.push(`pratica ${v.value}`);
    else if (m.key === "preferred_time_window" && v?.value) parts.push(`prefere ${v.value}`);
    else if (m.key === "preferred_arena" && v?.arena_id) parts.push(`frequenta arena ${String(v.arena_id).slice(0,8)}`);
    else if (m.key === "top_products") parts.push(`tem produtos campeões cadastrados`);
    else if (m.key === "recurring_students") parts.push(`possui alunos recorrentes`);
    else if (m.key === "chronic_overdue_subscriptions") parts.push(`tem inadimplência crônica em algumas assinaturas`);
    else if (m.key === "frequent_categories") parts.push(`organiza torneios em categorias recorrentes`);
    else if (m.key === "top_arenas") parts.push(`tem arenas líderes na rede`);
    else parts.push(m.key.replace(/_/g, " "));
  }
  const subject = profile === "athlete" ? "Atleta" :
                  profile === "arena" ? "Arena" :
                  profile === "organizer" ? "Organizador" :
                  profile === "company" ? "Empresa" : "Tenant";
  return `${subject} ${parts.join(", ")}.`;
}

// deno-lint-ignore no-explicit-any
export async function getMemoryContext(admin: any, params: MemoryParams): Promise<MemoryContext | null> {
  try {
    const { entity_type, entity_id } = resolveEntity(params);
    if (!entity_id || !params.tenant_id) return null;

    const max = Math.min(Math.max(params.max_items ?? 20, 1), 50);
    const ctxKeys = CONTEXT_KEYS[params.context ?? "general"] ?? [];

    let q = admin
      .from("conversational_memory")
      .select("key,value,confidence,source,memory_type,last_seen_at")
      .eq("entity_type", entity_type)
      .eq("entity_id", entity_id)
      .eq("tenant_id", params.tenant_id)
      .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
      .order("confidence", { ascending: false })
      .order("last_seen_at", { ascending: false })
      .limit(max);

    if (ctxKeys.length > 0) q = q.in("key", ctxKeys);

    const { data, error } = await q;
    if (error || !data) return null;

    const memories = data as MemoryItem[];

    // best-effort audit (non-blocking)
    admin.from("conversational_memory_events").insert({
      tenant_id: params.tenant_id,
      memory_id: null,
      event_type: "used",
      context: { entity_type, entity_id, profile_type: params.profile_type, count: memories.length },
    }).then(() => {}, () => {});

    return {
      entity_type,
      entity_id,
      memories,
      summary: buildSummary(params.profile_type, memories),
    };
  } catch (_e) {
    return null;
  }
}
