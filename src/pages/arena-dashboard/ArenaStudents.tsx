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
import { Plus, Search, User, Pencil, Trash2, Phone } from "lucide-react";
import { toast } from "sonner";

type Student = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  birth_date: string | null;
  notes: string | null;
  joined_at: string;
  profile_user_id: string | null;
};

const empty = { full_name: "", email: "", phone: "", birth_date: "", notes: "", status: "active" };

const ArenaStudents = () => {
  const { arena } = useOutletContext<{ arena: any }>();
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [crm, setCrm] = useState<Record<string, { last: string | null; visits: number }>>({});
  const [crmFilter, setCrmFilter] = useState<"all" | "frequent" | "inactive">("all");

  const load = async () => {
    if (!arena) return;
    const { data, error } = await supabase
      .from("arena_students")
      .select("*")
      .eq("arena_id", arena.id)
      .order("created_at", { ascending: false });
    if (error) { toast.error("Erro ao carregar alunos"); return; }
    setStudents((data as Student[]) || []);

    // CRM: aggregate arena_checkins by normalized phone (last 30d)
    const since = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
    const { data: ci } = await supabase
      .from("arena_checkins")
      .select("phone_e164, created_at")
      .eq("arena_id", arena.id)
      .gte("created_at", since);
    const map: Record<string, { last: string | null; visits: number }> = {};
    ((ci as any[]) || []).forEach((c) => {
      const k = (c.phone_e164 || "").replace(/\D/g, "");
      if (!k) return;
      const cur = map[k] || { last: null, visits: 0 };
      cur.visits += 1;
      if (!cur.last || c.created_at > cur.last) cur.last = c.created_at;
      map[k] = cur;
    });
    setCrm(map);
  };

  useEffect(() => { load(); }, [arena]);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (s: Student) => {
    setEditing(s);
    setForm({
      full_name: s.full_name,
      email: s.email || "",
      phone: s.phone || "",
      birth_date: s.birth_date || "",
      notes: s.notes || "",
      status: s.status,
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
      birth_date: form.birth_date || null,
      notes: form.notes.trim() || null,
      status: form.status,
    };
    const res = editing
      ? await supabase.from("arena_students").update(payload).eq("id", editing.id)
      : await supabase.from("arena_students").insert(payload);
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(editing ? "Aluno atualizado" : "Aluno cadastrado");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este aluno?")) return;
    const { error } = await supabase.from("arena_students").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Aluno excluído");
    load();
  };

  const filtered = students.filter(s => {
    const matchText = s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.email || "").toLowerCase().includes(search.toLowerCase());
    if (!matchText) return false;
    const phoneKey = (s.phone || "").replace(/\D/g, "");
    const info = crm[phoneKey];
    const days = info?.last ? Math.floor((Date.now() - new Date(info.last).getTime()) / 86400_000) : 999;
    if (crmFilter === "frequent") return (info?.visits || 0) >= 4;
    if (crmFilter === "inactive") return days > 21;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-display text-foreground">Alunos</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} size="sm" className="gap-1.5"><Plus className="h-4 w-4" />Novo</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editing ? "Editar aluno" : "Novo aluno"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome *</Label><Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nascimento</Label><Input type="date" value={form.birth_date} onChange={e => setForm({ ...form, birth_date: e.target.value })} /></div>
                <div>
                  <Label>Status</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </div>
              </div>
              <div><Label>Observações</Label><Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nome ou email" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum aluno cadastrado</p>
        )}
        {filtered.map(s => (
          <Card key={s.id} className="bg-card border-border">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center"><User className="h-5 w-5 text-primary" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{s.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{s.email || s.phone || "—"}</p>
              </div>
              <Badge variant={s.status === "active" ? "default" : "secondary"} className="text-xs">{s.status === "active" ? "Ativo" : "Inativo"}</Badge>
              <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ArenaStudents;
