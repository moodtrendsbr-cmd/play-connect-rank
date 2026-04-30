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
  LayoutDashboard, QrCode as QrCodeIcon, BookOpen,
  Grid3x3, CalendarDays, GraduationCap, ClipboardList, Users, UserCog, AlertCircle,
  Trophy, DollarSign, Handshake, MessageCircle, Package, UserCheck, ShieldCheck,
} from "lucide-react";

const groups = [
  {
    label: "Visão geral",
    items: [
      { title: "Visão geral", url: "/arena/dashboard", icon: LayoutDashboard, end: true },
    ],
  },
  {
    label: "Hoje",
    items: [
      { title: "Check-in", url: "/arena/checkin", icon: QrCodeIcon },
      { title: "Reservas", url: "/arena/dashboard/reservas", icon: BookOpen },
    ],
  },
  {
    label: "Operação",
    items: [
      { title: "Quadras", url: "/arena/dashboard/quadras", icon: Grid3x3 },
      { title: "Horários", url: "/arena/dashboard/horarios", icon: CalendarDays },
      { title: "Aulas", url: "/arena/dashboard/aulas", icon: GraduationCap },
      { title: "Ocorrências", url: "/arena/dashboard/ocorrencias", icon: AlertCircle },
    ],
  },
  {
    label: "Clientes",
    items: [
      { title: "Alunos", url: "/arena/dashboard/alunos", icon: Users },
      { title: "Matrículas", url: "/arena/dashboard/matriculas", icon: ClipboardList },
      { title: "Professores", url: "/arena/dashboard/professores", icon: UserCog },
      { title: "Equipe", url: "/arena/dashboard/equipe", icon: ShieldCheck },
    ],
  },
  {
    label: "Torneios",
    items: [
      { title: "Torneios", url: "/arena/dashboard/torneios", icon: Trophy },
    ],
  },
  {
    label: "Receita",
    items: [
      { title: "Financeiro", url: "/arena/dashboard/financeiro", icon: DollarSign },
      { title: "Produtos", url: "/arena/dashboard/produtos", icon: Package },
    ],
  },
  {
    label: "Crescimento",
    items: [
      { title: "Patrocínios", url: "/arena/dashboard/patrocinios", icon: Handshake },
      { title: "QR físico", url: "/arena/dashboard/qr", icon: QrCodeIcon },
      { title: "Perfil da arena", url: "/arena/dashboard/perfil", icon: UserCheck },
    ],
  },
  {
    label: "Conversas",
    items: [
      { title: "Conversas", url: "/arena/dashboard/mensagens-wa", icon: MessageCircle },
    ],
  },
];

export function ArenaSidebar() {
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
