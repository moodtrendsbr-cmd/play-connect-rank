import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, BarChart3, Users, Building2, Trophy, ClipboardList,
  Store, Package, Megaphone, Heart, Handshake, Layers, Gift, CreditCard,
  DollarSign, Percent, ScrollText, Bot, Sparkles, ShieldCheck, Gauge,
} from "lucide-react";

const groups = [
  {
    label: "Visão Global",
    items: [
      { title: "Dashboard", url: "/admin", icon: LayoutDashboard, end: true },
      { title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
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
      { title: "Patrocínios Atleta", url: "/admin/sponsors", icon: Heart },
      { title: "Patrocínios Torneio", url: "/admin/sponsorships", icon: Handshake },
      { title: "Planos", url: "/admin/plans", icon: Layers },
      { title: "Brindes", url: "/admin/gifts", icon: Gift },
      { title: "Publicidade (legado)", url: "/admin/ads", icon: Megaphone },
      { title: "Campanhas Ads", url: "/admin/ad-campaigns", icon: Megaphone },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Financeiro", url: "/admin/finances", icon: DollarSign },
      { title: "Regras de Split", url: "/admin/split-rules", icon: Percent },
      { title: "Ajustes", url: "/admin/adjustments", icon: ScrollText },
      { title: "Monetização", url: "/admin/monetization", icon: CreditCard },
    ],
  },
  {
    label: "ORKYM & Autonomia",
    items: [
      { title: "Monitor ORKYM", url: "/admin/orkym", icon: Bot },
      { title: "Ações ORKYM", url: "/admin/orkym-actions", icon: Sparkles },
      { title: "Autonomia", url: "/admin/autonomy", icon: ShieldCheck },
      { title: "Control Tower", url: "/admin/control-tower", icon: Gauge },
    ],
  },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {groups.map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((it) => (
                  <SidebarMenuItem key={it.url}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={it.url}
                        end={(it as any).end}
                        className="hover:bg-muted/50"
                        activeClassName="bg-muted text-primary font-medium"
                      >
                        <it.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{it.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
