import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ArenaSidebar } from "./sidebars/ArenaSidebar";
import { Loader2 } from "lucide-react";
import { useWhatsAppConnectionStatus } from "@/hooks/useWhatsAppConnection";
import { WhatsAppStatusBadge } from "@/components/conversational/WhatsAppStatusBadge";

const ArenaShell = () => {
  const { user, userRole, loading } = useAuth();
  const location = useLocation();
  const [arena, setArena] = useState<any | null>(null);
  const [arenaId, setArenaId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      let { data } = await supabase
        .from("arenas")
        .select("*")
        .eq("owner_user_id", user.id)
        .limit(1)
        .maybeSingle();

      // Admin preview fallback: load first arena if admin doesn't own one.
      if (!data && userRole === "admin") {
        const { data: anyArena } = await supabase
          .from("arenas")
          .select("*")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        data = anyArena ?? null;
      }

      setArena(data ?? null);
      setArenaId(data?.id ?? null);
      setTenantId((data as any)?.tenant_id ?? null);
      setResolved(true);
    })();
  }, [user, userRole]);

  const scope = arenaId
    ? { scope_type: "arena" as const, arena_id: arenaId, tenant_id: tenantId }
    : null;
  const { loading: waLoading, connected } = useWhatsAppConnectionStatus(scope);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  const isAdmin = userRole === "admin";

  // No arena owned: owners go to onboarding; admin stays inside the arena profile shell.
  // This prevents profile preview routes like /arena/dashboard from bouncing back to /admin.
  if (resolved && !arenaId && !isAdmin) {
    return <Navigate to="/onboarding/arena" replace />;
  }

  // Gate: arena owners must connect WhatsApp before using the dashboard.
  if (!isAdmin && resolved && arenaId && !waLoading && !connected) {
    return <Navigate to="/arena/connect-whatsapp" replace state={{ from: location.pathname }} />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background text-foreground">
        <ArenaSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-12 flex items-center border-b border-border px-2 gap-2">
            <SidebarTrigger />
            <div className="ml-1 flex items-center gap-2 text-sm">
              <span className="rounded-md bg-primary/5 px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-primary">Arena</span>
              <span className="text-muted-foreground">·</span>
              <span className="font-medium text-foreground">MoodPlay</span>
            </div>
            <div className="ml-auto pr-2">
              {scope && <WhatsAppStatusBadge scope={scope} connectPath="/arena/connect-whatsapp" />}
            </div>
          </header>
          <main className="flex-1 p-6">
            {resolved && !arenaId && isAdmin ? (
              <div className="rounded-lg border border-border bg-card p-6">
                <h1 className="text-xl font-semibold text-foreground">Nenhuma arena cadastrada</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  O perfil de arena está correto, mas ainda não existe uma arena disponível para pré-visualização.
                </p>
              </div>
            ) : (
              <Outlet context={{ arena }} />
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default ArenaShell;
