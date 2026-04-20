import { NavLink, Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant, useIsTenantAdmin } from "@/hooks/useTenant";
import { Settings, Users, Building2, Globe, CreditCard, Loader2, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/organizer/settings", label: "Configurações", icon: Settings },
  { to: "/organizer/members", label: "Membros", icon: Users },
  { to: "/organizer/arenas", label: "Arenas", icon: Building2 },
  { to: "/organizer/domains", label: "Domínios", icon: Globe },
  { to: "/organizer/payment", label: "Pagamentos", icon: CreditCard },
  { to: "/organizer/finance", label: "Financeiro", icon: DollarSign },
];

const OrganizerLayout = () => {
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
    <div className="min-h-screen bg-background text-foreground flex">
      <aside className="w-64 border-r border-border bg-card/50 p-4 hidden md:block">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Organizador</p>
          <h2 className="text-lg font-semibold truncate">{tenant.name}</h2>
          <p className="text-xs text-muted-foreground">/{tenant.slug}</p>
        </div>
        <nav className="space-y-1">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
};

export default OrganizerLayout;
