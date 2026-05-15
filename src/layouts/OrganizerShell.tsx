import { useEffect, useState } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { OrganizerSidebar } from "./sidebars/OrganizerSidebar";
import { Loader2 } from "lucide-react";
import { useWhatsAppConnectionStatus } from "@/hooks/useWhatsAppConnection";
import { WhatsAppStatusBadge } from "@/components/conversational/WhatsAppStatusBadge";

const OrganizerShell = () => {
  const { user, userRole, loading } = useAuth();
  const location = useLocation();
  const [hasEntity, setHasEntity] = useState<boolean | null>(null);
  const scope = user ? { scope_type: "organizer" as const, organizer_user_id: user.id } : null;
  const { loading: waLoading, connected } = useWhatsAppConnectionStatus(scope);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // organizer "entity" = membership owner/admin in any tenant other than default
      const { data } = await supabase
        .from("tenant_members" as any)
        .select("tenant_id, role")
        .eq("user_id", user.id)
        .in("role", ["owner", "admin"])
        .limit(1);
      setHasEntity(!!(data && data.length > 0));
    })();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (userRole !== "organizer" && userRole !== "admin") {
    return <Navigate to="/" replace />;
  }

  const isSuperAdmin = userRole === "admin";
  if (!isSuperAdmin && hasEntity === false) {
    return <Navigate to="/organizer/onboarding" replace />;
  }
  if (!isSuperAdmin && !waLoading && !connected) {
    return <Navigate to="/organizer/connect-whatsapp" replace state={{ from: location.pathname }} />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background text-foreground">
        <OrganizerSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-12 flex items-center border-b border-border px-2 gap-2">
            <SidebarTrigger />
            <div className="ml-1 flex items-center gap-2 text-sm">
              <span className="rounded-md bg-primary/5 px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-primary">Organizador</span>
              <span className="text-muted-foreground">·</span>
              <span className="font-medium text-foreground">MoodPlay</span>
            </div>
            <div className="ml-auto pr-2">
              {scope && <WhatsAppStatusBadge scope={scope} connectPath="/organizer/connect-whatsapp" />}
            </div>
          </header>
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default OrganizerShell;
