import { useEffect, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, UserPlus, Users } from "lucide-react";

const ROLES = [
  { value: "gerente",      label: "Gerente" },
  { value: "recepcao",     label: "Recepção" },
  { value: "professor",    label: "Professor" },
  { value: "organizador",  label: "Organizador" },
  { value: "financeiro",   label: "Financeiro" },
  { value: "bar_lojinha",  label: "Bar / Lojinha" },
  { value: "suporte",      label: "Suporte" },
];

const PERMS = [
  { key: "manage_bookings",  label: "Pode gerenciar reservas" },
  { key: "view_finance",     label: "Pode ver financeiro" },
  { key: "manage_students",  label: "Pode gerenciar alunos" },
  { key: "sell_products",    label: "Pode vender produtos" },
];

const emptyForm = {
  display_name: "", email: "", phone: "", role: "recepcao", is_active: true,
  permissions: { manage_bookings: false, view_finance: false, manage_students: false, sell_products: false } as Record<string, boolean>,
};

const ArenaTeam = () => {
  const { arena } = useOutletContext<{ arena: any }>();
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(emptyForm);

  const fetchItems = async () => {
    if (!arena?.id) return;
    const { data } = await (supabase as any)
      .from("arena_staff")
      .select("*")
      .eq("arena_id", arena.id)
      .order("created_at", { ascending: false });
    setItems(data || []);
  };

  useEffect(() => { if (arena) fetchItems(); }, [arena]);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (s: any) => {
    setEditing(s);
    setForm({
      display_name: s.display_name || "",
      email: s.email || "",
      phone: s.phone || "",
      role: s.role || "recepcao",
      is_active: !!s.is_active,
      permissions: { ...emptyForm.permissions, ...(s.permissions || {}) },
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!arena?.id || !form.display_name) { toast.error("Informe o nome"); return; }
    const payload = { ...form, arena_id: arena.id };
    if (editing) {
      const { error } = await (supabase as any).from("arena_staff").update(payload).eq("id", editing.id);
      if (error) { toast.error("Não foi possível salvar"); return; }
      toast.success("Atualizado");
    } else {
      const { error } = await (supabase as any).from("arena_staff").insert(payload);
      if (error) { toast.error("Não foi possível convidar"); return; }
      toast.success("Convite enviado");
    }
    setOpen(false);
    fetchItems();
  };

  const toggle = async (s: any) => {
    await (supabase as any).from("arena_staff").update({ is_active: !s.is_active }).eq("id", s.id);
    fetchItems();
  };

  const roleLabel = (r: string) => ROLES.find((x) => x.value === r)?.label || r;

  return (
    <div className="space-y-6">
      <Link to="/arena/dashboard" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar ao painel
      </Link>

      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display text-foreground">Equipe</h1>
          <p className="text-sm text-muted-foreground">Gerentes, recepção, professores e mais. Convide quem ajuda no dia a dia.</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openAdd}><UserPlus className="h-4 w-4" /> Convidar</Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Para professores, recomendamos cadastrar também em <Link to="/arena/dashboard/professores" className="underline">Professores</Link> para vincular às aulas.
      </p>

      {items.length === 0 ? (
        <Card className="bg-card border-border border-dashed">
          <CardContent className="p-10 text-center space-y-3">
            <Users className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="font-semibold">Sua equipe ainda está vazia</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">Convide quem ajuda você na operação. Cada pessoa pode ter permissões próprias.</p>
            <Button onClick={openAdd} className="mt-2"><Plus className="h-4 w-4 mr-1" /> Convidar funcionário</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((s) => {
            const perms = Object.entries(s.permissions || {}).filter(([, v]) => v);
            return (
              <Card key={s.id} className={`bg-card border-border ${!s.is_active ? "opacity-60" : ""}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{s.display_name}</p>
                      <p className="text-xs text-muted-foreground">{roleLabel(s.role)}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {s.phone && <p>{s.phone}</p>}
                    {s.email && <p className="truncate">{s.email}</p>}
                  </div>
                  {perms.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {perms.map(([k]) => (
                        <span key={k} className="text-[10px] px-2 py-0.5 rounded-full bg-[#2BFF88]/10 text-[#2BFF88]">
                          {PERMS.find((p) => p.key === k)?.label.replace("Pode ", "") || k}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-border/40">
                    <span className="text-xs text-muted-foreground">{s.is_active ? "Ativo" : "Inativo"}</span>
                    <Switch checked={s.is_active} onCheckedChange={() => toggle(s)} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar funcionário" : "Convidar funcionário"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Função</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 pt-1">
              <Label>Permissões</Label>
              {PERMS.map((p) => (
                <label key={p.key} className="flex items-center justify-between text-sm py-1">
                  <span>{p.label}</span>
                  <Switch
                    checked={!!form.permissions[p.key]}
                    onCheckedChange={(v) => setForm({ ...form, permissions: { ...form.permissions, [p.key]: v } })}
                  />
                </label>
              ))}
            </div>
            <Button onClick={handleSave} className="w-full">{editing ? "Salvar" : "Convidar"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ArenaTeam;
