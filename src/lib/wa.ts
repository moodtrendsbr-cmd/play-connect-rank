import { supabase } from "@/integrations/supabase/client";

const FALLBACK_NUMBER = "5511999999999";

export const getWaNumber = (): string => {
  const raw = (import.meta.env.VITE_ORKYM_WHATSAPP as string | undefined) || "";
  const digits = raw.replace(/\D/g, "");
  return digits || FALLBACK_NUMBER;
};

export const isWaConfigured = (): boolean =>
  Boolean(import.meta.env.VITE_ORKYM_WHATSAPP);

export interface PrepareCommandInput {
  input_text: string;
  profile_type: string;
  tenant_id?: string | null;
  arena_id?: string | null;
  parsed_intent?: Record<string, unknown> | null;
}

/**
 * Pre-creates a conversational_commands row for a dashboard CTA.
 * Returns a 6-char shortcode that wa-bridge will resolve when the
 * user actually sends the WhatsApp message.
 */
export async function prepareCommand(
  input: PrepareCommandInput,
): Promise<{ command_id: string; shortcode: string } | null> {
  try {
    const { data, error } = await supabase.functions.invoke("wa-prepare-command", {
      body: input,
    });
    if (error || !data?.shortcode) return null;
    return data as { command_id: string; shortcode: string };
  } catch {
    return null;
  }
}

export interface CreateQrTokenInput {
  intent: string;
  payload?: Record<string, unknown>;
  arena_id?: string | null;
  tenant_id?: string | null;
  ttl_minutes?: number;
}

export async function createQrToken(
  input: CreateQrTokenInput,
): Promise<{ token: string; short_token: string; expires_at: string } | null> {
  const { data, error } = await supabase.rpc("wa_create_qr_token", {
    _intent: input.intent,
    _payload: (input.payload ?? {}) as never,
    _arena_id: input.arena_id ?? null,
    _tenant_id: input.tenant_id ?? null,
    _ttl_minutes: input.ttl_minutes ?? 30,
  });
  if (error || !(data as any)?.success) return null;
  return data as { token: string; short_token: string; expires_at: string };
}

export async function registerWaIdentity(
  phone: string,
  profile: string,
): Promise<{ phone: string; verification_code: string } | null> {
  const { data, error } = await supabase.rpc("wa_register_identity", {
    _phone: phone,
    _profile: profile,
  });
  if (error || !(data as any)?.success) return null;
  return data as { phone: string; verification_code: string };
}

export async function verifyWaIdentity(
  phone: string,
  code: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("wa_verify_identity", {
    _phone: phone,
    _code: code,
  });
  if (error) return false;
  return Boolean((data as any)?.success);
}

export function buildWaUrl(command: string, suffix?: string): string {
  const text = suffix ? `${command} ${suffix}` : command;
  return `https://wa.me/${getWaNumber()}?text=${encodeURIComponent(text)}`;
}

export interface ResolveInstanceInput {
  tenant_id?: string | null;
  arena_id?: string | null;
  profile_type?: string | null;
  organizer_user_id?: string | null;
  company_id?: string | null;
}

export interface ResolvedInstance {
  success: boolean;
  source?: string;
  instance_id?: string;
  provider?: string;
  phone_number?: string;
  display_name?: string;
  error?: string;
}

export async function resolveInstance(
  input: ResolveInstanceInput,
): Promise<ResolvedInstance | null> {
  const { data, error } = await supabase.rpc("resolve_whatsapp_instance", {
    _tenant_id: input.tenant_id ?? null,
    _arena_id: input.arena_id ?? null,
    _profile_type: input.profile_type ?? null,
    _organizer_user_id: input.organizer_user_id ?? null,
    _company_id: input.company_id ?? null,
  });
  if (error) return null;
  return data as ResolvedInstance;
}

export type ProactiveCategory = "billing" | "retention" | "marketing" | "operations";

export async function setProactiveOptIn(
  userId: string,
  category: ProactiveCategory,
  optedIn: boolean,
  tenantId?: string | null,
): Promise<boolean> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("orkym_proactive_eligibility")
    .upsert(
      {
        user_id: userId,
        tenant_id: tenantId ?? null,
        category,
        channel: "whatsapp",
        opted_in: optedIn,
        opted_at: optedIn ? now : null,
        opted_out_at: optedIn ? null : now,
      },
      { onConflict: "user_id,tenant_id,category,channel" },
    );
  return !error;
}

export interface SendOutboundInput {
  to_phone: string;
  tenant_id?: string | null;
  arena_id?: string | null;
  user_id?: string | null;
  message_type?: "text" | "template" | "interactive";
  body?: string;
  template_name?: string;
  template_vars?: Record<string, unknown>;
  category?: ProactiveCategory;
  correlation_id?: string;
  initiated_by?: "orkym" | "system" | "manual";
}

/** Admin/test helper — server-to-server call requires HMAC; client-side use is for mock/admin tooling. */
export async function sendOutbound(input: SendOutboundInput) {
  const { data, error } = await supabase.functions.invoke("wa-send-message", {
    body: input,
  });
  if (error) return { ok: false, error: error.message };
  return data;
}

