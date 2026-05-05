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
import { LayoutDashboard, Users, Trophy, ClipboardList, DollarSign, Rss, Medal, User, Store, Package, Megaphone, Heart, CreditCard, ShoppingBag, Handshake, BarChart3, Gift, Layers, Building2, Percent, ScrollText, Sparkles, MessageCircle, Phone, Inbox, CheckCircle2, Wrench } from "lucide-react";

type NavGroup = {
  label: string;
  items: { title: string; url: string; icon: typeof LayoutDashboard; end?: boolean }[];
  collapsed?: boolean;
};

const navGroups: NavGroup[] = [
  {
    label: "Visão geral",
    items: [
      { title: "Dashboard", url: "/admin", icon: LayoutDashboard, end: true },
      { title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Usuários",
    items: [
      { title: "Usuários", url: "/admin/users", icon: Users },
      { title: "Tenants", url: "/admin/tenants", icon: Building2 },
    ],
  },
  {
    label: "Operação",
    items: [
      { title: "Torneios", url: "/admin/tournaments", icon: Trophy },
      { title: "Inscrições", url: "/admin/enrollments", icon: ClipboardList },
      { title: "Arenas", url: "/admin/arenas", icon: Building2 },
    ],
  },
  {
    label: "Marketplace",
    items: [
      { title: "Empresas", url: "/admin/companies", icon: Store },
      { title: "Produtos", url: "/admin/products", icon: Package },
      { title: "Patrocínios — Atletas", url: "/admin/sponsors", icon: Heart },
      { title: "Patrocínios — Torneios", url: "/admin/sponsorships", icon: Handshake },
      { title: "Brindes", url: "/admin/gifts", icon: Gift },
      { title: "Planos", url: "/admin/plans", icon: Layers },
      { title: "Destaques pagos", url: "/admin/featured-listings", icon: Sparkles },
    ],
  },
  {
    label: "Campanhas",
    items: [
      { title: "Campanhas", url: "/admin/ad-campaigns", icon: Megaphone },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Financeiro", url: "/admin/finances", icon: DollarSign },
      { title: "Divisão de valores", url: "/admin/split-rules", icon: Percent },
      { title: "Ajustes", url: "/admin/adjustments", icon: ScrollText },
      { title: "Monetização", url: "/admin/monetization", icon: CreditCard },
    ],
  },
  {
    label: "Aprovações",
    items: [
      { title: "Destaques (fila)", url: "/admin/featured-listings", icon: CheckCircle2 },
    ],
  },
  {
    label: "Sistema",
    collapsed: true,
    items: [
      { title: "Monitor", url: "/admin/orkym", icon: Wrench },
      { title: "Ações automáticas", url: "/admin/orkym-actions", icon: Sparkles },
      { title: "Políticas", url: "/admin/autonomy", icon: Wrench },
      { title: "Visão geral (operação)", url: "/admin/control-tower", icon: Wrench },
      { title: "WhatsApp · Instâncias", url: "/admin/whatsapp-instances", icon: Phone },
      { title: "WhatsApp · Mensagens", url: "/admin/whatsapp-messages", icon: Inbox },
      { title: "WhatsApp · Conexão de número", url: "/admin/whatsapp-bindings", icon: Phone },
      { title: "WhatsApp · Leads", url: "/admin/whatsapp-leads", icon: Inbox },
      { title: "Conversas (logs)", url: "/admin/commands", icon: MessageCircle },
      { title: "Ferramentas internas", url: "/admin/internal-tools", icon: Wrench },
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
            {navGroups.map((group) => {
              const menu = (
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.url + item.title}>
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
              );
              if (group.collapsed) {
                return (
                  <SidebarGroup key={group.label}>
                    <details className="group">
                      <summary className="cursor-pointer list-none px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground select-none">
                        {group.label}
                      </summary>
                      <SidebarGroupContent>{menu}</SidebarGroupContent>
                    </details>
                  </SidebarGroup>
                );
              }
              return (
                <SidebarGroup key={group.label}>
                  <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                  <SidebarGroupContent>{menu}</SidebarGroupContent>
                </SidebarGroup>
              );
            })}
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
