import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarClock, Phone, Share2 } from "lucide-react";
import { LiveCheckin } from "@/hooks/useArenaCheckinsLive";
import { BookingGroupShareDialog } from "@/components/arena/BookingGroupShareDialog";

interface Props { arenaId: string; checkins: LiveCheckin[]; }

type B = {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  customer_name: string;
  customer_whatsapp: string | null;
  status: string;
  courts: { name: string } | null;
};

export const ArrivingBlock = ({ arenaId, checkins }: Props) => {
  const [items, setItems] = useState<B[]>([]);
  const [shareBookingId, setShareBookingId] = useState<string | null>(null);

  useEffect(() => {
    if (!arenaId) return;
    const load = async () => {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const in2h = new Date(now.getTime() + 2 * 60 * 60_000);
      const { data } = await supabase
        .from("bookings")
        .select("id, booking_date, start_time, end_time, customer_name, customer_whatsapp, status, courts(name)")
        .eq("arena_id", arenaId)
        .eq("booking_date", today)
        .in("status", ["confirmed", "completed"])
        .lte("start_time", in2h.toISOString().slice(11, 19))
        .gte("end_time", now.toISOString().slice(11, 19))
        .order("start_time", { ascending: true })
        .limit(8);
      setItems((data as any) || []);
    };
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [arenaId]);

  const checkinSet = new Set(checkins.map((c) => c.booking_id).filter(Boolean) as string[]);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-2xl tracking-wide text-foreground">CHEGANDO AGORA</h2>
        <Badge variant="outline" className="text-xs">{items.length} próximas 2h</Badge>
      </div>
      {items.length === 0 ? (
        <Card className="bg-card border-border border-dashed">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma reserva nas próximas 2 horas.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((b) => {
            const startHHMM = b.start_time.slice(0, 5);
            const arrived = checkinSet.has(b.id);
            const startedMin = (Date.now() - new Date(`${b.booking_date}T${b.start_time}`).getTime()) / 60_000;
            const late = !arrived && startedMin > 10;
            return (
              <Card key={b.id} className="bg-card border-border">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="h-10 w-12 rounded-md bg-muted flex flex-col items-center justify-center shrink-0">
                    <CalendarClock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-[10px] tabular-nums text-muted-foreground">{startHHMM}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{b.customer_name || "Reserva"}</p>
                    <p className="text-xs text-muted-foreground truncate">{b.courts?.name || "—"}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {arrived ? (
                      <Badge className="bg-primary/20 text-primary border-0 text-xs">Chegou</Badge>
                    ) : late ? (
                      <Badge variant="destructive" className="text-xs">Atrasado</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Pendente</Badge>
                    )}
                    <Button size="icon" variant="ghost" className="h-8 w-8"
                      onClick={() => setShareBookingId(b.id)}>
                      <Share2 className="h-4 w-4" />
                    </Button>
                    {b.customer_whatsapp && (
                      <a href={`https://wa.me/${b.customer_whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-primary">
                        <Phone className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {shareBookingId && (
        <BookingGroupShareDialog bookingId={shareBookingId} open={!!shareBookingId} onClose={() => setShareBookingId(null)} />
      )}
    </section>
  );
};
