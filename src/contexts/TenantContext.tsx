import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  is_active: boolean;
  branding: Record<string, any>;
}

export interface TenantSettings {
  tenant_id: string;
  display_name: string;
  legal_name: string | null;
  support_email: string | null;
  support_phone: string | null;
  primary_color: string;
  secondary_color: string;
  logo_url: string | null;
  favicon_url: string | null;
  default_locale: string;
  timezone: string;
  status: string;
  metadata: Record<string, any>;
}

export interface TenantMembership {
  tenant_id: string;
  user_id: string;
  role: "owner" | "admin" | "staff" | "member";
}

interface TenantContextType {
  tenant: Tenant | null;
  settings: TenantSettings | null;
  memberships: TenantMembership[];
  isLoading: boolean;
  switchTenant: (slug: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const DEFAULT_TENANT_SLUG = "moodplay";
const STORAGE_KEY = "moodplay.tenant.slug";

const TenantContext = createContext<TenantContextType>({
  tenant: null,
  settings: null,
  memberships: [],
  isLoading: true,
  switchTenant: async () => {},
  refresh: async () => {},
});

export const useTenantContext = () => useContext(TenantContext);

function getCurrentHost(): string | null {
  if (typeof window === "undefined") return null;
  return window.location.hostname;
}

function detectInitialSlug(): string {
  if (typeof window === "undefined") return DEFAULT_TENANT_SLUG;

  // 1. Query param ?tenant=foo
  const url = new URL(window.location.href);
  const qp = url.searchParams.get("tenant");
  if (qp) return qp;

  // 2. Subdomain (foo.moodplay.app — ignore preview/lovable hosts)
  const host = window.location.hostname;
  const parts = host.split(".");
  const isLovable = host.endsWith("lovable.app") || host.endsWith("lovable.dev");
  const isLocal = host === "localhost" || host.endsWith(".local") || /^\d+\.\d+\.\d+\.\d+$/.test(host);
  if (!isLovable && !isLocal && parts.length >= 3) {
    const sub = parts[0];
    if (sub && sub !== "www") return sub;
  }

  // 3. localStorage fallback
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
  } catch { /* ignore */ }

  return DEFAULT_TENANT_SLUG;
}

export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [memberships, setMemberships] = useState<TenantMembership[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadTenantById = useCallback(async (tenantId: string) => {
    const { data } = await supabase
      .from("tenants")
      .select("id, name, slug, custom_domain, is_active, branding")
      .eq("id", tenantId)
      .maybeSingle();
    return data;
  }, []);

  const loadTenant = useCallback(async (slug: string) => {
    // 0. Try domain resolution by host first
    const host = getCurrentHost();
    let resolvedTenantData: any = null;
    if (host) {
      const { data: dom } = await supabase
        .from("tenant_domains")
        .select("tenant_id")
        .eq("domain", host)
        .eq("verification_status", "verified")
        .maybeSingle();
      if (dom?.tenant_id) {
        resolvedTenantData = await loadTenantById(dom.tenant_id);
      }
    }

    // 1. Slug lookup if no domain match
    if (!resolvedTenantData) {
      const { data } = await supabase
        .from("tenants")
        .select("id, name, slug, custom_domain, is_active, branding")
        .eq("slug", slug)
        .maybeSingle();
      resolvedTenantData = data;
    }

    // 2. Fallback to default tenant
    if (!resolvedTenantData && slug !== DEFAULT_TENANT_SLUG) {
      const { data } = await supabase
        .from("tenants")
        .select("id, name, slug, custom_domain, is_active, branding")
        .eq("slug", DEFAULT_TENANT_SLUG)
        .maybeSingle();
      resolvedTenantData = data;
    }

    if (resolvedTenantData) {
      setTenant(resolvedTenantData as Tenant);
      try { localStorage.setItem(STORAGE_KEY, resolvedTenantData.slug); } catch { /* ignore */ }
      // Set GUC for RLS-aware queries this session
      await supabase.rpc("set_current_tenant", { _tenant_id: resolvedTenantData.id });

      // Load tenant_settings
      const { data: settingsData } = await supabase
        .from("tenant_settings")
        .select("*")
        .eq("tenant_id", resolvedTenantData.id)
        .maybeSingle();
      setSettings((settingsData as TenantSettings) ?? null);

      // Load current user's memberships
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        const { data: m } = await supabase
          .from("tenant_memberships")
          .select("tenant_id, user_id, role")
          .eq("user_id", userData.user.id);
        setMemberships((m as TenantMembership[]) ?? []);
      } else {
        setMemberships([]);
      }
    }
  }, [loadTenantById]);

  const switchTenant = useCallback(async (slug: string) => {
    setIsLoading(true);
    try { await loadTenant(slug); } finally { setIsLoading(false); }
  }, [loadTenant]);

  const refresh = useCallback(async () => {
    if (tenant) await loadTenant(tenant.slug);
  }, [tenant, loadTenant]);

  // Apply branding via CSS vars (opt-in, doesn't override design system)
  useEffect(() => {
    if (settings && typeof document !== "undefined") {
      document.documentElement.style.setProperty("--brand-primary", settings.primary_color);
      document.documentElement.style.setProperty("--brand-secondary", settings.secondary_color);
    }
  }, [settings]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const slug = detectInitialSlug();
      await loadTenant(slug);
      if (mounted) setIsLoading(false);
    })();

    // Reload memberships on auth change
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      if (tenant) loadTenant(tenant.slug);
    });

    return () => { mounted = false; subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <TenantContext.Provider value={{ tenant, settings, memberships, isLoading, switchTenant, refresh }}>
      {children}
    </TenantContext.Provider>
  );
};
