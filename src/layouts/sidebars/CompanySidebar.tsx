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
import { Store, Package, ShoppingBag, Megaphone, Trophy, BarChart3 } from "lucide-react";

const groups = [
  {
    label: "Marketplace",
    items: [
      { title: "Minha Empresa", url: "/company/marketplace", icon: Store },
      { title: "Produtos", url: "/company/produtos", icon: Package },
      { title: "Pedidos", url: "/company/pedidos", icon: ShoppingBag },
    ],
  },
  {
    label: "Campanhas",
    items: [
      { title: "Sponsor Dashboard", url: "/company/campanhas", icon: Megaphone },
      { title: "Torneios Patrocinados", url: "/company/torneios-patrocinados", icon: Trophy },
    ],
  },
  {
    label: "Performance",
    items: [
      { title: "Métricas", url: "/company/performance", icon: BarChart3 },
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
