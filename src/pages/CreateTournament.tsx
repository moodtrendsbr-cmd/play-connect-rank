import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TagInput } from "@/components/ui/tag-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, Loader2, X } from "lucide-react";

interface SlotConfig {
  type: string;
  category: string;
  gender: string;
  slots: number;
}

const CreateTournament = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  const [form, setForm] = useState({
    name: "",
    modality: "Vôlei de Praia",
    gender: [] as string[],
    types: [] as string[],
    categories: [] as string[],
    arena: "",
    zip_code: "",
    address: "",
    city: "",
    state: "",
    start_date: "",
    end_date: "",
    entry_fee: "",
    entry_fee_2: "",
    entry_fee_3: "",
    payment_deadline_days: "3",
    rules: "",
    rules_file_url: "",
    match_enabled: true,
  });

  const [slotConfig, setSlotConfig] = useState<SlotConfig[]>([]);

  // Generate combinations whenever tags change
  const allCombinations = useMemo(() => {
    const combos: SlotConfig[] = [];
    if (form.types.length === 0 || form.categories.length === 0 || form.gender.length === 0) return combos;
    for (const type of form.types) {
      for (const category of form.categories) {
        for (const gender of form.gender) {
          combos.push({ type, category, gender, slots: 16 });
        }
      }
    }
    return combos;
  }, [form.types, form.categories, form.gender]);

  // Sync slotConfig when combinations change
  useEffect(() => {
    setSlotConfig((prev) => {
      return allCombinations.map((combo) => {
        const existing = prev.find(
          (p) => p.type === combo.type && p.category === combo.category && p.gender === combo.gender
        );
        return existing || combo;
      });
    });
  }, [allCombinations]);

  const updateSlotCount = (index: number, slots: number) => {
    setSlotConfig((prev) => prev.map((item, i) => (i === index ? { ...item, slots } : item)));
  };

  const removeSlot = (index: number) => {
    setSlotConfig((prev) => prev.filter((_, i) => i !== index));
  };

  const totalSlots = slotConfig.reduce((sum, s) => sum + s.slots, 0);

  // CEP lookup
  const handleCepChange = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    setForm((f) => ({ ...f, zip_code: cleanCep }));

    if (cleanCep.length === 8) {
      setCepLoading(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setForm((f) => ({
            ...f,
            city: data.localidade || f.city,
            state: data.uf || f.state,
            address: data.logradouro || f.address,
          }));
        }
      } catch {
        // Allow manual fill
      } finally {
        setCepLoading(false);
      }
    }
  };

  // File upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingFile(true);

    const ext = file.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from("tournament-files").upload(path, file);
    if (error) {
      toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
    } else {
      const { data: urlData } = supabase.storage.from("tournament-files").getPublicUrl(path);
      setForm((f) => ({ ...f, rules_file_url: urlData.publicUrl }));
      toast({ title: "Arquivo enviado!" });
    }
    setUploadingFile(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    const { error } = await supabase.from("tournaments").insert({
      organizer_id: user.id,
      name: form.name,
      modality: form.modality,
      gender: form.gender,
      categories: form.categories,
      types: form.types,
      category: "misto",
      type: "duplas",
      arena: form.arena,
      zip_code: form.zip_code,
      city: form.city,
      state: form.state,
      address: form.address,
      start_date: form.start_date,
      end_date: form.end_date,
      entry_fee: parseFloat(form.entry_fee) || 0,
      entry_fee_2: parseFloat(form.entry_fee_2) || 0,
      entry_fee_3: parseFloat(form.entry_fee_3) || 0,
      max_slots: totalSlots || 16,
      slot_config: slotConfig,
      payment_deadline_days: parseInt(form.payment_deadline_days) || 3,
      rules: form.rules,
      rules_file_url: form.rules_file_url || null,
      match_enabled: form.match_enabled,
    } as any);

    setLoading(false);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Torneio criado!" });
      navigate("/dashboard");
    }
  };

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-16 items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
          </Button>
          <Link to="/dashboard" className="text-2xl font-display text-primary text-glow">🏐 MOOD PLAY</Link>
        </div>
      </header>

      <main className="container max-w-2xl py-8">
        <h1 className="mb-8 text-4xl font-display text-foreground">CRIAR NOVO TORNEIO</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. Nome */}
          <div>
            <Label>Nome do Torneio</Label>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} required className="mt-1" />
          </div>

          {/* 2. Modalidade */}
          <div>
            <Label>Modalidade</Label>
            <Select value={form.modality} onValueChange={(v) => update("modality", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Vôlei de Praia">Vôlei de Praia</SelectItem>
                <SelectItem value="Vôlei de Quadra">Vôlei de Quadra</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 3. Gênero */}
          <div>
            <Label>Gênero</Label>
            <div className="mt-1">
              <TagInput
                label="gênero"
                suggestions={["Masculino", "Feminino", "Misto"]}
                value={form.gender}
                onChange={(v) => setForm((f) => ({ ...f, gender: v }))}
              />
            </div>
          </div>

          {/* 4. Tipo */}
          <div>
            <Label>Tipo</Label>
            <div className="mt-1">
              <TagInput
                label="tipo"
                suggestions={["Individual", "Duplas", "Trios", "Quartetos", "Equipes"]}
                value={form.types}
                onChange={(v) => setForm((f) => ({ ...f, types: v }))}
              />
            </div>
          </div>

          {/* 5. Categoria */}
          <div>
            <Label>Categoria</Label>
            <div className="mt-1">
              <TagInput
                label="categoria"
                suggestions={["Iniciante", "Intermediário", "Open"]}
                value={form.categories}
                onChange={(v) => setForm((f) => ({ ...f, categories: v }))}
              />
            </div>
          </div>

          {/* 6. Vagas por combinação */}
          {slotConfig.length > 0 && (
            <div>
              <Label>Vagas por Categoria</Label>
              <div className="mt-2 rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Gênero</TableHead>
                      <TableHead className="w-24">Vagas</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {slotConfig.map((slot, i) => (
                      <TableRow key={`${slot.type}-${slot.category}-${slot.gender}`}>
                        <TableCell className="text-sm">{slot.type}</TableCell>
                        <TableCell className="text-sm">{slot.category}</TableCell>
                        <TableCell className="text-sm">{slot.gender}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            value={slot.slots}
                            onChange={(e) => updateSlotCount(i, parseInt(e.target.value) || 0)}
                            className="h-8 w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <button type="button" onClick={() => removeSlot(i)} className="text-muted-foreground hover:text-destructive">
                            <X className="h-4 w-4" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Total de vagas: <strong>{totalSlots}</strong></p>
            </div>
          )}

          {/* 7. Arena */}
          <div>
            <Label>Arena</Label>
            <Input value={form.arena} onChange={(e) => update("arena", e.target.value)} placeholder="Nome da arena" className="mt-1" />
          </div>

          {/* 8. CEP */}
          <div>
            <Label>CEP</Label>
            <div className="relative mt-1">
              <Input
                value={form.zip_code}
                onChange={(e) => handleCepChange(e.target.value)}
                placeholder="00000-000"
                maxLength={8}
              />
              {cepLoading && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </div>

          {/* 9. Endereço */}
          <div>
            <Label>Endereço</Label>
            <Input value={form.address} onChange={(e) => update("address", e.target.value)} className="mt-1" />
          </div>

          {/* 10. Cidade / Estado */}
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

          {/* 11. Datas */}
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

          {/* 12-13. Valores */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Valor inscrição (R$)</Label>
              <Input type="number" step="0.01" value={form.entry_fee} onChange={(e) => update("entry_fee", e.target.value)} required className="mt-1" />
            </div>
            <div>
              <Label>Valor 2ª inscrição (R$)</Label>
              <Input type="number" step="0.01" value={form.entry_fee_2} onChange={(e) => update("entry_fee_2", e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Valor 3ª inscrição (R$)</Label>
              <Input type="number" step="0.01" value={form.entry_fee_3} onChange={(e) => update("entry_fee_3", e.target.value)} className="mt-1" />
            </div>
          </div>

          {/* 14. Prazo pagamento */}
          <div>
            <Label>Prazo pagamento (dias)</Label>
            <Input type="number" value={form.payment_deadline_days} onChange={(e) => update("payment_deadline_days", e.target.value)} required className="mt-1" />
          </div>

          {/* 15. Regulamento */}
          <div>
            <Label>Regulamento</Label>
            <Textarea value={form.rules} onChange={(e) => update("rules", e.target.value)} rows={5} className="mt-1" />
            <div className="mt-2 flex items-center gap-3">
              <label className="cursor-pointer">
                <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={handleFileUpload} className="hidden" />
                <span className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors">
                  {uploadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Carregar arquivo
                </span>
              </label>
              {form.rules_file_url && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>✅ Arquivo enviado</span>
                  <button type="button" onClick={() => setForm((f) => ({ ...f, rules_file_url: "" }))} className="text-destructive hover:underline text-xs">
                    Remover
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 16. Match */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
            <div>
              <Label className="text-base">Match (Procurar parceiros)</Label>
              <p className="text-sm text-muted-foreground mt-0.5">Permitir que atletas encontrem duplas/times</p>
            </div>
            <Switch checked={form.match_enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, match_enabled: v }))} />
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
