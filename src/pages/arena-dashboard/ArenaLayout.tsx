import { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { LayoutDashboard, Grid3X3, Clock, CalendarCheck, Handshake, Zap, ArrowLeft, Users, GraduationCap, CalendarClock, ClipboardList, Tag, RefreshCw, Receipt, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

const navItems = [
  { to: "/arena/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/arena/dashboard/alunos", label: "Alunos", icon: Users },
  { to: "/arena/dashboard/professores", label: "Professores", icon: GraduationCap },
  { to: "/arena/dashboard/aulas", label: "Aulas", icon: CalendarClock },
  { to: "/arena/dashboard/matriculas", label: "Matrículas", icon: ClipboardList },
  { to: "/arena/dashboard/planos", label: "Planos", icon: Tag },
  { to: "/arena/dashboard/assinaturas", label: "Assinaturas", icon: RefreshCw },
  { to: "/arena/dashboard/cobrancas", label: "Cobranças", icon: Receipt },
  { to: "/arena/dashboard/ocorrencias", label: "Ocorrências", icon: AlertTriangle },
  { to: "/arena/dashboard/quadras", label: "Quadras", icon: Grid3X3 },
  { to: "/arena/dashboard/horarios", label: "Horários", icon: Clock },
  { to: "/arena/dashboard/reservas", label: "Reservas", icon: CalendarCheck },
  { to: "/arena/dashboard/patrocinios", label: "Patrocínios", icon: Handshake },
];

const ArenaLayout = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [arena, setArena] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/login", { replace: true }); return; }

    const fetchArena = async () => {
      const { data } = await supabase
        .from("arenas")
        .select("*")
        .eq("owner_user_id", user.id)
        .maybeSingle();
      if (!data) { navigate("/feed", { replace: true }); return; }
      setArena(data);
      setLoading(false);
    };
    fetchArena();
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
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="container max-w-4xl flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <Link to="/feed" className="text-muted-foreground hover:text-foreground mr-1"><ArrowLeft className="h-4 w-4" /></Link>
            <span className="font-display text-2xl text-primary tracking-wider">MOOD</span>
            <span className="text-xs text-muted-foreground font-medium">ARENA</span>
          </div>
          <span className="text-sm font-medium text-foreground truncate max-w-[160px]">{arena?.name}</span>
        </div>
        <nav className="container max-w-4xl flex gap-1 px-4 pb-2 overflow-x-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="container max-w-4xl px-4 py-6 pb-24">
        <Outlet context={{ arena, setArena }} />
      </main>
    </div>
  );
};

export default ArenaLayout;
