import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

const AdminSponsors = () => {
  const [sponsors, setSponsors] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [athletes, setAthletes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ athlete_user_id: "", company_id: "", amount: "0", start_date: "", end_date: "" });

  const fetchData = async () => {
    setLoading(true);
    const [spRes, compRes, athRes] = await Promise.all([
      supabase.from("athlete_sponsors").select("*, companies(name)").order("created_at", { ascending: false }),
      supabase.from("companies").select("id, name").eq("status", "approved"),
      supabase.from("profiles").select("user_id, full_name"),
    ]);
    setSponsors(spRes.data || []);
    setCompanies(compRes.data || []);
    setAthletes(athRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Build athlete name map
  const athleteMap: Record<string, string> = {};
  athletes.forEach((a) => { athleteMap[a.user_id] = a.full_name; });

  const createSponsor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.athlete_user_id || !form.company_id || !form.start_date) return;
    const { error } = await supabase.from("athlete_sponsors").insert({
      athlete_user_id: form.athlete_user_id,
      company_id: form.company_id,
      amount: Number(form.amount),
      start_date: form.start_date,
      end_date: form.end_date || null,
    });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Patrocínio criado!" }); setShowCreate(false); fetchData(); }
  };

  const deleteSponsor = async (id: string) => {
    await supabase.from("athlete_sponsors").delete().eq("id", id);
    fetchData();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-4xl font-display text-foreground">PATROCÍNIOS</h1>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Patrocínio de Atleta</DialogTitle></DialogHeader>
            <form onSubmit={createSponsor} className="space-y-3">
              <div>
                <Label>Atleta *</Label>
                <Select value={form.athlete_user_id} onValueChange={(v) => setForm({ ...form, athlete_user_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{athletes.slice(0, 50).map((a) => <SelectItem key={a.user_id} value={a.user_id}>{a.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Empresa *</Label>
                <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Valor</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Início *</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                <div><Label>Fim</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
              </div>
              <Button type="submit" className="w-full">Criar patrocínio</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? <p className="text-muted-foreground">Carregando...</p> : sponsors.length === 0 ? (
        <p className="text-muted-foreground">Nenhum patrocínio cadastrado</p>
      ) : (
        <div className="space-y-3">
          {sponsors.map((s) => (
            <div key={s.id} className="rounded-lg p-4 flex items-center gap-3" style={{ background: "#0B0F12" }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{athleteMap[s.athlete_user_id] || "Atleta"}</p>
                <p className="text-xs text-muted-foreground">{(s as any).companies?.name} · R$ {Number(s.amount).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">{s.start_date} → {s.end_date || "Indefinido"}</p>
              </div>
              <Button size="sm" variant="destructive" onClick={() => deleteSponsor(s.id)}>Remover</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminSponsors;
