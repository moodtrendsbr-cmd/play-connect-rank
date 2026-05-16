import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Search, Phone } from "lucide-react";

interface Props { open: boolean; onClose: () => void; arenaId: string; }

export const LocateBookingDialog = ({ open, onClose, arenaId }: Props) => {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);

  const search = async (term: string) => {
    setQ(term);
    if (term.length < 3) { setResults([]); return; }
    const today = new Date().toISOString().slice(0, 10);
    const phone = term.replace(/\D/g, "");
    const isPhone = phone.length >= 4;
    const query = supabase
      .from("bookings")
      .select("id, booking_date, start_time, customer_name, customer_whatsapp, status, courts(name)")
      .eq("arena_id", arenaId)
      .gte("booking_date", today)
      .order("booking_date", { ascending: true })
      .limit(10);
    const { data } = isPhone
      ? await query.ilike("customer_whatsapp", `%${phone}%`)
      : await query.ilike("customer_name", `%${term}%`);
    setResults((data as any) || []);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Localizar reserva</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome ou WhatsApp</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" value={q} onChange={(e) => search(e.target.value)} placeholder="Digite ao menos 3 caracteres" autoFocus />
            </div>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {results.map((b) => (
              <Card key={b.id} className="bg-card border-border">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{b.customer_name || "Reserva"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {b.courts?.name || "—"} · {String(b.start_time).slice(0, 5)} · {b.booking_date}
                      </p>
                    </div>
                    {b.customer_whatsapp && (
                      <a href={`https://wa.me/${b.customer_whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                        className="text-muted-foreground hover:text-primary">
                        <Phone className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {q.length >= 3 && results.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">Nenhuma reserva encontrada.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
