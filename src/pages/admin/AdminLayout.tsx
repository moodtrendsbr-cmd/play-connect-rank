import { useEffect } from "react";
import { Outlet, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { NavLink } from "@/components/NavLink";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { LayoutDashboard, Users, Trophy, ClipboardList, DollarSign, Rss, Medal, User, Store, Package, Megaphone, Heart, CreditCard, ShoppingBag, Handshake, BarChart3, Gift, Layers, Building2, Percent, ScrollText, Bot, Sparkles, ShieldCheck, Gauge, MessageCircle, Phone, Inbox } from "lucide-react";

type NavGroup = {
  label: string;
  items: { title: string; url: string; icon: typeof LayoutDashboard; end?: boolean }[];
};

const navGroups: NavGroup[] = [
  {
    label: "Control Tower",
    items: [
      { title: "Dashboard", url: "/admin", icon: LayoutDashboard, end: true },
      { title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
      { title: "Control Tower", url: "/admin/control-tower", icon: Gauge },
      { title: "Comandos", url: "/admin/commands", icon: MessageCircle },
    ],
  },
  {
    label: "Operação",
    items: [
      { title: "Usuários", url: "/admin/users", icon: Users },
      { title: "Torneios", url: "/admin/tournaments", icon: Trophy },
      { title: "Inscrições", url: "/admin/enrollments", icon: ClipboardList },
      { title: "Arenas", url: "/admin/arenas", icon: Building2 },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Financeiro", url: "/admin/finances", icon: DollarSign },
      { title: "Regras de Split", url: "/admin/split-rules", icon: Percent },
      { title: "Ajustes", url: "/admin/adjustments", icon: ScrollText },
      { title: "Monetização", url: "/admin/monetization", icon: CreditCard },
      { title: "Destaques pagos", url: "/admin/featured-listings", icon: Sparkles },
      { title: "Planos", url: "/admin/plans", icon: Layers },
    ],
  },
  {
    label: "Marketplace & Campanhas",
    items: [
      { title: "Empresas", url: "/admin/companies", icon: Store },
      { title: "Produtos", url: "/admin/products", icon: Package },
      { title: "Campanhas", url: "/admin/ad-campaigns", icon: Megaphone },
      { title: "Campanhas (legado)", url: "/admin/ads", icon: Megaphone },
      { title: "Patrocínios — Atletas", url: "/admin/sponsors", icon: Heart },
      { title: "Patrocínios — Torneios", url: "/admin/sponsorships", icon: Handshake },
      { title: "Brindes", url: "/admin/gifts", icon: Gift },
    ],
  },
  {
    label: "ORKYM & Autonomia",
    items: [
      { title: "Monitor ORKYM", url: "/admin/orkym", icon: Bot },
      { title: "Ações ORKYM", url: "/admin/orkym-actions", icon: Sparkles },
      { title: "Autonomia", url: "/admin/autonomy", icon: ShieldCheck },
    ],
  },
  {
    label: "WhatsApp",
    items: [
      { title: "Instâncias", url: "/admin/whatsapp-instances", icon: Phone },
      { title: "Mensagens", url: "/admin/whatsapp-messages", icon: Inbox },
      { title: "Bindings", url: "/admin/whatsapp-bindings", icon: Phone },
      { title: "Leads", url: "/admin/whatsapp-leads", icon: Inbox },
    ],
  },
];

const userNavItems = [
  { title: "Feed", url: "/feed", icon: Rss },
  { title: "Torneios", url: "/tournaments", icon: Trophy },
  { title: "Marketplace", url: "/marketplace", icon: ShoppingBag },
  { title: "Ranking", url: "/ranking", icon: Medal },
  { title: "Perfil", url: "/profile", icon: User },
];

const AdminLayout = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || userRole !== "admin")) {
      navigate("/dashboard");
    }
  }, [user, userRole, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (userRole !== "admin") return null;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar className="border-r border-border">
          <SidebarContent>
            <div className="p-4">
              <Link to="/" className="text-xl font-display text-primary text-glow">🏐 MOODPLAY</Link>
              <p className="mt-1 text-xs text-muted-foreground">Painel Admin</p>
            </div>
            {navGroups.map((group) => (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={item.url}
                            end={item.end}
                            className="hover:bg-muted/50"
                            activeClassName="bg-muted text-primary font-medium"
                          >
                            <item.icon className="mr-2 h-4 w-4" />
                            <span>{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
            <SidebarGroup>
              <SidebarGroupLabel>Navegar como Usuário</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {userNavItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <Link to={item.url} className="hover:bg-muted/50">
                          <item.icon className="mr-2 h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <main className="flex-1 overflow-auto">
          <header className="flex h-14 items-center gap-4 border-b border-border bg-card px-6">
            <SidebarTrigger />
          </header>
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
