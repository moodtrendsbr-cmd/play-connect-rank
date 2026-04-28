import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Binding {
  id: string;
  scope_type: string;
  instance_id: string;
  tenant_id: string | null;
  arena_id: string | null;
  organizer_user_id: string | null;
  company_id: string | null;
  profile_type: string | null;
  priority: number;
  whatsapp_instances?: { display_name: string | null; phone_number: string; provider: string };
}

const SCOPES = ["tenant", "arena", "organizer", "company", "profile"];
const PROFILE_TYPES = ["athlete", "organizer", "arena", "company"];

export default function AdminWhatsAppBindings() {
  const [items, setItems] = useState<Binding[]>([]);
  const [instances, setInstances] = useState<Array<{ id: string; display_name: string | null; phone_number: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [form, setForm] = useState({ scope_type: "tenant", instance_id: "", tenant_id: "", arena_id: "", organizer_user_id: "", company_id: "", profile_type: "", priority: 100 });

  const load = async () => {
    setLoading(true);
    const [b, i] = await Promise.all([
      supabase.from("whatsapp_bindings").select("*, whatsapp_instances(display_name,phone_number,provider)").order("priority", { ascending: true }),
      supabase.from("whatsapp_instances").select("id, display_name, phone_number"),
    ]);
    setItems((b.data ?? []) as Binding[]);
    setInstances(i.data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.instance_id || !form.scope_type) {
      toast.error("Preencha instância e escopo"); return;
    }
    const payload: any = { scope_type: form.scope_type, instance_id: form.instance_id, priority: Number(form.priority) || 100 };
    if (form.scope_type === "tenant") payload.tenant_id = form.tenant_id || null;
    if (form.scope_type === "arena") payload.arena_id = form.arena_id || null;
    if (form.scope_type === "organizer") payload.organizer_user_id = form.organizer_user_id || null;
    if (form.scope_type === "company") payload.company_id = form.company_id || null;
    if (form.scope_type === "profile") payload.profile_type = form.profile_type || null;

    const { error } = await supabase.from("whatsapp_bindings").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Binding criado");
    setForm({ ...form, instance_id: "", tenant_id: "", arena_id: "", organizer_user_id: "", company_id: "", profile_type: "" });
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("whatsapp_bindings").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  // Detect priority conflicts: same scope_type + same scope target + same priority
  const conflictKey = (b: Binding) => `${b.scope_type}:${b.tenant_id ?? ""}:${b.arena_id ?? ""}:${b.organizer_user_id ?? ""}:${b.company_id ?? ""}:${b.profile_type ?? ""}:${b.priority}`;
  const counts = items.reduce<Record<string, number>>((acc, b) => { const k = conflictKey(b); acc[k] = (acc[k] ?? 0) + 1; return acc; }, {});

  const filtered = filter === "all" ? items : items.filter((b) => b.scope_type === filter);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Bindings de WhatsApp</h1>
        <p className="text-muted-foreground">Visão global cross-tenant de roteamento por escopo.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Novo binding</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>Escopo</Label>
            <Select value={form.scope_type} onValueChange={(v) => setForm({ ...form, scope_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SCOPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Instância</Label>
            <Select value={form.instance_id} onValueChange={(v) => setForm({ ...form, instance_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {instances.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.display_name ?? i.phone_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Prioridade (menor vence)</Label>
            <Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
          </div>
          {form.scope_type === "tenant" && <div><Label>Tenant ID</Label><Input value={form.tenant_id} onChange={(e) => setForm({ ...form, tenant_id: e.target.value })} /></div>}
          {form.scope_type === "arena" && <div><Label>Arena ID</Label><Input value={form.arena_id} onChange={(e) => setForm({ ...form, arena_id: e.target.value })} /></div>}
          {form.scope_type === "organizer" && <div><Label>Organizer User ID</Label><Input value={form.organizer_user_id} onChange={(e) => setForm({ ...form, organizer_user_id: e.target.value })} /></div>}
          {form.scope_type === "company" && <div><Label>Company ID</Label><Input value={form.company_id} onChange={(e) => setForm({ ...form, company_id: e.target.value })} /></div>}
          {form.scope_type === "profile" && (
            <div>
              <Label>Profile type</Label>
              <Select value={form.profile_type} onValueChange={(v) => setForm({ ...form, profile_type: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{PROFILE_TYPES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="md:col-span-3">
            <Button onClick={create}><Plus className="h-4 w-4 mr-2" />Criar binding</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Bindings cadastrados</CardTitle>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {SCOPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {loading ? <Loader2 className="animate-spin" /> : filtered.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum binding.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((b) => {
                const conflict = (counts[conflictKey(b)] ?? 0) > 1;
                return (
                  <div key={b.id} className="flex items-center justify-between border rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{b.scope_type}</Badge>
                      <span className="text-sm">
                        {b.whatsapp_instances?.display_name ?? b.whatsapp_instances?.phone_number}
                        {" · "}prio {b.priority}
                      </span>
                      {conflict && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />conflito
                        </Badge>
                      )}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => remove(b.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
