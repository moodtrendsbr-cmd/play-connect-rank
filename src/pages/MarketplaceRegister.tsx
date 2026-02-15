import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const CATEGORIES = [
  { label: "Vestuário esportivo", value: "vestuario" },
  { label: "Acessórios", value: "acessorios" },
  { label: "Suplementos", value: "suplementos" },
  { label: "Fotografia", value: "fotografia" },
  { label: "Serviços esportivos", value: "servicos" },
  { label: "Locação de quadras", value: "locacao" },
];

const MarketplaceRegister = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", city: "", state: "", email: "", phone: "", category: "", description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { navigate("/login"); return; }
    if (!form.name || !form.category) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("companies").insert({
      owner_user_id: user.id,
      name: form.name,
      city: form.city,
      state: form.state,
      email: form.email,
      phone: form.phone,
      category: form.category,
      description: form.description,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Empresa enviada para análise!", description: "Você será notificado quando for aprovada." });
      navigate("/marketplace/my-company");
    }
  };

  return (
    <main className="pt-4 pb-20 px-4 max-w-xl mx-auto">
      <Link to="/marketplace" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <h1 className="text-2xl font-display text-foreground mb-6">CADASTRAR EMPRESA</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>Nome da empresa *</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome da empresa" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Cidade</Label>
            <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Cidade" />
          </div>
          <div>
            <Label>Estado</Label>
            <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="UF" />
          </div>
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="contato@empresa.com" />
        </div>
        <div>
          <Label>Telefone</Label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(00) 00000-0000" />
        </div>
        <div>
          <Label>Categoria *</Label>
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Descrição</Label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descreva sua empresa..." rows={3} />
        </div>

        <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={loading}>
          {loading ? "Enviando..." : "Enviar para análise"}
        </Button>
      </form>
    </main>
  );
};

export default MarketplaceRegister;
