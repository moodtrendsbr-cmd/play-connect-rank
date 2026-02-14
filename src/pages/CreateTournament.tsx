import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

const CreateTournament = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "misto" as "masculino" | "feminino" | "misto",
    type: "individual" as "individual" | "duplas" | "equipes",
    city: "",
    state: "",
    address: "",
    start_date: "",
    end_date: "",
    entry_fee: "",
    max_slots: "16",
    payment_deadline_days: "3",
    rules: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    const { error } = await supabase.from("tournaments").insert({
      organizer_id: user.id,
      name: form.name,
      category: form.category,
      type: form.type,
      city: form.city,
      state: form.state,
      address: form.address,
      start_date: form.start_date,
      end_date: form.end_date,
      entry_fee: parseFloat(form.entry_fee) || 0,
      max_slots: parseInt(form.max_slots) || 16,
      payment_deadline_days: parseInt(form.payment_deadline_days) || 3,
      rules: form.rules,
    });

    setLoading(false);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Torneio criado!" });
      navigate("/dashboard");
    }
  };

  const update = (field: string, value: string) => setForm({ ...form, [field]: value });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-16 items-center">
          <Link to="/dashboard" className="text-2xl font-display text-primary text-glow">🏐 MOOD PLAY</Link>
        </div>
      </header>

      <main className="container max-w-2xl py-8">
        <h1 className="mb-8 text-4xl font-display text-foreground">CRIAR NOVO TORNEIO</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label>Nome do Torneio</Label>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} required className="mt-1" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => update("category", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="masculino">Masculino</SelectItem>
                  <SelectItem value="feminino">Feminino</SelectItem>
                  <SelectItem value="misto">Misto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => update("type", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="duplas">Duplas</SelectItem>
                  <SelectItem value="equipes">Equipes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Cidade</Label>
              <Input value={form.city} onChange={(e) => update("city", e.target.value)} required className="mt-1" />
            </div>
            <div>
              <Label>Estado</Label>
              <Input value={form.state} onChange={(e) => update("state", e.target.value)} required className="mt-1" />
            </div>
          </div>

          <div>
            <Label>Endereço</Label>
            <Input value={form.address} onChange={(e) => update("address", e.target.value)} className="mt-1" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Data início</Label>
              <Input type="date" value={form.start_date} onChange={(e) => update("start_date", e.target.value)} required className="mt-1" />
            </div>
            <div>
              <Label>Data fim</Label>
              <Input type="date" value={form.end_date} onChange={(e) => update("end_date", e.target.value)} required className="mt-1" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Valor inscrição (R$)</Label>
              <Input type="number" step="0.01" value={form.entry_fee} onChange={(e) => update("entry_fee", e.target.value)} required className="mt-1" />
            </div>
            <div>
              <Label>Vagas totais</Label>
              <Input type="number" value={form.max_slots} onChange={(e) => update("max_slots", e.target.value)} required className="mt-1" />
            </div>
            <div>
              <Label>Prazo pagamento (dias)</Label>
              <Input type="number" value={form.payment_deadline_days} onChange={(e) => update("payment_deadline_days", e.target.value)} required className="mt-1" />
            </div>
          </div>

          <div>
            <Label>Regulamento</Label>
            <Textarea value={form.rules} onChange={(e) => update("rules", e.target.value)} rows={5} className="mt-1" />
          </div>

          <Button type="submit" className="w-full h-12 text-lg font-bold box-glow" disabled={loading}>
            {loading ? "Criando..." : "🟢 Criar Torneio"}
          </Button>
        </form>
      </main>
    </div>
  );
};

export default CreateTournament;
