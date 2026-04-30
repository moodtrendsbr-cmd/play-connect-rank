import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import { ImageUploadField } from "@/components/shared/ImageUploadField";

const AdminAds = () => {
  const [sponsoredPosts, setSponsoredPosts] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showPartner, setShowPartner] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", image_url: "", city: "", company_id: "", active_from: "", active_to: "" });
  const [partnerForm, setPartnerForm] = useState({ tournament_id: "", company_id: "", position_order: "0" });

  const fetchData = async () => {
    setLoading(true);
    const [spRes, compRes, tourRes, partRes] = await Promise.all([
      supabase.from("sponsored_posts").select("*, companies(name)").order("created_at", { ascending: false }),
      supabase.from("companies").select("id, name").eq("status", "approved"),
      supabase.from("tournaments").select("id, name"),
      supabase.from("tournament_partners").select("*, companies(name), tournaments(name)").order("position_order"),
    ]);
    setSponsoredPosts(spRes.data || []);
    setCompanies(compRes.data || []);
    setTournaments(tourRes.data || []);
    setPartners(partRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const createSponsoredPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.company_id || !form.active_from || !form.active_to) return;
    const { error } = await supabase.from("sponsored_posts").insert({
      title: form.title, content: form.content, image_url: form.image_url || null,
      city: form.city || null, company_id: form.company_id,
      active_from: form.active_from, active_to: form.active_to,
    });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Post patrocinado criado!" }); setShowCreate(false); fetchData(); }
  };

  const createPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerForm.tournament_id || !partnerForm.company_id) return;
    const { error } = await supabase.from("tournament_partners").insert({
      tournament_id: partnerForm.tournament_id, company_id: partnerForm.company_id,
      position_order: Number(partnerForm.position_order),
    });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Parceiro adicionado!" }); setShowPartner(false); fetchData(); }
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("sponsored_posts").update({ active }).eq("id", id);
    fetchData();
  };

  const deletePartner = async (id: string) => {
    await supabase.from("tournament_partners").delete().eq("id", id);
    fetchData();
  };

  return (
    <div>
      <h1 className="mb-6 text-4xl font-display text-foreground">PUBLICIDADE</h1>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg text-foreground">SPONSORED POSTS</h2>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Post Patrocinado</DialogTitle></DialogHeader>
            <form onSubmit={createSponsoredPost} className="space-y-3">
              <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Conteúdo</Label><Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={2} /></div>
              <ImageUploadField
                label="Imagem"
                value={form.image_url || null}
                onChange={(url) => setForm({ ...form, image_url: url ?? "" })}
                bucket="company-images"
                pathPrefix="sponsored-posts"
                aspect="16/9"
              />
              <div><Label>Cidade (deixe vazio para todos)</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
              <div>
                <Label>Empresa *</Label>
                <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Início *</Label><Input type="datetime-local" value={form.active_from} onChange={(e) => setForm({ ...form, active_from: e.target.value })} /></div>
                <div><Label>Fim *</Label><Input type="datetime-local" value={form.active_to} onChange={(e) => setForm({ ...form, active_to: e.target.value })} /></div>
              </div>
              <Button type="submit" className="w-full">Criar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? <p className="text-muted-foreground">Carregando...</p> : (
        <>
          {/* Auto-generated ads awaiting approval */}
          {sponsoredPosts.filter((sp) => !sp.active).length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">⚡ Ads Automáticos (aguardando aprovação)</h3>
              <div className="space-y-2">
                {sponsoredPosts.filter((sp) => !sp.active).map((sp) => (
                  <div key={sp.id} className="rounded-lg p-3 flex items-center gap-3 border border-dashed border-primary/30 bg-card">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{sp.title}</p>
                      <p className="text-xs text-muted-foreground">{(sp as any).companies?.name}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => toggleActive(sp.id, true)}>Aprovar</Button>
                    <Button size="sm" variant="destructive" onClick={async () => {
                      await supabase.from("sponsored_posts").delete().eq("id", sp.id);
                      fetchData();
                    }}>Rejeitar</Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2 mb-8">
            {sponsoredPosts.filter((sp) => sp.active).map((sp) => (
              <div key={sp.id} className="rounded-lg p-3 flex items-center gap-3 bg-card border border-border">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{sp.title}</p>
                  <p className="text-xs text-muted-foreground">{(sp as any).companies?.name}</p>
                </div>
                <Switch checked={sp.active} onCheckedChange={(v) => toggleActive(sp.id, v)} />
              </div>
            ))}
            {sponsoredPosts.length === 0 && <p className="text-sm text-muted-foreground">Nenhum post patrocinado</p>}
          </div>
        </>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg text-foreground">PARCEIROS DE TORNEIO</h2>
        <Dialog open={showPartner} onOpenChange={setShowPartner}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Associar</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Parceiro de Torneio</DialogTitle></DialogHeader>
            <form onSubmit={createPartner} className="space-y-3">
              <div>
                <Label>Torneio *</Label>
                <Select value={partnerForm.tournament_id} onValueChange={(v) => setPartnerForm({ ...partnerForm, tournament_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{tournaments.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Empresa *</Label>
                <Select value={partnerForm.company_id} onValueChange={(v) => setPartnerForm({ ...partnerForm, company_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Ordem</Label><Input type="number" value={partnerForm.position_order} onChange={(e) => setPartnerForm({ ...partnerForm, position_order: e.target.value })} /></div>
              <Button type="submit" className="w-full">Associar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {partners.map((p) => (
          <div key={p.id} className="rounded-lg p-3 flex items-center gap-3" style={{ background: "#0B0F12" }}>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">{(p as any).companies?.name} → {(p as any).tournaments?.name}</p>
            </div>
            <Button size="sm" variant="destructive" onClick={() => deletePartner(p.id)}>Remover</Button>
          </div>
        ))}
        {partners.length === 0 && <p className="text-sm text-muted-foreground">Nenhum parceiro cadastrado</p>}
      </div>
    </div>
  );
};

export default AdminAds;
