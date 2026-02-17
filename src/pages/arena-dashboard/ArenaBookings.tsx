import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Phone } from "lucide-react";

const STATUS_MAP: Record<string, { label: string; class: string }> = {
  pending_payment: { label: "Pend. pagamento", class: "bg-amber-500/20 text-amber-400" },
  confirmed: { label: "Confirmada", class: "bg-primary/20 text-primary" },
  canceled: { label: "Cancelada", class: "bg-destructive/20 text-destructive" },
  completed: { label: "Concluída", class: "bg-blue-500/20 text-blue-400" },
};

const ArenaBookings = () => {
  const { arena } = useOutletContext<{ arena: any }>();
  const [bookings, setBookings] = useState<any[]>([]);

  const fetchBookings = async () => {
    const { data } = await supabase
      .from("bookings")
      .select("*, courts(name)")
      .eq("arena_id", arena.id)
      .order("booking_date", { ascending: false })
      .order("start_time", { ascending: false })
      .limit(50);
    setBookings(data || []);
  };

  useEffect(() => { if (arena) fetchBookings(); }, [arena]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("bookings").update({ status }).eq("id", id);
    toast({ title: `Reserva ${status === "canceled" ? "cancelada" : "concluída"}` });
    fetchBookings();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display text-foreground">Reservas</h1>

      {bookings.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma reserva encontrada</p>}

      <div className="space-y-3">
        {bookings.map((b) => {
          const st = STATUS_MAP[b.status] || STATUS_MAP.confirmed;
          return (
            <Card key={b.id} className="bg-card border-border">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{b.courts?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(b.booking_date), "dd/MM/yyyy")} • {String(b.start_time).slice(0, 5)} - {String(b.end_time).slice(0, 5)}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.class}`}>{st.label}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground">{b.customer_name}</span>
                    {b.customer_whatsapp && (
                      <a href={`https://wa.me/${b.customer_whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                        <Phone className="h-3.5 w-3.5 text-primary" />
                      </a>
                    )}
                  </div>
                  <span className="text-sm font-bold text-foreground">R$ {Number(b.amount).toFixed(2)}</span>
                </div>
                {(b.status === "confirmed") && (
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => updateStatus(b.id, "completed")}>Concluir</Button>
                    <Button size="sm" variant="destructive" className="text-xs" onClick={() => updateStatus(b.id, "canceled")}>Cancelar</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ArenaBookings;
