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
  Gauge, Building2, Users, Store, DollarSign, Settings, Trophy, MessageCircle,
  Layers, CalendarDays, Globe,
} from "lucide-react";

const groups = [
  {
    label: "Visão geral",
    items: [
      { title: "Visão geral", url: "/tenant/dashboard", icon: Gauge, end: true },
    ],
  },
  {
    label: "Rede",
    items: [
      { title: "Arenas", url: "/tenant/arenas", icon: Building2 },
      { title: "Organizadores", url: "/tenant/membros", icon: Users },
      { title: "Empresas e patrocinadores", url: "/tenant/empresas", icon: Store },
    ],
  },
  {
    label: "Eventos",
    items: [
      { title: "Torneios", url: "/tenant/torneios", icon: Trophy },
      { title: "Circuitos", url: "/tenant/circuitos", icon: Layers },
      { title: "Calendário", url: "/tenant/calendario", icon: CalendarDays },
    ],
  },
  {
    label: "Receita",
    items: [
      { title: "Financeiro", url: "/tenant/financeiro", icon: DollarSign },
    ],
  },
  {
    label: "Identidade",
    items: [
      { title: "Perfil da rede", url: "/tenant/perfil", icon: Globe },
      { title: "Configurações", url: "/tenant/dominios", icon: Settings },
    ],
  },
  {
    label: "Conversas",
    items: [
      { title: "Conversas", url: "/tenant/mensagens-wa", icon: MessageCircle },
    ],
  },
];

export function TenantSidebar() {
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
