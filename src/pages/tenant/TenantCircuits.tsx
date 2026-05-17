import { useEffect, useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Layers, Plus, Loader2, CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/tenant/EmptyState";
import { toast } from "@/hooks/use-toast";

type Circuit = {
  id: string; name: string; description: string | null;
  start_date: string | null; end_date: string | null; is_public: boolean; is_active: boolean;
};

export default function TenantCircuits() {
  const { tenant } = useTenant();
  const [items, setItems] = useState<Circuit[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", start_date: "", end_date: "" });

  const load = async () => {
    if (!tenant?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("circuits" as any)
      .select("*")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false });
    const list = (data ?? []) as Circuit[];
    setItems(list);

    if (list.length > 0) {
      const { data: tCounts } = await supabase
        .from("tournaments")
        .select("circuit_id")
        .in("circuit_id", list.map((c) => c.id));
      const m: Record<string, number> = {};
      (tCounts ?? []).forEach((t: any) => { if (t.circuit_id) m[t.circuit_id] = (m[t.circuit_id] ?? 0) + 1; });
      setCounts(m);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tenant?.id]);

  const handleSave = async () => {
    if (!tenant?.id || !form.name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("circuits" as any).insert({
      tenant_id: tenant.id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    });
    setSaving(false);
    if (error) toast({ title: "Erro ao criar circuito", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Circuito criado" });
      setForm({ name: "", description: "", start_date: "", end_date: "" });
      setOpen(false);
      load();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl text-foreground flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" /> Circuitos
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Sequências de torneios que formam um campeonato da rede.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Novo circuito</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar circuito</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Circuito Verão 2026" /></div>
              <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Início</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                <div><Label>Fim</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
              </div>
              <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="w-full">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Criar circuito
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2].map((i) => <div key={i} className="h-32 bg-muted/40 animate-pulse rounded-lg" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Nenhum circuito ainda"
          description="Crie circuitos para agrupar torneios em sequência e construir campeonatos da rede."
          ctaLabel="Criar primeiro circuito"
          onCta={() => setOpen(true)}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((c) => (
            <Card key={c.id}>
              <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
                <CardTitle className="text-sm font-semibold">{c.name}</CardTitle>
                <Badge variant="outline">{counts[c.id] ?? 0} torneio{(counts[c.id] ?? 0) !== 1 ? "s" : ""}</Badge>
              </CardHeader>
              <CardContent className="space-y-1">
                {c.description && <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>}
                {(c.start_date || c.end_date) && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {c.start_date || "—"} → {c.end_date || "—"}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
