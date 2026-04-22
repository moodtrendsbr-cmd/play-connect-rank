import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Loader2, Network } from "lucide-react";
import { toast } from "sonner";

interface Instance {
  id: string;
  display_name: string | null;
  phone_number: string;
  provider: string;
  status: string;
}

interface Binding {
  id: string;
  scope_type: string;
  arena_id: string | null;
  instance_id: string;
  priority: number;
  whatsapp_instances?: { display_name: string | null; phone_number: string; provider: string };
  arenas?: { name: string };
}

interface Arena {
  id: string;
  name: string;
}

const SCOPES = [
  { value: "tenant", label: "Toda a rede (tenant)" },
  { value: "arena", label: "Arena específica" },
];

const TenantWhatsAppRouting = () => {
  const { tenantId } = useTenant();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ scope_type: "tenant", arena_id: "", instance_id: "", priority: 100 });

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    const [{ data: insts }, { data: bnds }, { data: ars }] = await Promise.all([
      supabase.from("whatsapp_instances").select("id,display_name,phone_number,provider,status").eq("status", "active"),
      supabase
        .from("whatsapp_bindings")
        .select("id,scope_type,arena_id,instance_id,priority,whatsapp_instances(display_name,phone_number,provider),arenas(name)")
        .eq("tenant_id", tenantId)
        .order("priority", { ascending: true }),
      supabase.from("arenas").select("id,name").eq("tenant_id", tenantId),
    ]);
    setInstances((insts as Instance[]) || []);
    setBindings((bnds as Binding[]) || []);
    setArenas((ars as Arena[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tenantId]);

  const handleCreate = async () => {
    if (!form.instance_id || !tenantId) {
      toast.error("Selecione uma instância");
      return;
    }
    if (form.scope_type === "arena" && !form.arena_id) {
      toast.error("Selecione uma arena");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("whatsapp_bindings").insert({
      tenant_id: tenantId,
      arena_id: form.scope_type === "arena" ? form.arena_id : null,
      scope_type: form.scope_type,
      instance_id: form.instance_id,
      priority: form.priority,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Binding criado");
    setOpen(false);
    setForm({ scope_type: "tenant", arena_id: "", instance_id: "", priority: 100 });
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("whatsapp_bindings").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Binding removido");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-glow">Roteamento WhatsApp</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Defina qual instância WhatsApp atende cada arena ou toda a rede. Hierarquia: arena → tenant → fallback global.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Novo binding</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar roteamento</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Escopo</Label>
                <Select value={form.scope_type} onValueChange={(v) => setForm({ ...form, scope_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SCOPES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {form.scope_type === "arena" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Arena</Label>
                  <Select value={form.arena_id} onValueChange={(v) => setForm({ ...form, arena_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                    <SelectContent>
                      {arenas.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Instância WhatsApp</Label>
                <Select value={form.instance_id} onValueChange={(v) => setForm({ ...form, instance_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    {instances.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.display_name || `+${i.phone_number}`} · {i.provider}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} disabled={busy} className="w-full">
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Criar binding
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Network className="h-4 w-4" /> Bindings ativos</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : bindings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum binding configurado. A rede usará o fallback global cadastrado pelo time MoodPlay.
            </p>
          ) : (
            bindings.map((b) => (
              <div key={b.id} className="flex items-center justify-between p-3 rounded-md border border-border bg-muted/20">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase">{b.scope_type}</Badge>
                    {b.arenas?.name && <span className="text-sm font-medium">{b.arenas.name}</span>}
                    {b.scope_type === "tenant" && <span className="text-sm font-medium">Toda a rede</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    → {b.whatsapp_instances?.display_name || `+${b.whatsapp_instances?.phone_number}`}{" "}
                    <span className="opacity-60">({b.whatsapp_instances?.provider})</span>
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(b.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TenantWhatsAppRouting;
