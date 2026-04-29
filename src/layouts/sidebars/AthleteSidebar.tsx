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
  User,
  Sun,
  MessageSquare,
  MessageCircle,
  Trophy,
  Swords,
  Medal,
  History,
  Compass,
  Rss,
} from "lucide-react";

const groups = [
  {
    label: "Meu Perfil",
    items: [
      { title: "Dashboard", url: "/athlete/dashboard", icon: LayoutDashboard },
      { title: "Meu perfil", url: "/athlete/perfil", icon: User },
      { title: "Comandos", url: "/athlete/comandos", icon: MessageCircle },
    ],
  },
  {
    label: "Meu Dia",
    items: [
      { title: "Mensagens", url: "/athlete/mensagens", icon: MessageSquare },
    ],
  },
  {
    label: "Torneios",
    items: [
      { title: "Torneios", url: "/athlete/torneios", icon: Trophy },
    ],
  },
  {
    label: "Ranking",
    items: [
      { title: "Ranking", url: "/athlete/ranking", icon: Medal },
    ],
  },
  {
    label: "Descobrir",
    items: [
      { title: "Descobrir", url: "/athlete/descobrir", icon: Compass },
      { title: "Feed", url: "/athlete/feed", icon: Rss },
    ],
  },
];

export function AthleteSidebar() {
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
            command="Olá, sou atleta e quero falar com a ORKYM"
            label="Falar com a ORKYM"
            className="w-full justify-center"
          />
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
