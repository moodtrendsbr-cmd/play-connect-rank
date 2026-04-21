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
import { LayoutDashboard, Trophy, PlusCircle, ClipboardList, GitBranch, DollarSign, Settings } from "lucide-react";

const groups = [
  {
    label: "Eventos",
    items: [
      { title: "Meus Torneios", url: "/organizer", icon: LayoutDashboard, end: true },
      { title: "Todos Torneios", url: "/organizer/torneios", icon: Trophy },
      { title: "Criar Torneio", url: "/organizer/criar", icon: PlusCircle },
    ],
  },
  {
    label: "Operação",
    items: [
      { title: "Inscrições", url: "/organizer/inscricoes", icon: ClipboardList },
      { title: "Jogos / Brackets", url: "/organizer/jogos", icon: GitBranch },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Financeiro", url: "/organizer/finance", icon: DollarSign },
    ],
  },
  {
    label: "Configurações",
    items: [
      { title: "Configurações", url: "/organizer/settings", icon: Settings },
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
