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
      { title: "Eventos", url: "/tenant/torneios", icon: Trophy },
      { title: "Empresas", url: "/tenant/empresas", icon: Store },
      { title: "Organizadores", url: "/tenant/membros", icon: Users },
    ],
  },
  {
    label: "Receita",
    items: [
      { title: "Receita", url: "/tenant/financeiro", icon: DollarSign },
    ],
  },
  {
    label: "Configurações",
    items: [
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
