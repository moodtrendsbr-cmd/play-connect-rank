import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarClock, ChevronRight, BookOpen, GraduationCap, Trophy } from "lucide-react";

export type AgendaItem = {
  id: string;
  kind: "booking" | "class" | "tournament";
  time: string;
  title: string;
  subtitle?: string;
  to: string;
};

const iconFor = (kind: AgendaItem["kind"]) =>
  kind === "booking" ? BookOpen : kind === "class" ? GraduationCap : Trophy;

const badgeFor = (kind: AgendaItem["kind"]) =>
  kind === "tournament" ? "torneio" : kind === "class" ? "aula" : "reserva";

export const NextHoursBlock = ({ items }: { items: AgendaItem[] }) => (
  <section className="space-y-3">
    <div className="flex items-center gap-2">
      <CalendarClock className="h-5 w-5 text-blue-400" />
      <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">Próximas horas</h2>
    </div>

    <Card className="bg-card border-border">
      <CardContent className="p-2">
        {items.length === 0 ? (
          <div className="p-3 space-y-1">
            <p className="text-sm text-muted-foreground">Sem mais agendamentos hoje.</p>
            <Link to="/arena/dashboard/perfil" className="text-sm text-primary hover:underline">
              Divulgar horários →
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {items.map((it) => {
              const Icon = iconFor(it.kind);
              return (
                <li key={`${it.kind}-${it.id}`}>
                  <Link to={it.to} className="flex items-center gap-3 p-3 hover:bg-muted/30 rounded-lg transition-colors">
                    <div className="text-sm font-semibold text-foreground tabular-nums w-12 shrink-0">{it.time}</div>
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground truncate">{it.title}</p>
                      {it.subtitle && <p className="text-xs text-muted-foreground truncate">{it.subtitle}</p>}
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground hidden sm:inline">
                      {badgeFor(it.kind)}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  </section>
);
