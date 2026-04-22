import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { WhatsAppCTA } from "@/components/conversational/WhatsAppCTA";
import {
  LayoutDashboard,
  Trophy,
  PlusCircle,
  ClipboardList,
  GitBranch,
  CheckCircle2,
  TrendingUp,
  DollarSign,
} from "lucide-react";

const groups = [
  {
    label: "Event Control Tower",
    items: [
      { title: "Dashboard", url: "/organizer/dashboard", icon: LayoutDashboard, end: true },
    ],
  },
  {
    label: "Eventos",
    items: [
      { title: "Meus eventos", url: "/organizer/dashboard/eventos", icon: Trophy },
      { title: "Criar evento", url: "/tournaments/create", icon: PlusCircle },
    ],
  },
  {
    label: "Inscrições",
    items: [
      { title: "Inscrições", url: "/organizer/dashboard/inscricoes", icon: ClipboardList },
    ],
  },
  {
    label: "Jogos",
    items: [
      { title: "Jogos & Brackets", url: "/organizer/dashboard/jogos", icon: GitBranch },
    ],
  },
  {
    label: "Check-in",
    items: [
      { title: "Check-in", url: "/organizer/dashboard/jogos", icon: CheckCircle2 },
    ],
  },
  {
    label: "Performance",
    items: [
      { title: "Performance", url: "/organizer/dashboard/performance", icon: TrendingUp },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Financeiro do evento", url: "/organizer/dashboard/financeiro", icon: DollarSign },
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
      {!collapsed && (
        <SidebarFooter className="p-2">
          <WhatsAppCTA
            variant="inline"
            command="Olá, sou organizador e quero falar com a ORKYM"
            label="Falar com a ORKYM"
            className="w-full justify-center"
          />
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
