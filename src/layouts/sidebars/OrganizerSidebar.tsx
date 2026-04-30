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
  LayoutDashboard, Trophy, ClipboardList, Swords, DollarSign, MessageCircle,
} from "lucide-react";

const groups = [
  {
    label: "Visão geral",
    items: [
      { title: "Visão geral", url: "/organizer/dashboard", icon: LayoutDashboard, end: true },
    ],
  },
  {
    label: "Eventos",
    items: [
      { title: "Eventos", url: "/organizer/dashboard/eventos", icon: Trophy },
      { title: "Inscritos", url: "/organizer/dashboard/inscricoes", icon: ClipboardList },
      { title: "Jogos", url: "/organizer/dashboard/jogos", icon: Swords },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Financeiro", url: "/organizer/dashboard/financeiro", icon: DollarSign },
    ],
  },
  {
    label: "Conversas",
    items: [
      { title: "Conversas", url: "/organizer/dashboard/mensagens-wa", icon: MessageCircle },
    ],
  },
];

export function OrganizerSidebar() {
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
                  <SidebarMenuItem key={it.url + it.title}>
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
