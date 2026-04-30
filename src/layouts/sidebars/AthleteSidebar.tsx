import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { Rss, Trophy, Medal, MessageSquare, User } from "lucide-react";

const items = [
  { title: "Feed", url: "/athlete/feed", icon: Rss },
  { title: "Torneios", url: "/athlete/torneios", icon: Trophy },
  { title: "Ranking", url: "/athlete/ranking", icon: Medal },
  { title: "Mensagens", url: "/athlete/mensagens", icon: MessageSquare },
  { title: "Perfil", url: "/athlete/perfil", icon: User },
];

export function AthleteSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((it) => (
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
      </SidebarContent>
    </Sidebar>
  );
}
