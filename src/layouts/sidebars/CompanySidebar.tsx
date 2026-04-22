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
  LayoutDashboard, Store, Package, ShoppingBag, ExternalLink,
  Megaphone, Trophy, LineChart, Eye, Compass, Rss,
} from "lucide-react";

const groups = [
  {
    label: "Control Tower",
    items: [
      { title: "Dashboard", url: "/company/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Marketplace",
    items: [
      { title: "Minha empresa", url: "/company/marketplace", icon: Store },
      { title: "Produtos", url: "/company/produtos", icon: Package },
      { title: "Pedidos", url: "/company/pedidos", icon: ShoppingBag },
      { title: "Ver loja pública", url: "/marketplace", icon: ExternalLink },
    ],
  },
  {
    label: "Campanhas",
    items: [
      { title: "Visão geral", url: "/company/campanhas", icon: Megaphone },
      { title: "Patrocinar torneio", url: "/company/sponsor/torneios", icon: Trophy },
      { title: "Meus patrocínios", url: "/company/sponsor/resumo", icon: Megaphone },
    ],
  },
  {
    label: "Performance",
    items: [
      { title: "Resultados", url: "/company/performance", icon: LineChart },
    ],
  },
  {
    label: "Visibilidade",
    items: [
      { title: "Como apareço", url: "/company/visibilidade", icon: Eye },
      { title: "Explore", url: "/explore", icon: Compass },
      { title: "Feed", url: "/feed", icon: Rss },
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
      {!collapsed && (
        <SidebarFooter className="p-2">
          <WhatsAppCTA
            variant="inline"
            command="Olá, sou da empresa e quero falar com a ORKYM"
            label="Falar com a ORKYM"
            className="w-full justify-center"
          />
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
