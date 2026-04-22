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
  Gauge, Building2, Users, Store, DollarSign, CreditCard,
  Activity, Sparkles, Palette, Globe,
} from "lucide-react";

const groups = [
  {
    label: "Control Tower",
    items: [
      { title: "Dashboard", url: "/tenant/dashboard", icon: Gauge, end: true },
    ],
  },
  {
    label: "Rede",
    items: [
      { title: "Arenas", url: "/tenant/arenas", icon: Building2 },
      { title: "Organizadores", url: "/tenant/membros", icon: Users },
      { title: "Empresas", url: "/tenant/empresas", icon: Store },
    ],
  },
  {
    label: "Monetização",
    items: [
      { title: "Financeiro", url: "/tenant/financeiro", icon: DollarSign },
      { title: "Conta de pagamento", url: "/tenant/pagamento", icon: CreditCard },
    ],
  },
  {
    label: "Operações",
    items: [
      { title: "Eventos", url: "/tenant/dashboard#operacoes", icon: Activity },
    ],
  },
  {
    label: "IA / Autonomia",
    items: [
      { title: "Autonomia", url: "/tenant/autonomia", icon: Sparkles },
    ],
  },
  {
    label: "Configurações",
    items: [
      { title: "Branding", url: "/tenant/branding", icon: Palette },
      { title: "Domínios", url: "/tenant/dominios", icon: Globe },
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
      {!collapsed && (
        <SidebarFooter className="p-2">
          <WhatsAppCTA
            variant="inline"
            command="Olá, sou da rede e quero falar com a ORKYM"
            label="Falar com a ORKYM"
            className="w-full justify-center"
          />
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
