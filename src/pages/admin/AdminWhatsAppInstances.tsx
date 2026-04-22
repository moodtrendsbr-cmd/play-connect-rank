import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Loader2, Phone, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface Instance {
  id: string;
  provider: string;
  display_name: string | null;
  phone_number: string;
  status: string;
  is_global_fallback: boolean;
  external_instance_id: string | null;
  created_at: string;
}

const PROVIDERS = [
  { value: "mock", label: "Mock (dev)" },
  { value: "twilio", label: "Twilio" },
  { value: "meta", label: "Meta WhatsApp Business" },
  { value: "evolution", label: "Evolution API" },
];

const STATUSES = [
  { value: "active", label: "Ativa" },
  { value: "paused", label: "Pausada" },
  { value: "revoked", label: "Revogada" },
];

const AdminWhatsAppInstances = () => {
  const [items, setItems] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    provider: "mock",
    display_name: "",
    phone_number: "",
    external_instance_id: "",
    is_global_fallback: false,
    status: "active",
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("whatsapp_instances")
      .select("id,provider,display_name,phone_number,status,is_global_fallback,external_instance_id,created_at")
      .order("created_at", { ascending: false });
    setItems((data as Instance[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    const phone = form.phone_number.replace(/\D/g, "");
    if (phone.length < 10) {
      toast.error("Número inválido (use formato E.164 sem +)");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("whatsapp_instances").insert({
      provider: form.provider,
      display_name: form.display_name || null,
      phone_number: phone,
      external_instance_id: form.external_instance_id || null,
      is_global_fallback: form.is_global_fallback,
      status: form.status,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Instância criada");
    setOpen(false);
    setForm({ provider: "mock", display_name: "", phone_number: "", external_instance_id: "", is_global_fallback: false, status: "active" });
    load();
  };

  const toggleStatus = async (inst: Instance, status: string) => {
    const { error } = await supabase.from("whatsapp_instances").update({ status }).eq("id", inst.id);
    if (error) return toast.error(error.message);
    toast.success(`Instância ${status === "active" ? "ativada" : "pausada"}`);
    load();
  };

  const setFallback = async (inst: Instance) => {
    // Apenas uma fallback global
    await supabase.from("whatsapp_instances").update({ is_global_fallback: false }).neq("id", inst.id);
    const { error } = await supabase.from("whatsapp_instances").update({ is_global_fallback: true }).eq("id", inst.id);
    if (error) return toast.error(error.message);
    toast.success("Fallback global atualizado");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-glow">Instâncias WhatsApp</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Canais físicos disponíveis para ORKYM rotear mensagens (inbound + outbound).
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Nova instância</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Cadastrar instância</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Provider</Label>
                <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nome de exibição</Label>
                <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="Arena Praia Grande WA" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Número (E.164 sem +)</Label>
                <Input value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value.replace(/\D/g, "") })} placeholder="5511999999999" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">External ID (opcional)</Label>
                <Input value={form.external_instance_id} onChange={(e) => setForm({ ...form, external_instance_id: e.target.value })} placeholder="WA-ID na Twilio/Meta" />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border p-2">
                <Label className="text-xs">Fallback global</Label>
                <Switch checked={form.is_global_fallback} onCheckedChange={(v) => setForm({ ...form, is_global_fallback: v })} />
              </div>
              <Button onClick={handleCreate} disabled={busy} className="w-full">
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Criar instância
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Canais cadastrados</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma instância cadastrada ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fallback</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.display_name || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">+{i.phone_number}</TableCell>
                    <TableCell><Badge variant="outline">{i.provider}</Badge></TableCell>
                    <TableCell>
                      <Select value={i.status} onValueChange={(v) => toggleStatus(i, v)}>
                        <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {i.is_global_fallback ? (
                        <Badge className="bg-primary/15 text-primary border-primary/30">
                          <ShieldCheck className="h-3 w-3 mr-1" /> Global
                        </Badge>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => setFallback(i)}>Definir</Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" disabled>
                        <Phone className="h-3 w-3 mr-1" /> Testar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminWhatsAppInstances;
