import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, GraduationCap, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Instructor = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  specialties: string[];
  bio: string | null;
  status: string;
  hourly_rate: number | null;
};

const empty = { full_name: "", email: "", phone: "", specialties: "", bio: "", status: "active", hourly_rate: "" };

const ArenaInstructors = () => {
  const { arena } = useOutletContext<{ arena: any }>();
  const [items, setItems] = useState<Instructor[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Instructor | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!arena) return;
    const { data, error } = await supabase
      .from("arena_instructors").select("*")
      .eq("arena_id", arena.id).order("created_at", { ascending: false });
    if (error) { toast.error("Erro ao carregar"); return; }
    setItems((data as Instructor[]) || []);
  };

  useEffect(() => { load(); }, [arena]);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (i: Instructor) => {
    setEditing(i);
    setForm({
      full_name: i.full_name, email: i.email || "", phone: i.phone || "",
      specialties: (i.specialties || []).join(", "), bio: i.bio || "",
      status: i.status, hourly_rate: i.hourly_rate?.toString() || "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.full_name.trim()) { toast.error("Nome obrigatório"); return; }
    setSaving(true);
    const payload: any = {
      arena_id: arena.id,
      full_name: form.full_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      specialties: form.specialties ? form.specialties.split(",").map(s => s.trim()).filter(Boolean) : [],
      bio: form.bio.trim() || null,
      status: form.status,
      hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null,
    };
    const res = editing
      ? await supabase.from("arena_instructors").update(payload).eq("id", editing.id)
      : await supabase.from("arena_instructors").insert(payload);
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(editing ? "Professor atualizado" : "Professor cadastrado");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este professor?")) return;
    const { error } = await supabase.from("arena_instructors").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Professor excluído");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display text-foreground">Professores</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} size="sm" className="gap-1.5"><Plus className="h-4 w-4" />Novo</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editing ? "Editar professor" : "Novo professor"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome *</Label><Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
              <div><Label>Especialidades (separadas por vírgula)</Label><Input value={form.specialties} onChange={e => setForm({ ...form, specialties: e.target.value })} placeholder="Beach Tennis, Padel" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Valor/hora (R$)</Label><Input type="number" step="0.01" value={form.hourly_rate} onChange={e => setForm({ ...form, hourly_rate: e.target.value })} /></div>
                <div>
                  <Label>Status</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </div>
              </div>
              <div><Label>Bio</Label><Textarea rows={2} value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum professor cadastrado</p>}
        {items.map(i => (
          <Card key={i.id} className="bg-card border-border">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center"><GraduationCap className="h-5 w-5 text-primary" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{i.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{(i.specialties || []).join(" • ") || i.email || "—"}</p>
              </div>
              <Badge variant={i.status === "active" ? "default" : "secondary"} className="text-xs">{i.status === "active" ? "Ativo" : "Inativo"}</Badge>
              <Button size="icon" variant="ghost" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => remove(i.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ArenaInstructors;
