import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ESTADOS_BR = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

const Register = () => {
  const [searchParams] = useSearchParams();
  const isOrganizer = searchParams.get("role") === "organizer";
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    city: "",
    state: "",
    gender: "",
    whatsapp: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: signUpData, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: form.fullName,
          role: isOrganizer ? "organizer" : "athlete",
        },
      },
    });

    if (error) {
      toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Atualizar perfil com campos adicionais
    if (signUpData.user) {
      await supabase.from("profiles").update({
        city: form.city,
        state: form.state,
        gender: form.gender,
        whatsapp: form.whatsapp,
      } as any).eq("user_id", signUpData.user.id);
    }

    setLoading(false);
    toast({ title: "Conta criada!", description: "Verifique seu email para confirmar o cadastro." });
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link to="/" className="text-3xl font-display text-primary text-glow">🏐 MOOD PLAY</Link>
          <h2 className="mt-6 text-3xl font-display text-foreground">
            {isOrganizer ? "CADASTRO ORGANIZADOR" : "CADASTRO ATLETA"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Crie sua conta para {isOrganizer ? "organizar torneios" : "competir"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="fullName">Nome completo *</Label>
            <Input
              id="fullName"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="password">Senha *</Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="city">Cidade *</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="state">Estado *</Label>
              <Select value={form.state} onValueChange={(v) => setForm({ ...form, state: v })} required>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS_BR.map((uf) => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="gender">Gênero *</Label>
            <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })} required>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="masculino">Masculino</SelectItem>
                <SelectItem value="feminino">Feminino</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
                <SelectItem value="prefiro_nao_informar">Prefiro não informar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="whatsapp">WhatsApp *</Label>
            <Input
              id="whatsapp"
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              required
              className="mt-1"
              placeholder="(11) 99999-9999"
            />
          </div>

          <Button
            type="submit"
            className="w-full h-12 text-lg font-bold"
            disabled={loading || !form.state || !form.gender}
          >
            {loading ? "Criando conta..." : "Criar conta"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/login" className="text-primary hover:underline">Entrar</Link>
        </p>

        {isOrganizer ? (
          <p className="text-center text-sm text-muted-foreground">
            Quer competir como atleta?{" "}
            <Link to="/register" className="text-primary hover:underline">Cadastrar como atleta</Link>
          </p>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            Quer organizar torneios?{" "}
            <Link to="/register?role=organizer" className="text-secondary hover:underline">Cadastrar como organizador</Link>
          </p>
        )}
      </div>
    </div>
  );
};

export default Register;
