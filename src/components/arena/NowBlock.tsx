import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, CalendarClock, UserCheck, Clock } from "lucide-react";

interface NowData {
  occupiedCourts: { id: string; court: string; customer: string; endTime: string }[];
  totalCourts: number;
  liveClasses: { id: string; title: string; instructor?: string }[];
  recentCheckins: number;
  nextBooking?: { court: string; startTime: string; customer: string } | null;
}

const SectionTitle = ({ live }: { live: boolean }) => (
  <div className="flex items-center gap-2">
    <Activity className="h-5 w-5 text-primary" />
    <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">Agora</h2>
    {live && (
      <span className="ml-1 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-primary">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
        </span>
        ao vivo
      </span>
    )}
  </div>
);

export const NowBlock = ({ data }: { data: NowData }) => {
  const live =
    data.occupiedCourts.length > 0 ||
    data.liveClasses.length > 0 ||
    data.recentCheckins > 0;

  return (
    <section className="space-y-3">
      <SectionTitle live={live} />

      {!live && !data.nextBooking && (
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Nada acontecendo agora.</p>
            <Link to="/arena/dashboard/horarios" className="text-sm text-primary hover:underline mt-1 inline-block">
              Ver agenda do dia →
            </Link>
          </CardContent>
        </Card>
      )}

      {(live || data.nextBooking) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Quadras ocupadas */}
          <Card className="bg-card border-border">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-baseline justify-between">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Quadras ocupadas</p>
                <p className="text-sm font-medium text-foreground">
                  {data.occupiedCourts.length}
                  {data.totalCourts > 0 && <span className="text-muted-foreground"> / {data.totalCourts}</span>}
                </p>
              </div>
              {data.occupiedCourts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todas livres.</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.occupiedCourts.slice(0, 4).map((c) => (
                    <li key={c.id} className="flex items-center justify-between text-sm">
                      <span className="text-foreground truncate">
                        {c.court} <span className="text-muted-foreground">· {c.customer}</span>
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">até {c.endTime}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Aulas + check-ins + próximo */}
          <Card className="bg-card border-border">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <CalendarClock className="h-4 w-4 text-blue-400 shrink-0" />
                <span className="text-foreground">
                  {data.liveClasses.length === 0
                    ? "Nenhuma aula em andamento"
                    : `${data.liveClasses.length} aula${data.liveClasses.length > 1 ? "s" : ""} em andamento`}
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <UserCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="text-foreground">
                  {data.recentCheckins === 0
                    ? "Sem check-ins recentes"
                    : `${data.recentCheckins} check-in${data.recentCheckins > 1 ? "s" : ""} nos últimos 30 min`}
                </span>
              </div>

              {data.nextBooking && (
                <div className="pt-2 border-t border-border flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                  <span className="text-foreground truncate">
                    Próximo: <span className="font-medium">{data.nextBooking.court}</span>{" "}
                    <span className="text-muted-foreground">às {data.nextBooking.startTime}</span>
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
};
