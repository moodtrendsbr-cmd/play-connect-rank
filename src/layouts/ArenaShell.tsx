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
      // 1) Try owned arena
      let { data } = await supabase
        .from("arenas")
        .select("*")
        .eq("owner_user_id", user.id)
        .limit(1)
        .maybeSingle();

      // 2) Admin (or user without owned arena) → fall back to any arena so they can navigate/test
      if (!data && userRole === "admin") {
        const fallback = await supabase
          .from("arenas")
          .select("*")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        data = fallback.data;
      }

      if (data) {
        setArena(data);
        setArenaId(data.id);
        setTenantId((data as any).tenant_id ?? null);
      }
      setResolved(true);
    })();
  }, [user, userRole]);

  const scope = arenaId ? { scope_type: "arena" as const, arena_id: arenaId, tenant_id: tenantId } : null;
  const { loading: waLoading, connected } = useWhatsAppConnectionStatus(scope);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  // Gate: arena owners must connect WhatsApp before using the dashboard.
  // Super admin bypasses; checkin and connect pages are out of this shell.
  const isAdmin = userRole === "admin";
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
            <Outlet context={{ arena }} />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default ArenaShell;
