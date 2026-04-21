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
import { LayoutDashboard, Building2, Users, Store, DollarSign, Palette, Globe, ShieldCheck, CreditCard } from "lucide-react";

const groups = [
  {
    label: "Rede",
    items: [
      { title: "Overview", url: "/tenant/overview", icon: LayoutDashboard, end: true },
      { title: "Arenas", url: "/tenant/arenas", icon: Building2 },
      { title: "Membros", url: "/tenant/membros", icon: Users },
      { title: "Empresas", url: "/tenant/empresas", icon: Store },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Financeiro", url: "/tenant/financeiro", icon: DollarSign },
      { title: "Pagamento", url: "/tenant/pagamento", icon: CreditCard },
    ],
  },
  {
    label: "Identidade",
    items: [
      { title: "Branding", url: "/tenant/branding", icon: Palette },
      { title: "Domínios", url: "/tenant/dominios", icon: Globe },
    ],
  },
  {
    label: "Autonomia",
    items: [
      { title: "Autonomia", url: "/tenant/autonomia", icon: ShieldCheck },
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
