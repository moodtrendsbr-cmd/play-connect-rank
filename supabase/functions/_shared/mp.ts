// Shared Mercado Pago helpers — credenciais, assinatura, idempotência,
// roteamento de pagamentos e upsert em financial_transactions.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export function getServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/** Verify MP webhook signature (HMAC-SHA256). Returns true if valid OR if secret unset (compat). */
export async function verifyMpSignature(req: Request, dataId: string): Promise<boolean> {
  const secret = Deno.env.get("MP_WEBHOOK_SECRET");
  if (!secret) {
    console.warn("[mp] MP_WEBHOOK_SECRET not configured — signature verification skipped (compat)");
    return true;
  }
  const sigHeader = req.headers.get("x-signature");
  const reqId = req.headers.get("x-request-id");
  if (!sigHeader || !reqId) {
    console.warn("[mp] signature headers missing");
    return false;
  }
  const parts = Object.fromEntries(
    sigHeader.split(",").map((p) => p.trim().split("=").map((s) => s.trim())) as [string, string][]
  );
  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${reqId};ts:${ts};`;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === v1;
}

/** Register webhook event idempotently. Returns true if first time, false if replay. */
export async function recordWebhookEvent(
  supabase: SupabaseClient,
  provider: string,
  eventId: string,
  payload: unknown,
): Promise<boolean> {
  const { error } = await supabase
    .from("webhook_events")
    .insert({ provider, event_id: String(eventId), payload, processed_at: new Date().toISOString() });
  if (error) {
    if ((error as any).code === "23505") return false;
    console.error("[mp] recordWebhookEvent error:", error);
    return false;
  }
  return true;
}

export async function getMpPayment(paymentId: string | number): Promise<any> {
  const token = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
  if (!token) throw new Error("MERCADO_PAGO_ACCESS_TOKEN not configured");
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`MP fetch error [${res.status}]: ${JSON.stringify(data)}`);
  return data;
}

export async function getMpPreapproval(preapprovalId: string): Promise<any> {
  const token = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
  if (!token) throw new Error("MERCADO_PAGO_ACCESS_TOKEN not configured");
  const res = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`MP preapproval fetch error [${res.status}]: ${JSON.stringify(data)}`);
  return data;
}

/**
 * Resolve collector_id por prioridade: payment_accounts → arenas.mp_collector_id → profiles.mp_collector_id.
 */
export async function resolveCollectorId(
  supabase: SupabaseClient,
  opts: { tenantId?: string | null; arenaId?: string | null; organizerId?: string | null },
): Promise<string | null> {
  if (opts.arenaId) {
    const { data } = await supabase
      .from("payment_accounts")
      .select("external_id")
      .eq("provider", "mercadopago").eq("status", "active").eq("arena_id", opts.arenaId)
      .maybeSingle();
    if (data?.external_id) return data.external_id;
  }
  if (opts.tenantId) {
    const { data } = await supabase
      .from("payment_accounts")
      .select("external_id")
      .eq("provider", "mercadopago").eq("status", "active").eq("tenant_id", opts.tenantId)
      .is("arena_id", null).maybeSingle();
    if (data?.external_id) return data.external_id;
  }
  if (opts.arenaId) {
    const { data } = await supabase
      .from("arenas").select("mp_collector_id, mp_connected").eq("id", opts.arenaId).maybeSingle();
    if (data?.mp_connected && data?.mp_collector_id) return data.mp_collector_id;
  }
  if (opts.organizerId) {
    const { data } = await supabase
      .from("profiles").select("mp_collector_id").eq("user_id", opts.organizerId).maybeSingle();
    return data?.mp_collector_id ?? null;
  }
  return null;
}

/** Mapeia status MP → financial_transactions.status canônico. */
export function mapMpStatus(mpStatus: string): "pending" | "paid" | "failed" | "cancelled" | "refunded" {
  switch (mpStatus) {
    case "approved": return "paid";
    case "pending":
    case "in_process":
    case "authorized": return "pending";
    case "rejected":   return "failed";
    case "cancelled":  return "cancelled";
    case "refunded":
    case "charged_back": return "refunded";
    default: return "pending";
  }
}

/** Parse external_reference suportando JSON novo e legados (array de enrollment ids ou string). */
export function parseExternalReference(raw: string | null | undefined): {
  source_type: string;
  source_id?: string;
  tenant_id?: string;
  arena_id?: string;
  organizer_id?: string;
  enrollment_ids?: string[];
  tournament_id?: string;
  campaign_id?: string;
  has_split?: boolean;
} | null {
  if (!raw) return null;
  try {
    const ref = JSON.parse(raw);
    if (Array.isArray(ref)) {
      return { source_type: "enrollment", enrollment_ids: ref };
    }
    if (ref && typeof ref === "object") {
      if (ref.source_type) return ref;
      if (Array.isArray(ref.enrollment_ids)) {
        return { source_type: "enrollment", ...ref };
      }
    }
    return null;
  } catch {
    return { source_type: "enrollment", enrollment_ids: [String(raw)] };
  }
}

/**
 * Núcleo: dado um paymentId do MP, busca, mapeia, faz upsert em financial_transactions.
 * Triggers do banco (trg_apply_payment_side_effects, trg_boost_activate_on_paid,
 * trg_featured_activate_on_paid, trg_growth_record_boost_spend, etc) cuidam dos
 * side-effects específicos (confirmar booking, ativar boost, etc).
 */
export async function processMpPayment(
  supabase: SupabaseClient,
  paymentId: string | number,
): Promise<{ ok: boolean; status: string; source_type: string | null; tx_id?: string; reason?: string }> {
  const payment = await getMpPayment(paymentId);
  const ref = parseExternalReference(payment.external_reference);
  if (!ref) {
    console.warn("[mp] payment without parseable external_reference:", paymentId, payment.external_reference);
    return { ok: false, status: payment.status, source_type: null, reason: "no_external_reference" };
  }

  const status = mapMpStatus(payment.status);
  const sourceType = ref.source_type;
  // source_id: para enrollment usa o primeiro id da lista (legado), caso contrário usa source_id explícito.
  const sourceId = ref.source_id
    ?? (sourceType === "enrollment" ? ref.enrollment_ids?.[0] : undefined);

  if (!sourceId) {
    console.warn("[mp] missing source_id for", sourceType, paymentId);
    return { ok: false, status, source_type: sourceType, reason: "missing_source_id" };
  }

  // tenant_id é obrigatório em financial_transactions — tentar resolver via fonte.
  let tenantId: string | null = ref.tenant_id ?? null;
  let arenaId: string | null = ref.arena_id ?? null;
  let organizerId: string | null = ref.organizer_id ?? null;

  if (!tenantId) {
    if (sourceType === "booking") {
      const { data } = await supabase.from("bookings").select("tenant_id, arena_id, user_id").eq("id", sourceId).maybeSingle();
      tenantId = data?.tenant_id ?? null;
      arenaId = arenaId ?? data?.arena_id ?? null;
    } else if (sourceType === "enrollment") {
      const enrollmentId = ref.enrollment_ids?.[0] ?? sourceId;
      const { data } = await supabase
        .from("enrollments").select("tournament:tournaments(tenant_id, organizer_id)")
        .eq("id", enrollmentId).maybeSingle();
      tenantId = (data as any)?.tournament?.tenant_id ?? null;
      organizerId = organizerId ?? (data as any)?.tournament?.organizer_id ?? null;
    } else if (sourceType === "subscription") {
      const { data } = await supabase.from("subscriptions").select("tenant_id, arena_id, company_id").eq("id", sourceId).maybeSingle();
      tenantId = data?.tenant_id ?? null;
      arenaId = arenaId ?? data?.arena_id ?? null;
    } else if (sourceType === "withdrawal") {
      const { data } = await supabase.from("withdrawal_requests").select("organizer_id").eq("id", sourceId).maybeSingle();
      organizerId = organizerId ?? data?.organizer_id ?? null;
      // tentar achar um tenant default via profile
      if (organizerId && !tenantId) {
        const { data: prof } = await supabase.from("profiles").select("tenant_id").eq("user_id", organizerId).maybeSingle();
        tenantId = (prof as any)?.tenant_id ?? null;
      }
    } else if (sourceType === "boost" || sourceType === "featured") {
      // tenta resolver via campaign/listing
      const tbl = sourceType === "boost" ? "ad_campaigns" : "featured_listings";
      const { data } = await supabase.from(tbl).select("tenant_id, arena_id").eq("id", sourceId).maybeSingle();
      tenantId = data?.tenant_id ?? null;
      arenaId = arenaId ?? data?.arena_id ?? null;
    } else if (sourceType === "marketplace_order") {
      const { data } = await supabase.from("marketplace_orders").select("tenant_id, buyer_id").eq("id", sourceId).maybeSingle();
      tenantId = data?.tenant_id ?? null;
    }
  }

  if (!tenantId) {
    console.error("[mp] cannot resolve tenant_id for", sourceType, sourceId);
    return { ok: false, status, source_type: sourceType, reason: "no_tenant" };
  }

  const row = {
    tenant_id: tenantId,
    arena_id: arenaId,
    organizer_id: organizerId,
    source_type: sourceType,
    source_id: sourceId,
    total_amount: Number(payment.transaction_amount ?? 0),
    currency: payment.currency_id ?? "BRL",
    status,
    payment_provider: "mercadopago",
    payment_reference: String(payment.id),
    paid_at: status === "paid" ? (payment.date_approved ?? new Date().toISOString()) : null,
    refunded_amount: status === "refunded" ? Number(payment.transaction_amount ?? 0) : 0,
    refunded_at: status === "refunded" ? new Date().toISOString() : null,
    cancellation_reason: status === "failed" ? (payment.status_detail ?? null) : null,
    metadata: {
      mp_payment_id: payment.id,
      mp_status: payment.status,
      mp_status_detail: payment.status_detail,
      payment_method_id: payment.payment_method_id,
      external_reference: ref,
    },
  };

  const { data: existing } = await supabase
    .from("financial_transactions")
    .select("id, status")
    .eq("payment_provider", "mercadopago")
    .eq("payment_reference", String(payment.id))
    .maybeSingle();

  if (existing) {
    const { error: updErr } = await supabase
      .from("financial_transactions")
      .update({
        status: row.status,
        paid_at: row.paid_at ?? undefined,
        refunded_amount: row.refunded_amount,
        refunded_at: row.refunded_at,
        cancellation_reason: row.cancellation_reason,
        metadata: row.metadata,
      })
      .eq("id", existing.id);
    if (updErr) {
      console.error("[mp] update fin_tx error:", updErr);
      return { ok: false, status, source_type: sourceType, reason: updErr.message };
    }
    return { ok: true, status, source_type: sourceType, tx_id: existing.id };
  }

  const { data: ins, error: insErr } = await supabase
    .from("financial_transactions")
    .insert(row).select("id").single();
  if (insErr) {
    console.error("[mp] insert fin_tx error:", insErr);
    return { ok: false, status, source_type: sourceType, reason: insErr.message };
  }

  // Para enrollments legados (lista), também marcar todos como paid (compat com fluxo antigo).
  if (status === "paid" && sourceType === "enrollment" && ref.enrollment_ids?.length) {
    for (const eid of ref.enrollment_ids) {
      await supabase.from("enrollments")
        .update({ status: "paid", payment_id: String(payment.id) })
        .eq("id", eid);
    }
  }

  return { ok: true, status, source_type: sourceType, tx_id: ins.id };
}
