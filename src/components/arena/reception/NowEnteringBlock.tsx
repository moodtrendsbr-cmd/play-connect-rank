import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserCheck, Phone } from "lucide-react";
import { LiveCheckin } from "@/hooks/useArenaCheckinsLive";

const minutesAgo = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "agora";
  if (m === 1) return "1 min";
  return `${m} min`;
};

interface Props { items: LiveCheckin[]; }

export const NowEnteringBlock = ({ items }: Props) => {
  const recent = items.filter((i) => Date.now() - new Date(i.created_at).getTime() < 30 * 60_000);
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-2xl tracking-wide text-foreground">ACABOU DE ENTRAR</h2>
        <Badge variant="outline" className="text-xs">{recent.length} nos últimos 30 min</Badge>
      </div>
      {recent.length === 0 ? (
        <Card className="bg-card border-border border-dashed">
          <CardContent className="p-6 text-center space-y-2">
            <UserCheck className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhuma entrada ainda hoje</p>
            <p className="text-xs text-muted-foreground">Cole o QR de check-in na recepção para começar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {recent.slice(0, 10).map((i) => (
            <Card key={i.id} className="bg-card border-border animate-fade-in">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <UserCheck className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{i.display_name || "Visitante"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {i.sport || "—"}{i.booking_id ? " · reserva" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {i.phone_e164 && (
                    <a href={`https://wa.me/${i.phone_e164.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                      className="text-muted-foreground hover:text-primary">
                      <Phone className="h-4 w-4" />
                    </a>
                  )}
                  <span className="text-xs text-muted-foreground tabular-nums">{minutesAgo(i.created_at)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
};
