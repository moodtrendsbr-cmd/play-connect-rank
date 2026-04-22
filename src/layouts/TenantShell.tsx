import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant, useIsTenantAdmin } from "@/hooks/useTenant";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TenantSidebar } from "./sidebars/TenantSidebar";
import { Loader2 } from "lucide-react";

const TenantShell = () => {
  const { user, loading } = useAuth();
  const { tenant, isLoading } = useTenant();
  const isAdmin = useIsTenantAdmin();

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!tenant) return <Navigate to="/organizer/onboarding" replace />;
  if (!isAdmin) return <Navigate to="/organizer/onboarding" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background text-foreground">
        <TenantSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-12 flex items-center border-b border-border px-2">
            <SidebarTrigger />
            <div className="ml-3 flex items-center gap-2 text-sm">
              <span className="rounded-md bg-primary/5 px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-primary">Rede</span>
              <span className="text-muted-foreground">·</span>
              <span className="font-medium text-foreground truncate">{tenant.name}</span>
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

export default TenantShell;
