import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Pilot seed — idempotent. Creates the minimum entities so a real beta tenant
 * can use the dashboards without a "lock-out" caused by empty critical tables.
 *
 * - 1 arena (linked to caller's tenant if any, owner = caller)
 * - 1 whatsapp_instances (provider='cloud', status='pending_config') marked as seed
 * - 1 whatsapp_bindings tying it to the arena (and tenant if available)
 * - 1 wa_identity for the caller phone if profile has whatsapp
 *
 * NOTHING is labelled "mock". Status `pending_config` is the truth: a real
 * provider must be wired by the operator. No fake messages, no fake revenue.
 *
 * Caller must be authenticated. Returns IDs of created/existing rows.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Resolve caller from JWT
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: auth } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(url, service, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const log: string[] = [];

    // 1) Tenant: prefer tenant where caller is admin/owner; else first tenant
    let tenantId: string | null = null;
    {
      const { data: m } = await admin
        .from("tenant_memberships")
        .select("tenant_id")
        .eq("user_id", user.id)
        .in("role", ["admin", "owner"])
        .limit(1)
        .maybeSingle();
      tenantId = (m as any)?.tenant_id ?? null;
      if (!tenantId) {
        const { data: t } = await admin.from("tenants").select("id").limit(1).maybeSingle();
        tenantId = (t as any)?.id ?? null;
      }
    }
    if (!tenantId) {
      // Create a default pilot tenant
      const { data: t, error } = await admin
        .from("tenants")
        .insert({ name: "Piloto MoodPlay", slug: "piloto-moodplay", owner_user_id: user.id, is_active: true })
        .select("id").single();
      if (error) {
        return new Response(JSON.stringify({ ok: false, step: "tenant", error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      tenantId = t.id;
      log.push(`tenant.created ${tenantId}`);
    } else {
      log.push(`tenant.reused ${tenantId}`);
    }

    // 2) Arena (idempotent by owner_user_id)
    let arenaId: string | null = null;
    {
      const { data: existing } = await admin
        .from("arenas")
        .select("id")
        .eq("owner_user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (existing?.id) {
        arenaId = existing.id;
        log.push(`arena.reused ${arenaId}`);
      } else {
        const slugBase = `piloto-${user.id.slice(0, 8)}`;
        const { data: a, error } = await admin
          .from("arenas")
          .insert({
            owner_user_id: user.id,
            tenant_id: tenantId,
            name: "Arena Piloto",
            slug: slugBase,
            city: "São Paulo",
            state: "SP",
            description: "Arena seed para validação do beta.",
            is_active: true,
          })
          .select("id").single();
        if (error) {
          return new Response(JSON.stringify({ ok: false, step: "arena", error: error.message, log }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        arenaId = a.id;
        log.push(`arena.created ${arenaId}`);
      }
    }

    // 3) WhatsApp instance (status pending_config — real provider must be wired)
    let instanceId: string | null = null;
    {
      const externalId = `pilot-${arenaId}`;
      const { data: existing } = await admin
        .from("whatsapp_instances")
        .select("id")
        .eq("external_instance_id", externalId)
        .limit(1)
        .maybeSingle();
      if (existing?.id) {
        instanceId = existing.id;
        log.push(`wa_instance.reused ${instanceId}`);
      } else {
        const { data: ins, error } = await admin
          .from("whatsapp_instances")
          .insert({
            provider: "cloud",
            display_name: "Piloto · Arena",
            phone_number: "0000000000",
            external_instance_id: externalId,
            status: "pending_config",
            is_global_fallback: false,
            metadata: { is_seed: true, sandbox: true, created_by: user.id },
          })
          .select("id").single();
        if (error) {
          return new Response(JSON.stringify({ ok: false, step: "wa_instance", error: error.message, log }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        instanceId = ins.id;
        log.push(`wa_instance.created ${instanceId}`);
      }
    }

    // 4) WhatsApp binding (arena + tenant)
    {
      const { data: existing } = await admin
        .from("whatsapp_bindings")
        .select("id")
        .eq("instance_id", instanceId!)
        .eq("scope_type", "arena")
        .eq("arena_id", arenaId!)
        .limit(1)
        .maybeSingle();
      if (existing?.id) {
        log.push(`wa_binding.reused ${existing.id}`);
      } else {
        const { data: b, error } = await admin
          .from("whatsapp_bindings")
          .insert({
            instance_id: instanceId!,
            scope_type: "arena",
            arena_id: arenaId!,
            tenant_id: tenantId,
            is_default: true,
            priority: 10,
          })
          .select("id").single();
        if (error) {
          // not fatal; some columns may differ
          log.push(`wa_binding.error ${error.message}`);
        } else {
          log.push(`wa_binding.created ${b.id}`);
        }
      }
    }

    // 5) wa_identity for caller (best-effort)
    try {
      const { data: prof } = await admin
        .from("profiles")
        .select("whatsapp")
        .eq("user_id", user.id)
        .maybeSingle();
      const phone = (prof as any)?.whatsapp ? String((prof as any).whatsapp).replace(/\D/g, "") : null;
      if (phone) {
        const { data: existing } = await admin
          .from("wa_identities")
          .select("id")
          .eq("wa_phone", phone)
          .limit(1)
          .maybeSingle();
        if (!existing) {
          const { error } = await admin.from("wa_identities").insert({
            wa_phone: phone,
            user_id: user.id,
            tenant_id: tenantId,
            default_arena_id: arenaId,
            verified_at: new Date().toISOString(),
            metadata: { is_seed: true },
          });
          if (error) log.push(`wa_identity.error ${error.message}`);
          else log.push(`wa_identity.created ${phone}`);
        } else {
          log.push(`wa_identity.reused`);
        }
      } else {
        log.push("wa_identity.skipped no_phone");
      }
    } catch (e) {
      log.push(`wa_identity.exception ${(e as Error).message}`);
    }

    return new Response(JSON.stringify({
      ok: true,
      tenant_id: tenantId,
      arena_id: arenaId,
      instance_id: instanceId,
      log,
      message: "Piloto pronto. WhatsApp criado em status pending_config — conecte na tela /arena/connect-whatsapp.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
