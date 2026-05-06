import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil } from "lucide-react";

const ArenaCourts = () => {
  const { arena } = useOutletContext<{ arena: any }>();
  const [courts, setCourts] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCourt, setEditCourt] = useState<any>(null);
  const [form, setForm] = useState({ name: "", price_per_hour: "" });

  const fetchCourts = async () => {
    if (!arena?.id) return;
    const { data } = await supabase.from("courts").select("*").eq("arena_id", arena.id).order("created_at");
    setCourts(data || []);
  };

  useEffect(() => { if (arena) fetchCourts(); }, [arena]);

  const openAdd = () => { setEditCourt(null); setForm({ name: "", price_per_hour: "" }); setDialogOpen(true); };
  const openEdit = (c: any) => { setEditCourt(c); setForm({ name: c.name, price_per_hour: c.price_per_hour?.toString() || "" }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!arena?.id || (arena as any)?.__demo) {
      toast({ title: "Arena não encontrada", description: "Cadastre/conecte uma arena vinculada ao seu usuário antes de criar quadras.", variant: "destructive" });
      return;
    }
    const payload = { name: form.name, price_per_hour: form.price_per_hour ? Number(form.price_per_hour) : null, arena_id: arena.id };
    const { error } = editCourt
      ? await supabase.from("courts").update(payload).eq("id", editCourt.id)
      : await supabase.from("courts").insert(payload);
    if (error) {
      toast({ title: "Erro ao salvar quadra", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editCourt ? "Quadra atualizada" : "Quadra criada" });
    setDialogOpen(false);
    fetchCourts();
  };

  const toggleActive = async (court: any) => {
    const { error } = await supabase.from("courts").update({ is_active: !court.is_active }).eq("id", court.id);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      return;
    }
    fetchCourts();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display text-foreground">Quadras</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>{editCourt ? "Editar quadra" : "Nova quadra"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome da quadra *</Label>
                <Input className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Quadra A" />
              </div>
              <div>
                <Label>Preço por hora (R$)</Label>
                <Input className="mt-1" type="number" value={form.price_per_hour} onChange={(e) => setForm({ ...form, price_per_hour: e.target.value })} placeholder="80.00" />
              </div>
              <Button onClick={handleSave} disabled={!form.name} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {courts.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma quadra cadastrada</p>}

      <div className="space-y-3">
        {courts.map((c) => (
          <Card key={c.id} className="bg-card border-border">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.price_per_hour ? `R$ ${Number(c.price_per_hour).toFixed(2)}/h` : "Sem preço definido"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} />
                <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ArenaCourts;
