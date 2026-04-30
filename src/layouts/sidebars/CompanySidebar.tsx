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
  LayoutDashboard, Package, ShoppingBag, Megaphone, Handshake, Eye, MessageCircle,
} from "lucide-react";

const groups = [
  {
    label: "Visão geral",
    items: [
      { title: "Visão geral", url: "/company/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Loja",
    items: [
      { title: "Produtos", url: "/company/produtos", icon: Package },
      { title: "Pedidos", url: "/company/pedidos", icon: ShoppingBag },
    ],
  },
  {
    label: "Marketing",
    items: [
      { title: "Campanhas", url: "/company/sponsor/torneios", icon: Megaphone },
      { title: "Patrocínios", url: "/company/sponsor/resumo", icon: Handshake },
      { title: "Onde apareço", url: "/company/visibilidade", icon: Eye },
    ],
  },
  {
    label: "Conversas",
    items: [
      { title: "Conversas", url: "/company/mensagens-wa", icon: MessageCircle },
    ],
  },
];

export function CompanySidebar() {
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
    </Sidebar>
  );
}
