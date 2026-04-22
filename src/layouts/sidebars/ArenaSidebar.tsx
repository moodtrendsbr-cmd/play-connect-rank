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
  LayoutDashboard, Gauge, Sparkles, ShieldCheck,
  QrCode, Grid3x3, CalendarDays, BookOpen, GraduationCap, ClipboardList, AlertCircle,
  Users, UserCog,
  DollarSign, Receipt, Layers, Repeat, FileText,
  Trophy, Handshake,
} from "lucide-react";

const groups = [
  {
    label: "Central de Operação",
    items: [
      { title: "Control Tower", url: "/arena/dashboard", icon: LayoutDashboard, end: true },
      { title: "Visão geral", url: "/arena/dashboard/control-tower", icon: Gauge },
      { title: "Ações sugeridas", url: "/arena/dashboard/acoes-ia", icon: Sparkles },
      { title: "Controle automático", url: "/arena/dashboard/autonomia", icon: ShieldCheck },
    ],
  },
  {
    label: "Operação",
    items: [
      { title: "Check-in", url: "/arena/checkin", icon: QrCode },
      { title: "Quadras", url: "/arena/dashboard/quadras", icon: Grid3x3 },
      { title: "Horários", url: "/arena/dashboard/horarios", icon: CalendarDays },
      { title: "Reservas", url: "/arena/dashboard/reservas", icon: BookOpen },
      { title: "Aulas", url: "/arena/dashboard/aulas", icon: GraduationCap },
      { title: "Matrículas", url: "/arena/dashboard/matriculas", icon: ClipboardList },
      { title: "Alunos", url: "/arena/dashboard/alunos", icon: Users },
      { title: "Professores", url: "/arena/dashboard/professores", icon: UserCog },
      { title: "Ocorrências", url: "/arena/dashboard/ocorrencias", icon: AlertCircle },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Financeiro", url: "/arena/dashboard/financeiro", icon: DollarSign },
      { title: "Transações", url: "/arena/dashboard/transacoes", icon: Receipt },
      { title: "Planos", url: "/arena/dashboard/planos", icon: Layers },
      { title: "Assinaturas", url: "/arena/dashboard/assinaturas", icon: Repeat },
      { title: "Cobranças (mensalidades)", url: "/arena/dashboard/cobrancas", icon: FileText },
    ],
  },
  {
    label: "Torneios",
    items: [
      { title: "Torneios", url: "/arena/dashboard/torneios", icon: Trophy },
    ],
  },
  {
    label: "Growth",
    items: [
      { title: "Patrocínios", url: "/arena/dashboard/patrocinios", icon: Handshake },
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
      {!collapsed && (
        <SidebarFooter className="p-2">
          <WhatsAppCTA
            variant="inline"
            command="Olá, sou da arena e quero falar com a ORKYM"
            label="Falar com a ORKYM"
            className="w-full justify-center"
          />
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
