import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, ExternalLink } from "lucide-react";

const ArenaSponsors = () => {
  const { arena } = useOutletContext<{ arena: any }>();
  const [partners, setPartners] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [invOpen, setInvOpen] = useState(false);
  const [pForm, setPForm] = useState({ name: "", logo_url: "", link_url: "", tier: "basic" });
  const [iForm, setIForm] = useState({ space_type: "banner", description: "", price_monthly: "" });

  const fetch = async () => {
    const [p, i] = await Promise.all([
      supabase.from("arena_partners").select("*").eq("arena_id", arena.id).order("position_order"),
      supabase.from("arena_physical_inventory").select("*").eq("arena_id", arena.id).order("created_at"),
    ]);
    setPartners(p.data || []);
    setInventory(i.data || []);
  };

  useEffect(() => { if (arena) fetch(); }, [arena]);

  const addPartner = async () => {
    await supabase.from("arena_partners").insert({ arena_id: arena.id, ...pForm });
    toast({ title: "Parceiro adicionado" });
    setPartnerOpen(false);
    setPForm({ name: "", logo_url: "", link_url: "", tier: "basic" });
    fetch();
  };

  const removePartner = async (id: string) => {
    await supabase.from("arena_partners").delete().eq("id", id);
    fetch();
  };

  const addInventory = async () => {
    await supabase.from("arena_physical_inventory").insert({
      arena_id: arena.id,
      space_type: iForm.space_type,
      description: iForm.description || null,
      price_monthly: iForm.price_monthly ? Number(iForm.price_monthly) : null,
    });
    toast({ title: "Espaço adicionado" });
    setInvOpen(false);
    setIForm({ space_type: "banner", description: "", price_monthly: "" });
    fetch();
  };

  const toggleAvailable = async (item: any) => {
    await supabase.from("arena_physical_inventory").update({ is_available: !item.is_available }).eq("id", item.id);
    fetch();
  };

  const removeInventory = async (id: string) => {
    await supabase.from("arena_physical_inventory").delete().eq("id", id);
    fetch();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display text-foreground">Patrocínios</h1>

      {/* Partners */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Parceiros / Apoiadores</CardTitle>
          <Dialog open={partnerOpen} onOpenChange={setPartnerOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader><DialogTitle>Novo parceiro</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Nome *</Label><Input className="mt-1" value={pForm.name} onChange={(e) => setPForm({ ...pForm, name: e.target.value })} /></div>
                <div><Label>Logo URL</Label><Input className="mt-1" value={pForm.logo_url} onChange={(e) => setPForm({ ...pForm, logo_url: e.target.value })} /></div>
                <div><Label>Link</Label><Input className="mt-1" value={pForm.link_url} onChange={(e) => setPForm({ ...pForm, link_url: e.target.value })} /></div>
                <div>
                  <Label>Nível</Label>
                  <Select value={pForm.tier} onValueChange={(v) => setPForm({ ...pForm, tier: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Basic</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="elite">Elite</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={addPartner} disabled={!pForm.name} className="w-full">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-2">
          {partners.length === 0 && <p className="text-sm text-muted-foreground">Nenhum parceiro</p>}
          {partners.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2">
                {p.logo_url && <img src={p.logo_url} alt="" className="h-8 w-8 rounded object-cover" />}
                <div>
                  <span className="text-sm font-medium text-foreground">{p.name}</span>
                  <span className="text-xs text-muted-foreground ml-2 capitalize">{p.tier}</span>
                </div>
              </div>
              <div className="flex gap-1">
                {p.link_url && <a href={p.link_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 text-primary" /></a>}
                <Button variant="ghost" size="icon" onClick={() => removePartner(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Physical Inventory */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Espaços físicos</CardTitle>
          <Dialog open={invOpen} onOpenChange={setInvOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader><DialogTitle>Novo espaço</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Tipo *</Label>
                  <Select value={iForm.space_type} onValueChange={(v) => setIForm({ ...iForm, space_type: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mural">Mural</SelectItem>
                      <SelectItem value="banner">Banner</SelectItem>
                      <SelectItem value="placa">Placa</SelectItem>
                      <SelectItem value="backdrop">Backdrop</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Descrição</Label><Input className="mt-1" value={iForm.description} onChange={(e) => setIForm({ ...iForm, description: e.target.value })} /></div>
                <div><Label>Preço mensal (R$)</Label><Input className="mt-1" type="number" value={iForm.price_monthly} onChange={(e) => setIForm({ ...iForm, price_monthly: e.target.value })} /></div>
                <Button onClick={addInventory} className="w-full">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-2">
          {inventory.length === 0 && <p className="text-sm text-muted-foreground">Nenhum espaço cadastrado</p>}
          {inventory.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
              <div>
                <span className="text-sm font-medium text-foreground capitalize">{inv.space_type}</span>
                {inv.description && <span className="text-xs text-muted-foreground ml-2">{inv.description}</span>}
                {inv.price_monthly && <span className="text-xs text-primary ml-2">R$ {Number(inv.price_monthly).toFixed(2)}/mês</span>}
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={inv.is_available} onCheckedChange={() => toggleAvailable(inv)} />
                <Button variant="ghost" size="icon" onClick={() => removeInventory(inv.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default ArenaSponsors;
