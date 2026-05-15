import { useEffect, useState } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { CompanySidebar } from "./sidebars/CompanySidebar";
import { Loader2 } from "lucide-react";
import { useWhatsAppConnectionStatus } from "@/hooks/useWhatsAppConnection";
import { WhatsAppStatusBadge } from "@/components/conversational/WhatsAppStatusBadge";

const CompanyShell = () => {
  const { user, userRole, loading } = useAuth();
  const location = useLocation();
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("companies")
        .select("id, name")
        .eq("owner_user_id", user.id)
        .maybeSingle();
      if (data?.name) setCompanyName(data.name);
      if (data?.id) setCompanyId(data.id);
      setResolved(true);
    })();
  }, [user]);

  const scope = companyId ? { scope_type: "company" as const, company_id: companyId } : null;
  const { loading: waLoading, connected } = useWhatsAppConnectionStatus(scope);

  if (loading || !resolved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  const isSuperAdmin = userRole === "admin";
  if (resolved && !companyId && !isSuperAdmin) {
    return <Navigate to="/onboarding/company" replace />;
  }
  if (isSuperAdmin && resolved && !companyId) {
    return <Navigate to="/admin" replace />;
  }
  if (!isSuperAdmin && resolved && companyId && !waLoading && !connected) {
    return <Navigate to="/company/connect-whatsapp" replace state={{ from: location.pathname }} />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background text-foreground">
        <CompanySidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-12 flex items-center border-b border-border px-2 gap-2">
            <SidebarTrigger />
            <div className="ml-1 flex items-center gap-2 text-sm">
              <span className="rounded-md bg-primary/5 px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-primary">Empresa</span>
              <span className="text-muted-foreground">·</span>
              <span className="font-medium text-foreground truncate">{companyName ?? "MoodPlay"}</span>
            </div>
            <div className="ml-auto pr-2">
              {scope && <WhatsAppStatusBadge scope={scope} connectPath="/company/connect-whatsapp" />}
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

export default CompanyShell;
