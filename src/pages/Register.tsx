import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, Users, Trophy, Building2, Briefcase, Loader2, ArrowLeft } from "lucide-react";
import { resolveLandingPath } from "@/lib/loginDispatch";

const ESTADOS_BR = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];


type RoleOption = "athlete" | "organizer" | "arena" | "company";

const ROLE_OPTIONS: { value: RoleOption; label: string; icon: typeof Users; desc: string }[] = [
  { value: "athlete", label: "Atleta", icon: Users, desc: "Competir e evoluir" },
  { value: "organizer", label: "Organizador", icon: Trophy, desc: "Criar torneios" },
  { value: "arena", label: "Arena", icon: Building2, desc: "Receber campeonatos" },
  { value: "company", label: "Empresa", icon: Briefcase, desc: "Apoiar o esporte" },
];

const Register = () => {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<RoleOption | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);

  const [form, setForm] = useState({
    fullName: "", email: "", password: "", city: "", state: "", gender: "", whatsapp: "",
    // Arena fields
    arenaName: "", address: "", zipCode: "",
    // Company fields
    companyName: "", cnpj: "", category: "", companyEmail: "", companyWhatsapp: "",
  });

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleCepSearch = async () => {
    const cleaned = form.zipCode.replace(/\D/g, "");
    if (cleaned.length !== 8) {
      toast({ title: "CEP inválido", variant: "destructive" });
      return;
    }
    setLoadingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((f) => ({
          ...f,
          city: data.localidade || f.city,
          state: data.uf || f.state,
          address: [data.logradouro, data.bairro].filter(Boolean).join(", ") || f.address,
        }));
      } else {
        toast({ title: "CEP não encontrado", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao buscar CEP", variant: "destructive" });
    }
    setLoadingCep(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;
    setLoading(true);

    try {
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: form.fullName,
            role: selectedRole === "athlete" ? "athlete" : selectedRole === "organizer" ? "organizer" : selectedRole === "arena" ? "arena" : "company",
          },
        },
      });

      if (error) {
        toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }

      if (signUpData.user) {
        const userId = signUpData.user.id;

        // Update profile
        const profileRes = await supabase.from("profiles").update({
          city: form.city,
          state: form.state,
          gender: selectedRole === "athlete" || selectedRole === "organizer" ? form.gender : null,
          whatsapp: form.whatsapp,
          arena: selectedRole === "arena" ? form.arenaName : null,
        } as any).eq("user_id", userId);
        if (profileRes.error) throw profileRes.error;

        // Create arena record
        if (selectedRole === "arena") {
          const slug = form.arenaName
            .toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "")
            + "-" + Date.now().toString(36);

          const arenaRes = await supabase.from("arenas").insert({
            owner_user_id: userId,
            name: form.arenaName,
            slug,
            city: form.city,
            state: form.state,
            address: form.address || null,
            zip_code: form.zipCode ? form.zipCode.replace(/\D/g, "") : null,
            contact_email: form.email,
            contact_whatsapp: form.whatsapp,
          } as any);
          if (arenaRes.error) throw arenaRes.error;
        }

        // Create company record if empresa
        if (selectedRole === "company") {
          const companyRes = await supabase.from("companies").insert({
            owner_user_id: userId,
            name: form.companyName,
            cnpj: form.cnpj || null,
            category: form.category,
            email: form.companyEmail || form.email,
            whatsapp: form.companyWhatsapp || form.whatsapp,
            city: form.city,
            state: form.state,
            address: form.address,
            zip_code: form.zipCode.replace(/\D/g, ""),
          } as any);
          if (companyRes.error) throw companyRes.error;
        }
      }

      // Detect whether session is active (email-confirm OFF) or not (ON).
      const { data: sessionRes } = await supabase.auth.getSession();
      if (sessionRes.session?.user) {
        toast({ title: "Conta criada!", description: "Bem-vindo." });
        const dest = await resolveLandingPath(sessionRes.session.user.id);
        navigate(dest, { replace: true });
      } else {
        toast({
          title: "Conta criada!",
          description: "Verifique seu email para confirmar antes de entrar.",
        });
        navigate("/login", { replace: true });
      }
    } catch (err: any) {
      // Rollback friendly: sign the half-created session out so the form can be retried.
      try { await supabase.auth.signOut(); } catch { /* ignore */ }
      toast({
        title: "Erro ao criar conta",
        description: err?.message ?? "Tente novamente em instantes.",
        variant: "destructive",
      });
    }

    setLoading(false);
  };

  const needsCep = selectedRole === "arena" || selectedRole === "company";
  const needsGender = selectedRole === "athlete" || selectedRole === "organizer";

  const isFormValid = () => {
    if (!selectedRole || !form.fullName || !form.email || !form.password || !form.city || !form.state || !form.whatsapp) return false;
    if (needsGender && !form.gender) return false;
    if (selectedRole === "arena" && !form.arenaName) return false;
    if (selectedRole === "company" && (!form.companyName || !form.category)) return false;
    return true;
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <div className="text-center">
          <Link to="/" className="text-3xl font-display text-primary text-glow">🏐 MOOD PLAY</Link>
          <h2 className="mt-4 text-2xl font-display text-foreground">CRIAR CONTA</h2>
          <p className="mt-1 text-sm text-muted-foreground">Escolha seu perfil e preencha os dados</p>
        </div>

        {/* Role Selector */}
        <div className="grid grid-cols-2 gap-3">
          {ROLE_OPTIONS.map((role) => {
            const Icon = role.icon;
            const isSelected = selectedRole === role.value;
            return (
              <button
                key={role.value}
                type="button"
                onClick={() => setSelectedRole(role.value)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-4 transition-all ${
                  isSelected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                <Icon className="h-6 w-6" />
                <span className="text-sm font-bold">{role.label}</span>
                <span className="text-[11px] opacity-70">{role.desc}</span>
              </button>
            );
          })}
        </div>

        {selectedRole && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Common Fields */}
            <div>
              <Label htmlFor="fullName">Nome completo *</Label>
              <Input id="fullName" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="password">Senha *</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  required
                  minLength={6}
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* CEP + Address for Arena/Company */}
            {needsCep && (
              <>
                {selectedRole === "arena" && (
                  <div>
                    <Label>Nome da Arena *</Label>
                    <Input value={form.arenaName} onChange={(e) => set("arenaName", e.target.value)} required className="mt-1" placeholder="Nome da arena" />
                  </div>
                )}
                {selectedRole === "company" && (
                  <>
                    <div>
                      <Label>Nome da Empresa *</Label>
                      <Input value={form.companyName} onChange={(e) => set("companyName", e.target.value)} required className="mt-1" placeholder="Nome da empresa" />
                    </div>
                    <div>
                      <Label>CNPJ (caso possua)</Label>
                      <Input value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} className="mt-1" placeholder="00.000.000/0000-00" />
                    </div>
                    <div>
                      <Label>Ramo de Atuação *</Label>
                      <Input value={form.category} onChange={(e) => set("category", e.target.value)} required className="mt-1" placeholder="Ex: Vestuário esportivo, Suplementos..." />
                    </div>
                  </>
                )}
                <div>
                  <Label>CEP</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={form.zipCode}
                      onChange={(e) => set("zipCode", e.target.value.replace(/\D/g, "").substring(0, 8))}
                      placeholder="00000000"
                    />
                    <Button type="button" onClick={handleCepSearch} disabled={loadingCep} variant="outline" size="sm">
                      {loadingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>Endereço</Label>
                  <Input value={form.address} onChange={(e) => set("address", e.target.value)} className="mt-1" placeholder="Rua, nº, bairro" />
                </div>
              </>
            )}

            {/* City / State */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">Cidade *</Label>
                <Input id="city" value={form.city} onChange={(e) => set("city", e.target.value)} required className="mt-1" />
              </div>
              <div>
                <Label htmlFor="state">Estado *</Label>
                <Select value={form.state} onValueChange={(v) => set("state", v)} required>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>
                    {ESTADOS_BR.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Gender for Athlete/Organizer */}
            {needsGender && (
              <div>
                <Label htmlFor="gender">Gênero *</Label>
                <Select value={form.gender} onValueChange={(v) => set("gender", v)} required>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="feminino">Feminino</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                    <SelectItem value="prefiro_nao_informar">Prefiro não informar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="whatsapp">WhatsApp *</Label>
              <Input id="whatsapp" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} required className="mt-1" placeholder="(11) 99999-9999" />
            </div>

            {/* Company extra contacts */}
            {selectedRole === "company" && (
              <>
                <div>
                  <Label>Email da empresa</Label>
                  <Input type="email" value={form.companyEmail} onChange={(e) => set("companyEmail", e.target.value)} className="mt-1" placeholder="contato@empresa.com" />
                </div>
                <div>
                  <Label>WhatsApp da empresa</Label>
                  <Input value={form.companyWhatsapp} onChange={(e) => set("companyWhatsapp", e.target.value)} className="mt-1" placeholder="(11) 99999-9999" />
                </div>
              </>
            )}

            <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={loading || !isFormValid()}>
              {loading ? "Criando conta..." : "Criar conta"}
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/login" className="text-primary hover:underline">Entrar</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
