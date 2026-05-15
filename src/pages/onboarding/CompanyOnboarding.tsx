import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Briefcase } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
  "Equipamentos esportivos",
  "Vestuário esportivo",
  "Suplementação",
  "Academia / Estúdio",
  "Serviços esportivos",
  "Outros",
];

export default function CompanyOnboarding() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!user) return <Navigate to="/login" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Informe o nome da empresa"); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("companies").insert({
        owner_user_id: user.id,
        name: name.trim(),
        category: category || null,
      } as any);
      if (error) throw error;
      toast.success("Empresa criada!");
      navigate("/company/dashboard", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar empresa");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center mb-2">
            <Briefcase className="h-6 w-6" />
          </div>
          <CardTitle>Vamos configurar sua empresa</CardTitle>
          <CardDescription>Preencha o básico para acessar seu painel.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Nome da empresa *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Loja Esportiva XYZ" required />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Criar empresa
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
