import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { format, addMinutes, parse } from "date-fns";
import { ArrowLeft, CheckCircle } from "lucide-react";

const ArenaBooking = () => {
  const { arenaSlug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [arena, setArena] = useState<any>(null);
  const [courts, setCourts] = useState<any[]>([]);
  const [selectedCourt, setSelectedCourt] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [availability, setAvailability] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [existingBookings, setExistingBookings] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);
  const [customerForm, setCustomerForm] = useState({ name: "", email: "", whatsapp: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Load arena + courts
  useEffect(() => {
    const load = async () => {
      const { data: a } = await supabase.from("arenas_public").select("*").eq("slug", arenaSlug).maybeSingle();
      if (!a) return;
      setArena(a);
      const { data: c } = await supabase.from("courts").select("*").eq("arena_id", a.id).eq("is_active", true).order("created_at");
      setCourts(c || []);
      if (c?.length) setSelectedCourt(c[0].id);
    };
    load();
  }, [arenaSlug]);

  // Load availability + blocks + existing bookings when court/date changes
  useEffect(() => {
    if (!selectedCourt || !selectedDate) return;
    const weekday = new Date(selectedDate + "T12:00:00").getDay();

    const load = async () => {
      const [avail, blk, bookings] = await Promise.all([
        supabase.from("court_availability").select("*").eq("court_id", selectedCourt).eq("weekday", weekday),
        supabase.from("court_blocks").select("*").eq("court_id", selectedCourt).eq("block_date", selectedDate),
        supabase.from("bookings").select("start_time, end_time").eq("court_id", selectedCourt).eq("booking_date", selectedDate).in("status", ["pending_payment", "confirmed"]),
      ]);
      setAvailability(avail.data || []);
      setBlocks(blk.data || []);
      setExistingBookings(bookings.data || []);
    };
    load();
  }, [selectedCourt, selectedDate]);

  // Generate available slots
  const slots = useMemo(() => {
    const result: { start: string; end: string }[] = [];
    if (!availability.length) return result;

    for (const avail of availability) {
      const duration = avail.slot_duration_minutes;
      let current = parse(String(avail.start_time).slice(0, 5), "HH:mm", new Date());
      const endTime = parse(String(avail.end_time).slice(0, 5), "HH:mm", new Date());

      while (addMinutes(current, duration) <= endTime) {
        const slotStart = format(current, "HH:mm");
        const slotEnd = format(addMinutes(current, duration), "HH:mm");

        // Check if blocked
        const isBlocked = blocks.some((b) => {
          if (!b.start_time) return true; // full day block
          const bs = String(b.start_time).slice(0, 5);
          const be = String(b.end_time).slice(0, 5);
          return slotStart < be && slotEnd > bs;
        });

        // Check if already booked
        const isBooked = existingBookings.some((b) => {
          const bs = String(b.start_time).slice(0, 5);
          const be = String(b.end_time).slice(0, 5);
          return slotStart < be && slotEnd > bs;
        });

        if (!isBlocked && !isBooked) {
          result.push({ start: slotStart, end: slotEnd });
        }

        current = addMinutes(current, duration);
      }
    }

    return result;
  }, [availability, blocks, existingBookings]);

  const court = courts.find((c) => c.id === selectedCourt);
  const slotDuration = availability[0]?.slot_duration_minutes || 60;
  const amount = court?.price_per_hour ? (Number(court.price_per_hour) * slotDuration / 60) : 0;

  const handleSubmit = async () => {
    if (!selectedSlot || !arena || !selectedCourt) return;
    setSubmitting(true);

    try {
      const { error } = await supabase.from("bookings").insert({
        arena_id: arena.id,
        court_id: selectedCourt,
        user_id: user?.id || null,
        booking_date: selectedDate,
        start_time: selectedSlot.start + ":00",
        end_time: selectedSlot.end + ":00",
        amount,
        status: "confirmed", // For now - will integrate with payment later
        customer_name: customerForm.name,
        customer_email: customerForm.email,
        customer_whatsapp: customerForm.whatsapp,
      });

      if (error) throw error;
      setDone(true);
      toast({ title: "Reserva confirmada!" });
    } catch (err: any) {
      toast({ title: "Erro ao reservar", description: err.message, variant: "destructive" });
    }
    setSubmitting(false);
  };

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 pb-24">
        <CheckCircle className="h-16 w-16 text-primary" />
        <h2 className="text-2xl font-display text-foreground">Reserva confirmada!</h2>
        <p className="text-sm text-muted-foreground text-center">
          {court?.name} — {format(new Date(selectedDate + "T12:00:00"), "dd/MM/yyyy")} • {selectedSlot?.start} - {selectedSlot?.end}
        </p>
        <Button onClick={() => navigate(`/arenas/${arenaSlug}`)}>Voltar para a arena</Button>
      </div>
    );
  }

  if (!arena) return <div className="flex items-center justify-center min-h-[60vh]"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center gap-3 pt-4">
        <button onClick={() => step > 1 ? setStep(step - 1) : navigate(-1)}><ArrowLeft className="h-5 w-5 text-muted-foreground" /></button>
        <h1 className="text-xl font-display text-foreground">Reservar — {arena.name}</h1>
      </div>

      {/* Steps indicator */}
      <div className="flex gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className={`h-1 flex-1 rounded-full ${step >= s ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>

      {/* Step 1: Select court, date, slot */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <Label>Quadra</Label>
            <Select value={selectedCourt} onValueChange={(v) => { setSelectedCourt(v); setSelectedSlot(null); }}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{courts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.price_per_hour ? ` — R$ ${Number(c.price_per_hour).toFixed(0)}/h` : ""}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div>
            <Label>Data</Label>
            <Input className="mt-1" type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setSelectedSlot(null); }} min={format(new Date(), "yyyy-MM-dd")} />
          </div>

          {slots.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum horário disponível nesta data</p>
          ) : (
            <div>
              <Label>Horário</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {slots.map((slot) => (
                  <button
                    key={slot.start}
                    onClick={() => setSelectedSlot(slot)}
                    className={`p-2 rounded-lg text-sm font-medium transition-colors border ${
                      selectedSlot?.start === slot.start
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-foreground hover:border-primary/40"
                    }`}
                  >
                    {slot.start} - {slot.end}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button className="w-full" disabled={!selectedSlot} onClick={() => setStep(2)}>Continuar</Button>
        </div>
      )}

      {/* Step 2: Summary */}
      {step === 2 && (
        <div className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2"><CardTitle className="text-base">Resumo da reserva</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Arena</span><span className="text-foreground">{arena.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Quadra</span><span className="text-foreground">{court?.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Data</span><span className="text-foreground">{format(new Date(selectedDate + "T12:00:00"), "dd/MM/yyyy")}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Horário</span><span className="text-foreground">{selectedSlot?.start} - {selectedSlot?.end}</span></div>
              <div className="flex justify-between border-t border-border pt-2 mt-2">
                <span className="font-bold text-foreground">Total</span>
                <span className="font-bold text-primary text-lg">R$ {amount.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
          <Button className="w-full" onClick={() => setStep(3)}>Prosseguir para pagamento</Button>
        </div>
      )}

      {/* Step 3: Customer info + confirm */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input className="mt-1" value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} placeholder="Seu nome" />
          </div>
          <div>
            <Label>Email *</Label>
            <Input className="mt-1" type="email" value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} placeholder="seu@email.com" />
          </div>
          <div>
            <Label>WhatsApp *</Label>
            <Input className="mt-1" value={customerForm.whatsapp} onChange={(e) => setCustomerForm({ ...customerForm, whatsapp: e.target.value })} placeholder="(11) 99999-9999" />
          </div>
          <Button
            className="w-full h-12 text-lg font-bold"
            disabled={submitting || !customerForm.name || !customerForm.email || !customerForm.whatsapp}
            onClick={handleSubmit}
          >
            {submitting ? "Processando..." : `Confirmar — R$ ${amount.toFixed(2)}`}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ArenaBooking;
