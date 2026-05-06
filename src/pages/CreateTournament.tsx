import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { dashboardPathFor } from "@/lib/dashboardPath";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TagInput } from "@/components/ui/tag-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, Loader2, X, Plus } from "lucide-react";
import { ImageUploadField } from "@/components/shared/ImageUploadField";

interface SlotConfig {
  type: string;
  category: string;
  gender: string;
  slots: number;
  datetime: string;
}

const abbreviate = (text: string) => {
  const map: Record<string, string> = {
    'Masculino': 'Masc', 'Feminino': 'Fem', 'Misto': 'Misto',
    'Iniciante': 'Inic', 'Intermediário': 'Inter', 'Open': 'Open',
    'Duplas': 'Duplas', 'Trios': 'Trios', 'Quartetos': 'Quart',
    'Individual': 'Indiv', 'Equipes': 'Equip',
  };
  return map[text] || text.substring(0, 5);
};

const formatDateShort = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${min}`;
};

const CreateTournament = () => {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromArena = !!searchParams.get("arena_id");
  const backPath = fromArena ? "/arena" : dashboardPathFor(userRole);
  const [loading, setLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [customModality, setCustomModality] = useState(false);

  const [form, setForm] = useState({
    name: "",
    modality: "Vôlei de Praia",
    arena: "",
    zip_code: "",
    address: "",
    address_number: "",
    address_complement: "",
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
    image_url: "",
    match_enabled: true,
  });

  // Builder state (sequential per-gender)
  const [builder, setBuilder] = useState({
    gender: '',
    types: [] as string[],
    categories: [] as string[],
    slots: 16,
    datetime: '',
  });

  const [slotConfig, setSlotConfig] = useState<SlotConfig[]>([]);

  const totalSlots = slotConfig.reduce((sum, s) => sum + s.slots, 0);

  // Builder actions
  const addCombinations = () => {
    if (!builder.gender) {
      toast({ title: "Selecione o gênero", variant: "destructive" });
      return;
    }
    if (builder.types.length === 0) {
      toast({ title: "Adicione pelo menos 1 tipo", variant: "destructive" });
      return;
    }
    if (builder.categories.length === 0) {
      toast({ title: "Adicione pelo menos 1 categoria", variant: "destructive" });
      return;
    }

    const newSlots: SlotConfig[] = [];
    for (const type of builder.types) {
      for (const category of builder.categories) {
        const exists = slotConfig.some(
          (s) => s.type === type && s.category === category && s.gender === builder.gender
        );
        if (!exists) {
          newSlots.push({
            type,
            category,
            gender: builder.gender,
            slots: builder.slots,
            datetime: builder.datetime,
          });
        }
      }
    }

    if (newSlots.length === 0) {
      toast({ title: "Todas as combinações já foram adicionadas", variant: "destructive" });
      return;
    }

    setSlotConfig((prev) => [...prev, ...newSlots]);
    setBuilder({ gender: '', types: [], categories: [], slots: 16, datetime: '' });
    toast({ title: `${newSlots.length} combinação(ões) adicionada(s)!` });
  };

  const updateSlotCount = (index: number, slots: number) => {
    setSlotConfig((prev) => prev.map((item, i) => (i === index ? { ...item, slots } : item)));
  };

  const updateSlotDatetime = (index: number, datetime: string) => {
    setSlotConfig((prev) => prev.map((item, i) => (i === index ? { ...item, datetime } : item)));
  };

  const removeSlot = (index: number) => {
    setSlotConfig((prev) => prev.filter((_, i) => i !== index));
  };

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

    if (!slotConfig || slotConfig.length === 0) {
      toast({
        title: "Adicione ao menos uma categoria",
        description: "O torneio precisa ter pelo menos uma categoria/modalidade configurada.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    // Derive unique arrays from slotConfig
    const genderArr = [...new Set(slotConfig.map((s) => s.gender))];
    const typesArr = [...new Set(slotConfig.map((s) => s.type))];
    const categoriesArr = [...new Set(slotConfig.map((s) => s.category))];

    const { data: created, error } = await supabase.from("tournaments").insert({
      organizer_id: user.id,
      name: form.name,
      modality: form.modality,
      gender: genderArr,
      categories: categoriesArr,
      types: typesArr,
      category: "misto",
      type: "duplas",
      arena: form.arena,
      zip_code: form.zip_code,
      city: form.city,
      state: form.state,
      address: form.address,
      address_number: form.address_number,
      address_complement: form.address_complement,
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
      image_url: form.image_url || null,
      match_enabled: form.match_enabled,
    } as any).select("id, tenant_id").single();

    if (error || !created) {
      setLoading(false);
      toast({ title: "Erro", description: error?.message || "Falha ao criar torneio", variant: "destructive" });
      return;
    }

    // Create one tournament_modalities row per slot_config entry
    const typeMap: Record<string, { type: string; team_size: number }> = {
      "Individual": { type: "individual", team_size: 1 },
      "Duplas": { type: "dupla", team_size: 2 },
      "Trios": { type: "trio", team_size: 3 },
      "Quartetos": { type: "quarteto", team_size: 4 },
    };
    const modalitiesPayload = slotConfig.map((s: any) => {
      const mapped = typeMap[s.type] || { type: String(s.type || "dupla").toLowerCase(), team_size: 2 };
      const startTime = s.datetime ? (s.datetime.includes("T") ? s.datetime.split("T")[1]?.slice(0, 5) : null) : null;
      return {
        tournament_id: created.id,
        tenant_id: created.tenant_id ?? null,
        name: `${s.type} ${s.gender} ${s.category}`.trim(),
        type: mapped.type,
        team_size: mapped.team_size,
        sport: form.modality,
        gender: s.gender,
        level: s.category,
        max_entries: Number(s.slots) || null,
        start_time: startTime,
        status: "open",
        bracket_format: "single_elimination",
        phase: "groups_then_ko",
      };
    });

    if (modalitiesPayload.length > 0) {
      const { error: modErr } = await supabase.from("tournament_modalities").insert(modalitiesPayload);
      if (modErr) {
        console.error("tournament_modalities insert failed:", modErr);
        // Rollback: torneio sem categoria não pode existir
        await supabase.from("tournaments").delete().eq("id", created.id);
        setLoading(false);
        toast({
          title: "Falha ao criar categorias",
          description: `Torneio cancelado. ${modErr.message}`,
          variant: "destructive",
        });
        return;
      }
    }

    setLoading(false);
    toast({ title: "Torneio criado!" });
    navigate("/dashboard");
  };

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-16 items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to={backPath} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
          </Button>
          <Link to={backPath} className="text-2xl font-display text-primary text-glow">🏐 MOOD PLAY</Link>
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

          {/* 1b. Imagem do Torneio */}
          <ImageUploadField
            label="Imagem do Torneio"
            value={form.image_url || null}
            onChange={(url) => update("image_url", url || "")}
            bucket="tournament-images"
            pathPrefix={`tournaments/${user?.id || "anon"}/cover`}
            aspect="16/9"
            helperText="Carregue um arquivo ou cole a URL da imagem (capa/banner)."
          />

          {/* 2. Modalidade */}
          {(() => {
            const PRESETS = ["Vôlei de Praia", "Beach Tennis", "Futevôlei"];
            const isPreset = PRESETS.includes(form.modality);
            const selectValue = isPreset ? form.modality : (form.modality ? "__custom__" : "");
            return (
              <div>
                <Label>Modalidade</Label>
                <Select
                  value={selectValue}
                  onValueChange={(v) => update("modality", v === "__custom__" ? "" : v)}
                >
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {PRESETS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    <SelectItem value="__custom__">Outra (personalizada)</SelectItem>
                  </SelectContent>
                </Select>
                {selectValue === "__custom__" && (
                  <Input
                    className="mt-2"
                    placeholder="Digite a modalidade"
                    value={form.modality}
                    onChange={(e) => update("modality", e.target.value)}
                  />
                )}
              </div>
            );
          })()}

          {/* 3. Builder Sequencial de Categorias */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <Label className="text-base font-semibold">Configurar Categorias por Gênero</Label>
            <p className="text-sm text-muted-foreground">Selecione um gênero, defina tipos e categorias, depois clique em Adicionar.</p>

            {/* Gênero */}
            <div>
              <Label className="text-sm">Gênero</Label>
              <Select value={builder.gender} onValueChange={(v) => setBuilder((b) => ({ ...b, gender: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o gênero" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Masculino">Masculino</SelectItem>
                  <SelectItem value="Feminino">Feminino</SelectItem>
                  <SelectItem value="Misto">Misto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tipos */}
            <div>
              <Label className="text-sm">Tipos</Label>
              <div className="mt-1">
                <TagInput
                  label="tipo"
                  suggestions={["Individual", "Duplas", "Trios", "Quartetos", "Equipes"]}
                  value={builder.types}
                  onChange={(v) => setBuilder((b) => ({ ...b, types: v }))}
                />
              </div>
            </div>

            {/* Categorias */}
            <div>
              <Label className="text-sm">Categorias</Label>
              <div className="mt-1">
                <TagInput
                  label="categoria"
                  suggestions={["Iniciante", "Intermediário", "Open"]}
                  value={builder.categories}
                  onChange={(v) => setBuilder((b) => ({ ...b, categories: v }))}
                />
              </div>
            </div>

            {/* Vagas e Data/Hora */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-sm">Vagas</Label>
                <Input
                  type="number"
                  min={1}
                  value={builder.slots}
                  onChange={(e) => setBuilder((b) => ({ ...b, slots: parseInt(e.target.value) || 1 }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm">Data/Hora</Label>
                <Input
                  type="datetime-local"
                  value={builder.datetime}
                  onChange={(e) => setBuilder((b) => ({ ...b, datetime: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            <Button type="button" variant="secondary" onClick={addCombinations} className="w-full gap-2">
              <Plus className="h-4 w-4" /> Adicionar Categorias
            </Button>
          </div>

          {/* 4. Tabela de Vagas */}
          {slotConfig.length > 0 && (
            <div>
              <Label>Vagas por Categoria</Label>
              <div className="mt-2 rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-2">Tipo</TableHead>
                      <TableHead className="px-2">Gen.</TableHead>
                      <TableHead className="px-2">Cat.</TableHead>
                      <TableHead className="px-2 w-16">Vagas</TableHead>
                      <TableHead className="px-2">Data/Hora</TableHead>
                      <TableHead className="px-1 w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {slotConfig.map((slot, i) => (
                      <TableRow key={`${slot.type}-${slot.category}-${slot.gender}-${i}`}>
                        <TableCell className="text-xs px-2">{abbreviate(slot.type)}</TableCell>
                        <TableCell className="text-xs px-2">{abbreviate(slot.gender)}</TableCell>
                        <TableCell className="text-xs px-2">{abbreviate(slot.category)}</TableCell>
                        <TableCell className="px-2">
                          <Input
                            type="number"
                            min={0}
                            value={slot.slots}
                            onChange={(e) => updateSlotCount(i, parseInt(e.target.value) || 0)}
                            className="h-7 w-14 text-xs px-1"
                          />
                        </TableCell>
                        <TableCell className="px-2">
                          <Input
                            type="datetime-local"
                            value={slot.datetime}
                            onChange={(e) => updateSlotDatetime(i, e.target.value)}
                            className="h-7 text-xs px-1"
                          />
                        </TableCell>
                        <TableCell className="px-1">
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

          {/* 5. Arena */}
          <div>
            <Label>Arena</Label>
            <Input value={form.arena} onChange={(e) => update("arena", e.target.value)} placeholder="Nome da arena" className="mt-1" />
          </div>

          {/* 6. CEP */}
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

          {/* 7. Endereço + Número + Complemento */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-[1fr_100px_1fr]">
            <div>
              <Label>Endereço</Label>
              <Input value={form.address} onChange={(e) => update("address", e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Nº</Label>
              <Input value={form.address_number} onChange={(e) => update("address_number", e.target.value)} placeholder="123" className="mt-1" />
            </div>
            <div>
              <Label>Complemento</Label>
              <Input value={form.address_complement} onChange={(e) => update("address_complement", e.target.value)} placeholder="Bloco A" className="mt-1" />
            </div>
          </div>

          {/* 8. Cidade / Estado */}
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

          {/* 9. Datas */}
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

          {/* 10. Valores */}
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

          {/* 11. Prazo pagamento */}
          <div>
            <Label>Prazo pagamento (dias)</Label>
            <Input type="number" value={form.payment_deadline_days} onChange={(e) => update("payment_deadline_days", e.target.value)} required className="mt-1" />
          </div>

          {/* 12. Regulamento */}
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

          {/* 13. Match */}
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
