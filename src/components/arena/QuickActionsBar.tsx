import { Link } from "react-router-dom";
import { QrCode, CalendarPlus, Trophy, ClipboardCheck, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const actions = [
  { to: "/arena/dashboard/qr",           label: "Abrir QR",       icon: QrCode },
  { to: "/arena/dashboard/reservas",     label: "Nova reserva",   icon: CalendarPlus },
  { to: "/create-tournament",            label: "Criar torneio",  icon: Trophy },
  { to: "/arena/dashboard/torneios",     label: "Resultado",      icon: ClipboardCheck },
  { to: "/arena/dashboard/mensagens-wa", label: "Conversas",      icon: MessageCircle },
];

export const QuickActionsBar = () => (
  <div className="sticky top-0 z-20 -mx-4 px-4 py-2 bg-background/95 backdrop-blur border-b border-border md:static md:mx-0 md:px-0 md:py-0 md:bg-transparent md:backdrop-blur-0 md:border-0">
    <div className="flex gap-2 overflow-x-auto snap-x scrollbar-none md:grid md:grid-cols-5 md:gap-3">
      {actions.map((a) => (
        <Link
          key={a.to}
          to={a.to}
          className={cn(
            "snap-start shrink-0 flex items-center gap-2 px-4 h-11 rounded-xl",
            "bg-card border border-border hover:border-primary/60 hover:text-primary",
            "transition-colors text-sm font-medium text-foreground md:justify-center",
          )}
        >
          <a.icon className="h-4 w-4 shrink-0" />
          <span className="whitespace-nowrap">{a.label}</span>
        </Link>
      ))}
    </div>
  </div>
);
