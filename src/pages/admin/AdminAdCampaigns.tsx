import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Check, X, Pause, Play } from "lucide-react";
import { ImageUploadField } from "@/components/shared/ImageUploadField";

const AdminAdCampaigns = () => {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "", company_id: "", kind: "feed_highlight", title: "",
    image_url: "", link: "", cta_label: "Saiba mais",
    starts_at: "", ends_at: "", priority: "0", slot_id: "",
  });

  const fetchData = async () => {
    setLoading(true);
    const [cRes, sRes, coRes] = await Promise.all([
      supabase.from("ad_campaigns").select("*, ad_placements(*, ad_slots(*))").order("created_at", { ascending: false }),
      supabase.from("ad_slots").select("*").order("code"),
      supabase.from("companies").select("id, name").eq("status", "approved"),
    ]);
    const list = (cRes.data || []) as any[];
    const ids = list.map((c) => c.id);
    let companyMap: Record<string, string> = {};
    if (ids.length) {
      const { data: cos } = await supabase.from("companies").select("id, name").in("id", list.map((c) => c.company_id));
      (cos || []).forEach((c: any) => { companyMap[c.id] = c.name; });
    }
    setCampaigns(list.map((c) => ({ ...c, company_name: companyMap[c.company_id] })));
    setSlots(sRes.data || []);
    setCompanies(coRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const createCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.company_id || !form.starts_at || !form.ends_at || !form.slot_id) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    const { data: comp } = await supabase.from("companies").select("tenant_id").eq("id", form.company_id).maybeSingle();
    const { data: campaign, error } = await supabase.from("ad_campaigns").insert({
      tenant_id: comp?.tenant_id || "00000000-0000-0000-0000-000000000001",
      company_id: form.company_id,
      name: form.name, kind: form.kind, title: form.title || form.name,
      image_url: form.image_url || null, link: form.link || null,
      cta_label: form.cta_label, starts_at: form.starts_at, ends_at: form.ends_at,
      priority: parseInt(form.priority) || 0, status: "active",
    }).select().single();
    if (error || !campaign) { toast({ title: "Erro", description: error?.message, variant: "destructive" }); return; }
    await supabase.from("ad_placements").insert({ campaign_id: campaign.id, slot_id: form.slot_id, weight: 1 });
    toast({ title: "Campanha criada e ativada!" });
    setShowCreate(false);
    setForm({ name: "", company_id: "", kind: "feed_highlight", title: "", image_url: "", link: "", cta_label: "Saiba mais", starts_at: "", ends_at: "", priority: "0", slot_id: "" });
    fetchData();
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("ad_campaigns").update({ status }).eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: `Campanha ${status === 'active' ? 'ativada' : status === 'paused' ? 'pausada' : 'rejeitada'}` }); fetchData(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display">Campanhas de Anúncios</h1>
          <p className="text-sm text-muted-foreground">Gestão de campanhas globais (slots padronizados)</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Nova campanha</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nova campanha</DialogTitle></DialogHeader>
            <form onSubmit={createCampaign} className="space-y-3">
              <div><Label>Nome interno *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div><Label>Empresa *</Label>
                <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Tipo *</Label>
                <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feed_highlight">Destaque Feed</SelectItem>
                    <SelectItem value="tournament_highlight">Destaque Torneios</SelectItem>
                    <SelectItem value="arena_highlight">Destaque Arena</SelectItem>
                    <SelectItem value="marketplace_highlight">Destaque Marketplace</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Slot *</Label>
                <Select value={form.slot_id} onValueChange={(v) => setForm({ ...form, slot_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione um slot" /></SelectTrigger>
                  <SelectContent>{slots.map((s) => <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Título exibido</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <ImageUploadField
                label="Imagem"
                value={form.image_url || null}
                onChange={(url) => setForm({ ...form, image_url: url ?? "" })}
                bucket="company-images"
                pathPrefix="campaigns"
                aspect="16/9"
              />
              <div><Label>Link destino</Label><Input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://..." /></div>
              <div><Label>CTA</Label><Input value={form.cta_label} onChange={(e) => setForm({ ...form, cta_label: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Início *</Label><Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} required /></div>
                <div><Label>Fim *</Label><Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} required /></div>
              </div>
              <div><Label>Prioridade</Label><Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} /></div>
              <Button type="submit" className="w-full">Criar e ativar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? <p className="text-muted-foreground">Carregando...</p> : (
        <div className="grid gap-3">
          {campaigns.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma campanha cadastrada.</p>}
          {campaigns.map((c) => {
            const slot = c.ad_placements?.[0]?.ad_slots;
            return (
              <Card key={c.id}>
                <CardContent className="pt-4 flex items-center gap-4">
                  {c.image_url && <img src={c.image_url} alt="" className="w-16 h-16 rounded object-cover" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{c.name}</span>
                      <Badge variant={c.status === "active" ? "default" : c.status === "paused" ? "secondary" : "outline"}>{c.status}</Badge>
                      <Badge variant="outline">{c.kind}</Badge>
                      {slot && <Badge variant="outline">{slot.code}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{c.company_name} · {new Date(c.starts_at).toLocaleDateString()} → {new Date(c.ends_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-1">
                    {c.status !== "active" && <Button size="sm" variant="outline" onClick={() => updateStatus(c.id, "active")}><Play className="h-3 w-3" /></Button>}
                    {c.status === "active" && <Button size="sm" variant="outline" onClick={() => updateStatus(c.id, "paused")}><Pause className="h-3 w-3" /></Button>}
                    {c.status === "pending" && <Button size="sm" variant="outline" onClick={() => updateStatus(c.id, "rejected")}><X className="h-3 w-3" /></Button>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminAdCampaigns;
