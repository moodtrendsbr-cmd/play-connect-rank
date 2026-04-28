// ============================================================
// Phase 12.6 — WhatsApp provider dispatchers (Twilio / Meta / Evolution)
// ============================================================
//
// Each dispatcher receives normalized input and returns a normalized
// outcome. Credentials come from the instance row (override) or fall
// back to global Deno env secrets. No business logic — pure I/O.

export interface DispatchInput {
  provider: string;
  to_phone: string;
  message_type: "text" | "template" | "interactive";
  body?: string;
  template_name?: string;
  template_vars?: Record<string, unknown>;
  instance: {
    external_instance_id?: string | null;
    phone_number?: string | null;
    outbound_endpoint?: string | null;
    outbound_credentials?: Record<string, unknown> | null;
  };
}

export interface DispatchOutcome {
  ok: boolean;
  external_message_id?: string;
  failure_reason?: string;
  raw?: unknown;
}

const env = (k: string) => Deno.env.get(k) ?? "";
const trunc = (s: string, n = 240) => (s.length > n ? s.slice(0, n) + "…" : s);

// ----------------------------------------------------------------
// Twilio
// ----------------------------------------------------------------
async function dispatchTwilio(input: DispatchInput): Promise<DispatchOutcome> {
  const creds = (input.instance.outbound_credentials ?? {}) as Record<string, string>;
  const sid = creds.account_sid || env("WA_TWILIO_ACCOUNT_SID");
  const token = creds.auth_token || env("WA_TWILIO_AUTH_TOKEN");
  const from = creds.from || input.instance.phone_number || env("WA_TWILIO_FROM");
  if (!sid || !token || !from) {
    return { ok: false, failure_reason: "twilio_credentials_missing" };
  }

  const params = new URLSearchParams();
  params.set("To", `whatsapp:+${input.to_phone}`);
  params.set("From", from.startsWith("whatsapp:") ? from : `whatsapp:+${from.replace(/\D/g, "")}`);

  if (input.message_type === "template" && input.template_name) {
    // Twilio uses ContentSid (a template SID stored in console)
    params.set("ContentSid", input.template_name);
    if (input.template_vars) {
      params.set("ContentVariables", JSON.stringify(input.template_vars));
    }
  } else {
    if (!input.body) return { ok: false, failure_reason: "body_required" };
    params.set("Body", input.body);
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth = btoa(`${sid}:${token}`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        failure_reason: trunc(`twilio_${res.status}:${data?.code ?? ""}:${data?.message ?? ""}`),
        raw: data,
      };
    }
    return { ok: true, external_message_id: String(data?.sid ?? ""), raw: data };
  } catch (e) {
    return { ok: false, failure_reason: trunc(`twilio_network:${(e as Error).message}`) };
  }
}

// ----------------------------------------------------------------
// Meta Cloud API
// ----------------------------------------------------------------
async function dispatchMeta(input: DispatchInput): Promise<DispatchOutcome> {
  const creds = (input.instance.outbound_credentials ?? {}) as Record<string, string>;
  const token = creds.access_token || env("WA_META_TOKEN");
  const phoneId = creds.phone_number_id || input.instance.external_instance_id || env("WA_META_PHONE_NUMBER_ID");
  if (!token || !phoneId) {
    return { ok: false, failure_reason: "meta_credentials_missing" };
  }

  let payload: Record<string, unknown>;
  if (input.message_type === "template" && input.template_name) {
    payload = {
      messaging_product: "whatsapp",
      to: input.to_phone,
      type: "template",
      template: {
        name: input.template_name,
        language: { code: (input.template_vars?.language as string) ?? "pt_BR" },
        components: input.template_vars?.components ?? [],
      },
    };
  } else {
    if (!input.body) return { ok: false, failure_reason: "body_required" };
    payload = {
      messaging_product: "whatsapp",
      to: input.to_phone,
      type: "text",
      text: { body: input.body, preview_url: false },
    };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        failure_reason: trunc(`meta_${res.status}:${data?.error?.code ?? ""}:${data?.error?.message ?? ""}`),
        raw: data,
      };
    }
    const id = (data?.messages?.[0]?.id as string) ?? "";
    return { ok: true, external_message_id: id, raw: data };
  } catch (e) {
    return { ok: false, failure_reason: trunc(`meta_network:${(e as Error).message}`) };
  }
}

// ----------------------------------------------------------------
// Evolution API
// ----------------------------------------------------------------
async function dispatchEvolution(input: DispatchInput): Promise<DispatchOutcome> {
  const creds = (input.instance.outbound_credentials ?? {}) as Record<string, string>;
  const baseUrl = creds.base_url || input.instance.outbound_endpoint || env("WA_EVOLUTION_BASE_URL");
  const apiKey = creds.api_key || env("WA_EVOLUTION_API_KEY");
  const instance = creds.instance_name || input.instance.external_instance_id || "default";
  if (!baseUrl || !apiKey) {
    return { ok: false, failure_reason: "evolution_credentials_missing" };
  }

  const isTemplate = input.message_type === "template" && input.template_name;
  const path = isTemplate ? `/message/sendTemplate/${instance}` : `/message/sendText/${instance}`;
  const payload = isTemplate
    ? { number: input.to_phone, template: { name: input.template_name, params: input.template_vars ?? {} } }
    : { number: input.to_phone, text: input.body ?? "" };

  if (!isTemplate && !input.body) return { ok: false, failure_reason: "body_required" };

  try {
    const res = await fetch(baseUrl.replace(/\/$/, "") + path, {
      method: "POST",
      headers: { apikey: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        failure_reason: trunc(`evolution_${res.status}:${data?.message ?? ""}`),
        raw: data,
      };
    }
    const id = (data?.key?.id as string) ?? (data?.id as string) ?? "";
    return { ok: true, external_message_id: id, raw: data };
  } catch (e) {
    return { ok: false, failure_reason: trunc(`evolution_network:${(e as Error).message}`) };
  }
}

// ----------------------------------------------------------------
// Mock (dev/log-only)
// ----------------------------------------------------------------
function dispatchMock(input: DispatchInput): DispatchOutcome {
  console.log(`[wa MOCK] provider=${input.provider} to=${input.to_phone} body="${input.body ?? input.template_name}"`);
  return { ok: true, external_message_id: `mock_${crypto.randomUUID().slice(0, 8)}` };
}

// ----------------------------------------------------------------
// Public entry
// ----------------------------------------------------------------
export async function dispatchWhatsApp(input: DispatchInput): Promise<DispatchOutcome> {
  switch ((input.provider || "").toLowerCase()) {
    case "twilio": return await dispatchTwilio(input);
    case "meta": return await dispatchMeta(input);
    case "evolution": return await dispatchEvolution(input);
    case "mock": return dispatchMock(input);
    default:
      return { ok: false, failure_reason: `unsupported_provider:${input.provider}` };
  }
}

// ----------------------------------------------------------------
// Webhook signature helpers (Phase 12.6.2)
// ----------------------------------------------------------------
export async function verifyMetaSignature(
  rawBody: string, signature: string | null, appSecret: string,
): Promise<boolean> {
  if (!signature || !appSecret) return false;
  const expected = signature.startsWith("sha256=") ? signature.slice(7) : signature;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(appSecret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const hex = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hex.length !== expected.length) return false;
  let r = 0;
  for (let i = 0; i < hex.length; i++) r |= hex.charCodeAt(i) ^ expected.charCodeAt(i);
  return r === 0;
}

// Status precedence for idempotent updates: never downgrade.
const STATUS_RANK: Record<string, number> = {
  queued: 0, sent: 1, delivered: 2, read: 3, failed: 4,
};
export function shouldUpdateStatus(current: string | null, next: string): boolean {
  if (!current) return true;
  if (next === "failed") return true; // failures always recorded
  const c = STATUS_RANK[current] ?? 0;
  const n = STATUS_RANK[next] ?? 0;
  return n > c;
}
