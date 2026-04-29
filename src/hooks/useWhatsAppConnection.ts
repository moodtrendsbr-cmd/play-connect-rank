import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type WaScopeType = "tenant" | "arena" | "organizer" | "company";

export interface WaConnectionScope {
  scope_type: WaScopeType;
  tenant_id?: string | null;
  arena_id?: string | null;
  organizer_user_id?: string | null;
  company_id?: string | null;
}

export interface WaConnectionState {
  loading: boolean;
  connected: boolean;
  status: "active" | "pending" | "paused" | "revoked" | "not_connected" | string;
  instance: {
    id: string;
    display_name: string | null;
    phone_number: string;
    provider: string;
    status: string;
    external_instance_id: string | null;
  } | null;
  refresh: () => Promise<void>;
}

export function useWhatsAppConnectionStatus(scope: WaConnectionScope | null): WaConnectionState {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("not_connected");
  const [instance, setInstance] = useState<WaConnectionState["instance"]>(null);

  const fetchStatus = useCallback(async () => {
    if (!scope?.scope_type) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let q = supabase
        .from("whatsapp_bindings")
        .select(
          "instance_id, whatsapp_instances!inner(id, display_name, phone_number, provider, status, external_instance_id)",
        )
        .eq("scope_type", scope.scope_type)
        .order("priority", { ascending: true })
        .limit(1);
      if (scope.tenant_id) q = q.eq("tenant_id", scope.tenant_id);
      if (scope.arena_id) q = q.eq("arena_id", scope.arena_id);
      if (scope.organizer_user_id) q = q.eq("organizer_user_id", scope.organizer_user_id);
      if (scope.company_id) q = q.eq("company_id", scope.company_id);

      const { data } = await q.maybeSingle();
      const inst = (data as any)?.whatsapp_instances ?? null;
      if (inst) {
        setInstance(inst);
        setStatus(inst.status || "pending");
      } else {
        setInstance(null);
        setStatus("not_connected");
      }
    } finally {
      setLoading(false);
    }
  }, [
    scope?.scope_type,
    scope?.tenant_id,
    scope?.arena_id,
    scope?.organizer_user_id,
    scope?.company_id,
  ]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    loading,
    connected: status === "active",
    status,
    instance,
    refresh: fetchStatus,
  };
}

export interface OrkymWaCallResult {
  ok: boolean;
  degraded?: boolean;
  status?: string;
  qr_code?: string | null;
  pairing_code?: string | null;
  instance?: WaConnectionState["instance"];
  error?: string;
  message?: string;
}

export async function callOrkymWaConnection(
  action: "start_connection" | "get_status" | "disconnect" | "reconnect" | "sync_instance",
  scope: WaConnectionScope,
): Promise<OrkymWaCallResult> {
  try {
    const { data, error } = await supabase.functions.invoke("orkym-whatsapp-connection", {
      body: { action, ...scope },
    });
    if (error) return { ok: false, error: error.message };
    return data as OrkymWaCallResult;
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
