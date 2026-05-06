import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, AlertTriangle, Pencil, ListPlus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const CATEGORIES = ["court","class","instructor","booking","student","event","other"];
const SEVERITIES = ["low","medium","high","critical"];
const STATUSES = ["open","in_progress","resolved","closed"];

const CATEGORY_LABELS: Record<string, string> = {
  court: "Quadra",
  class: "Aula",
  instructor: "Instrutor",
  booking: "Reserva",
  student: "Aluno",
  event: "Evento",
  other: "Outro",
};

const SEVERITY_LABELS: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Aberta",
  in_progress: "Em andamento",
  resolved: "Resolvida",
  closed: "Fechada",
};

const SEV_BADGE: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-500/20 text-blue-400",
  high: "bg-amber-500/20 text-amber-400",
  critical: "bg-destructive/20 text-destructive",
};

const STATUS_BADGE: Record<string, string> = {
  open: "bg-destructive/20 text-destructive",
  in_progress: "bg-amber-500/20 text-amber-400",
  resolved: "bg-primary/20 text-primary",
  closed: "bg-muted text-muted-foreground",
};

const ArenaOccurrences = () => {
  const { arena } = useOutletContext<{ arena: any }>();
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCat, setFilterCat] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title: "", description: "", category: "other", severity: "medium", status: "open", resolution_notes: "" });

  const load = async () => {
    setLoading(true);
    let q = supabase.from("arena_occurrences").select("*").eq("arena_id", arena.id).order("created_at", { ascending: false });
    if (filterStatus !== "all") q = q.eq("status", filterStatus);
    if (filterCat !== "all") q = q.eq("category", filterCat);
    const { data } = await q;
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { if (arena) load(); }, [arena, filterStatus, filterCat]);

  const openNew = () => {
    setEditing(null);
    setForm({ title: "", description: "", category: "other", severity: "medium", status: "open", resolution_notes: "" });
    setOpen(true);
  };

  const openEdit = (o: any) => {
    setEditing(o);
    setForm({
      title: o.title, description: o.description || "", category: o.category,
      severity: o.severity, status: o.status, resolution_notes: o.resolution_notes || "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) { toast.error("Título obrigatório"); return; }
    const payload: any = {
      arena_id: arena.id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category,
      severity: form.severity,
      status: form.status,
      resolution_notes: form.resolution_notes.trim() || null,
    };
    if (!editing) payload.reported_by = user?.id;
    if (form.status === "resolved" && !editing?.resolved_at) payload.resolved_at = new Date().toISOString();
    const { error } = editing
      ? await supabase.from("arena_occurrences").update(payload).eq("id", editing.id)
      : await supabase.from("arena_occurrences").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Ocorrência atualizada" : "Ocorrência registrada");
    setOpen(false); load();
  };

  const generateTask = async (o: any) => {
    if (o.task_id) { toast.info("Já existe uma tarefa vinculada"); return; }
    const { data: task, error } = await supabase.from("arena_operational_tasks").insert({
      arena_id: arena.id,
      task_type: "occurrence_followup",
      title: `Resolver: ${o.title}`,
      description: o.description || null,
      priority: o.severity === "critical" ? 1 : o.severity === "high" ? 2 : 3,
      source: "manual",
      occurrence_id: o.id,
      related_entity_type: o.related_entity_type,
      related_entity_id: o.related_entity_id,
    }).select("id").single();
    if (error) { toast.error(error.message); return; }
    await supabase.from("arena_occurrences").update({ task_id: task.id }).eq("id", o.id);
    toast.success("Tarefa gerada na caixa de pendências");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-foreground">Ocorrências</h1>
          <p className="text-sm text-muted-foreground">Incidentes e manutenções</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew} size="sm" className="gap-2"><Plus className="h-4 w-4" /> Nova</Button></DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Editar ocorrência" : "Nova ocorrência"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Categoria</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Severidade</Label>
                  <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {(form.status === "resolved" || form.status === "closed") && (
                <div><Label>Notas de resolução</Label><Textarea value={form.resolution_notes} onChange={(e) => setForm({ ...form, resolution_notes: e.target.value })} rows={2} /></div>
              )}
              <Button onClick={save} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Categorias</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : items.length === 0 ? (
        <Card className="bg-card border-border"><CardContent className="p-8 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma ocorrência registrada.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {items.map((o) => (
            <Card key={o.id} className="bg-card border-border">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground text-sm">{o.title}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${SEV_BADGE[o.severity]}`}>{o.severity}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[o.status]}`}>{o.status}</span>
                      <span className="text-[10px] text-muted-foreground">• {o.category}</span>
                    </div>
                    {o.description && <p className="text-xs text-muted-foreground">{o.description}</p>}
                    <p className="text-[10px] text-muted-foreground">Aberta em {format(new Date(o.created_at), "dd/MM/yyyy HH:mm")}{o.task_id && " • tarefa vinculada"}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {!o.task_id && o.status !== "closed" && o.status !== "resolved" && (
                      <Button variant="ghost" size="sm" onClick={() => generateTask(o)} title="Gerar tarefa"><ListPlus className="h-4 w-4" /></Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => openEdit(o)}><Pencil className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ArenaOccurrences;
