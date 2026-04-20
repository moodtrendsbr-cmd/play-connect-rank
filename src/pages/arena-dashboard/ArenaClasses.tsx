import { useEffect, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, CalendarClock, Users, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type ClassRow = {
  id: string;
  title: string;
  description: string | null;
  modality: string | null;
  level: string;
  recurrence: string;
  weekday: number | null;
  start_at: string;
  end_at: string;
  capacity: number;
  status: string;
  price: number | null;
  instructor_id: string | null;
  court_id: string | null;
  arena_instructors?: { full_name: string } | null;
  courts?: { name: string } | null;
};

const empty = {
  title: "", description: "", modality: "", level: "livre",
  recurrence: "none", weekday: "", start_at: "", end_at: "",
  capacity: "10", status: "scheduled", price: "",
  instructor_id: "", court_id: "",
};

const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const ArenaClasses = () => {
  const { arena } = useOutletContext<{ arena: any }>();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [instructors, setInstructors] = useState<any[]>([]);
  const [courts, setCourts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!arena) return;
    const [c, i, q] = await Promise.all([
      supabase.from("arena_classes")
        .select("*, arena_instructors(full_name), courts(name)")
        .eq("arena_id", arena.id).order("start_at", { ascending: true }),
      supabase.from("arena_instructors").select("id,full_name").eq("arena_id", arena.id).eq("status", "active"),
      supabase.from("courts").select("id,name").eq("arena_id", arena.id).eq("is_active", true),
    ]);
    setClasses((c.data as ClassRow[]) || []);
    setInstructors(i.data || []);
    setCourts(q.data || []);
  };

  useEffect(() => { load(); }, [arena]);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (c: ClassRow) => {
    setEditing(c);
    setForm({
      title: c.title, description: c.description || "", modality: c.modality || "",
      level: c.level, recurrence: c.recurrence,
      weekday: c.weekday?.toString() || "",
      start_at: c.start_at.slice(0, 16), end_at: c.end_at.slice(0, 16),
      capacity: c.capacity.toString(), status: c.status,
      price: c.price?.toString() || "",
      instructor_id: c.instructor_id || "", court_id: c.court_id || "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.start_at || !form.end_at) {
      toast.error("Título e horários são obrigatórios"); return;
    }
    setSaving(true);
    const payload: any = {
      arena_id: arena.id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      modality: form.modality.trim() || null,
      level: form.level,
      recurrence: form.recurrence,
      weekday: form.weekday !== "" ? Number(form.weekday) : null,
      start_at: new Date(form.start_at).toISOString(),
      end_at: new Date(form.end_at).toISOString(),
      capacity: Number(form.capacity) || 10,
      status: form.status,
      price: form.price ? Number(form.price) : null,
      instructor_id: form.instructor_id || null,
      court_id: form.court_id || null,
    };
    const res = editing
      ? await supabase.from("arena_classes").update(payload).eq("id", editing.id)
      : await supabase.from("arena_classes").insert(payload);
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(editing ? "Aula atualizada" : "Aula criada");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta aula?")) return;
    const { error } = await supabase.from("arena_classes").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Aula excluída");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display text-foreground">Aulas</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} size="sm" className="gap-1.5"><Plus className="h-4 w-4" />Nova</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Editar aula" : "Nova aula"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Título *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Descrição</Label><Textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Modalidade</Label><Input value={form.modality} onChange={e => setForm({ ...form, modality: e.target.value })} /></div>
                <div>
                  <Label>Nível</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.level} onChange={e => setForm({ ...form, level: e.target.value })}>
                    <option value="iniciante">Iniciante</option>
                    <option value="intermediario">Intermediário</option>
                    <option value="avancado">Avançado</option>
                    <option value="livre">Livre</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Professor</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.instructor_id} onChange={e => setForm({ ...form, instructor_id: e.target.value })}>
                    <option value="">—</option>
                    {instructors.map(i => <option key={i.id} value={i.id}>{i.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Quadra</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.court_id} onChange={e => setForm({ ...form, court_id: e.target.value })}>
                    <option value="">—</option>
                    {courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Início *</Label><Input type="datetime-local" value={form.start_at} onChange={e => setForm({ ...form, start_at: e.target.value })} /></div>
                <div><Label>Fim *</Label><Input type="datetime-local" value={form.end_at} onChange={e => setForm({ ...form, end_at: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Recorrência</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.recurrence} onChange={e => setForm({ ...form, recurrence: e.target.value })}>
                    <option value="none">Única</option>
                    <option value="weekly">Semanal</option>
                  </select>
                </div>
                <div><Label>Capacidade</Label><Input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} /></div>
                <div><Label>Preço</Label><Input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
              </div>
              {form.recurrence === "weekly" && (
                <div>
                  <Label>Dia da semana</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.weekday} onChange={e => setForm({ ...form, weekday: e.target.value })}>
                    <option value="">—</option>
                    {weekdays.map((d, idx) => <option key={idx} value={idx}>{d}</option>)}
                  </select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {classes.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhuma aula cadastrada</p>}
        {classes.map(c => (
          <Card key={c.id} className="bg-card border-border">
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><CalendarClock className="h-5 w-5 text-primary" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{c.title}</p>
                    <Badge variant="secondary" className="text-[10px]">{c.level}</Badge>
                    {c.recurrence === "weekly" && <Badge variant="outline" className="text-[10px]">Semanal</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(c.start_at), "dd/MM HH:mm")} - {format(new Date(c.end_at), "HH:mm")}
                    {c.arena_instructors?.full_name && ` • ${c.arena_instructors.full_name}`}
                    {c.courts?.name && ` • ${c.courts.name}`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Link to={`/arena/dashboard/matriculas?class=${c.id}`}>
                    <Button size="icon" variant="ghost"><Users className="h-4 w-4" /></Button>
                  </Link>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ArenaClasses;
