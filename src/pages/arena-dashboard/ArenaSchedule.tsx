import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Ban } from "lucide-react";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const ArenaSchedule = () => {
  const { arena } = useOutletContext<{ arena: any }>();
  const [courts, setCourts] = useState<any[]>([]);
  const [selectedCourt, setSelectedCourt] = useState<string>("");
  const [availability, setAvailability] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [form, setForm] = useState({ weekday: "1", start_time: "08:00", end_time: "22:00", slot_duration_minutes: "60" });
  const [blockForm, setBlockForm] = useState({ block_date: "", start_time: "", end_time: "", reason: "" });

  useEffect(() => {
    if (!arena) return;
    supabase.from("courts").select("*").eq("arena_id", arena.id).eq("is_active", true).order("created_at").then(({ data }) => {
      setCourts(data || []);
      if (data?.length) setSelectedCourt(data[0].id);
    });
  }, [arena]);

  const fetchData = async () => {
    if (!selectedCourt) return;
    const [avail, blk] = await Promise.all([
      supabase.from("court_availability").select("*").eq("court_id", selectedCourt).order("weekday"),
      supabase.from("court_blocks").select("*").eq("court_id", selectedCourt).order("block_date"),
    ]);
    setAvailability(avail.data || []);
    setBlocks(blk.data || []);
  };

  useEffect(() => { fetchData(); }, [selectedCourt]);

  const addAvailability = async () => {
    await supabase.from("court_availability").insert({
      court_id: selectedCourt,
      weekday: Number(form.weekday),
      start_time: form.start_time,
      end_time: form.end_time,
      slot_duration_minutes: Number(form.slot_duration_minutes),
    });
    toast({ title: "Horário adicionado" });
    setAddOpen(false);
    fetchData();
  };

  const removeAvailability = async (id: string) => {
    await supabase.from("court_availability").delete().eq("id", id);
    fetchData();
  };

  const addBlock = async () => {
    await supabase.from("court_blocks").insert({
      court_id: selectedCourt,
      block_date: blockForm.block_date,
      start_time: blockForm.start_time || null,
      end_time: blockForm.end_time || null,
      reason: blockForm.reason || null,
    });
    toast({ title: "Bloqueio adicionado" });
    setBlockOpen(false);
    fetchData();
  };

  const removeBlock = async (id: string) => {
    await supabase.from("court_blocks").delete().eq("id", id);
    fetchData();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display text-foreground">Horários</h1>

      {courts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Cadastre quadras primeiro.</p>
      ) : (
        <>
          <Select value={selectedCourt} onValueChange={setSelectedCourt}>
            <SelectTrigger><SelectValue placeholder="Selecione a quadra" /></SelectTrigger>
            <SelectContent>
              {courts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Availability */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Funcionamento semanal</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {availability.length === 0 && <p className="text-sm text-muted-foreground">Nenhum horário configurado</p>}
              {availability.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                  <div>
                    <span className="text-sm font-medium text-foreground">{WEEKDAYS[a.weekday]}</span>
                    <span className="text-xs text-muted-foreground ml-2">{String(a.start_time).slice(0, 5)} - {String(a.end_time).slice(0, 5)} • {a.slot_duration_minutes}min</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeAvailability(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Blocks */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Bloqueios</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setBlockOpen(true)}><Ban className="h-4 w-4 mr-1" /> Bloquear</Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {blocks.length === 0 && <p className="text-sm text-muted-foreground">Nenhum bloqueio</p>}
              {blocks.map((b) => (
                <div key={b.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                  <div>
                    <span className="text-sm font-medium text-foreground">{b.block_date}</span>
                    {b.start_time && <span className="text-xs text-muted-foreground ml-2">{String(b.start_time).slice(0, 5)} - {String(b.end_time).slice(0, 5)}</span>}
                    {b.reason && <span className="text-xs text-muted-foreground ml-2">({b.reason})</span>}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeBlock(b.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Add availability dialog */}
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogContent className="bg-card border-border">
              <DialogHeader><DialogTitle>Adicionar horário</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Dia da semana</Label>
                  <Select value={form.weekday} onValueChange={(v) => setForm({ ...form, weekday: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{WEEKDAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Início</Label><Input className="mt-1" type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
                  <div><Label>Fim</Label><Input className="mt-1" type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
                </div>
                <div>
                  <Label>Duração do slot (min)</Label>
                  <Select value={form.slot_duration_minutes} onValueChange={(v) => setForm({ ...form, slot_duration_minutes: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 min</SelectItem>
                      <SelectItem value="60">60 min</SelectItem>
                      <SelectItem value="90">90 min</SelectItem>
                      <SelectItem value="120">120 min</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={addAvailability} className="w-full">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Add block dialog */}
          <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
            <DialogContent className="bg-card border-border">
              <DialogHeader><DialogTitle>Adicionar bloqueio</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Data *</Label><Input className="mt-1" type="date" value={blockForm.block_date} onChange={(e) => setBlockForm({ ...blockForm, block_date: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Início (opcional)</Label><Input className="mt-1" type="time" value={blockForm.start_time} onChange={(e) => setBlockForm({ ...blockForm, start_time: e.target.value })} /></div>
                  <div><Label>Fim (opcional)</Label><Input className="mt-1" type="time" value={blockForm.end_time} onChange={(e) => setBlockForm({ ...blockForm, end_time: e.target.value })} /></div>
                </div>
                <div><Label>Motivo</Label><Input className="mt-1" value={blockForm.reason} onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })} placeholder="Manutenção, feriado..." /></div>
                <Button onClick={addBlock} disabled={!blockForm.block_date} className="w-full">Bloquear</Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
};

export default ArenaSchedule;
