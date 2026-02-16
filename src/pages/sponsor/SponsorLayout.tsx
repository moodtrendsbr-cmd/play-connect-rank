import { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { LayoutDashboard, Trophy, FileText, Zap } from "lucide-react";

const navItems = [
  { to: "/sponsor/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/sponsor/tournaments", label: "Torneios", icon: Trophy },
];

const SponsorLayout = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    const fetch = async () => {
      const { data } = await supabase
        .from("companies")
        .select("*")
        .eq("owner_user_id", user.id)
        .eq("status", "approved")
        .maybeSingle();
      if (!data) {
        navigate("/marketplace/register", { replace: true });
        return;
      }
      setCompany(data);
      setLoading(false);
    };
    fetch();
  }, [user, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Zap className="h-8 w-8 text-primary animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="container max-w-4xl flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <span className="font-display text-2xl text-primary tracking-wider">MOOD</span>
            <span className="text-xs text-muted-foreground font-medium">SPONSOR</span>
          </div>
          <div className="flex items-center gap-2">
            {company?.logo_url && (
              <img src={company.logo_url} alt="" className="h-7 w-7 rounded-lg object-cover border border-border" />
            )}
            <span className="text-sm font-medium text-foreground truncate max-w-[120px]">{company?.name}</span>
          </div>
        </div>
        {/* Nav */}
        <nav className="container max-w-4xl flex gap-1 px-4 pb-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* Content */}
      <main className="container max-w-4xl px-4 py-6 pb-24">
        <Outlet context={{ company }} />
      </main>
    </div>
  );
};

export default SponsorLayout;
