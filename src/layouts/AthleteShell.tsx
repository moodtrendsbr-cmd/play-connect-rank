import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AthleteSidebar } from "./sidebars/AthleteSidebar";
import { AthleteBottomNav } from "@/components/layout/AthleteBottomNav";
import { Loader2 } from "lucide-react";

const AthleteShell = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background text-foreground">
        <div className="hidden md:block">
          <AthleteSidebar />
        </div>
        <div className="flex-1 flex flex-col">
          <header className="h-12 flex items-center border-b border-border px-2">
            <div className="hidden md:block">
              <SidebarTrigger />
            </div>
            <div className="ml-3 flex items-center gap-2 text-sm">
              <span className="rounded-md bg-primary/5 px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-primary">Atleta</span>
              <span className="text-muted-foreground">·</span>
              <span className="font-medium text-foreground">MoodPlay</span>
            </div>
          </header>
          <main className="flex-1 pb-16 md:pb-0">
            <Outlet />
          </main>
        </div>
        <AthleteBottomNav />
      </div>
    </SidebarProvider>
  );
};

export default AthleteShell;
