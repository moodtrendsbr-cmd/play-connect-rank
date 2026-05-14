import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve the destination route for a freshly authenticated user based on
 * role + entity ownership. Pure (no React hooks) so it can be used in
 * Login.tsx, Register.tsx and the /dashboard dispatcher page.
 *
 * Order of precedence:
 *  - admin           → /admin
 *  - tenant_admin*   → /tenant/dashboard (or onboarding if no tenant)
 *  - arena (owner)   → /arena/dashboard (or onboarding if no arena)
 *  - organizer       → /organizer/dashboard (or onboarding)
 *  - company (owner) → /company/dashboard (or onboarding)
 *  - athlete/default → /athlete/feed
 *
 * *tenant_admin is detected via tenant_members where role in (owner,admin).
 */
export async function resolveLandingPath(userId: string): Promise<string> {
  // 1) Role
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  const role = (roleRow?.role ?? "athlete") as string;

  if (role === "admin") return "/admin";

  // 2) Tenant admin (best-effort; table may or may not exist for this user)
  try {
    const { data: tm } = await supabase
      .from("tenant_members" as any)
      .select("tenant_id, role")
      .eq("user_id", userId)
      .in("role", ["owner", "admin"])
      .limit(1)
      .maybeSingle();
    if (tm) return "/tenant/dashboard";
  } catch {
    /* table may not exist in some environments — ignore */
  }

  if (role === "arena") {
    const { data: arena } = await supabase
      .from("arenas")
      .select("id")
      .eq("owner_user_id", userId)
      .limit(1)
      .maybeSingle();
    return arena ? "/arena/dashboard" : "/onboarding/arena";
  }

  if (role === "organizer") {
    return "/organizer/dashboard";
  }

  if (role === "company") {
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("owner_user_id", userId)
      .limit(1)
      .maybeSingle();
    return company ? "/company/dashboard" : "/onboarding/company";
  }

  // athlete + default
  return "/athlete/feed";
}
