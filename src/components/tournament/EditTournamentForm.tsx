import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TagInput } from "@/components/ui/tag-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Upload, Loader2, X, Plus, Save } from "lucide-react";

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

interface EditTournamentFormProps {
  tournament: any;
  userId: string;
  onSaved: (updated: any) => void;
}

const EditTournamentForm = ({ tournament, userId, onSaved }: EditTournamentFormProps) => {
  const [loading, setLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const PRESET_MODALITIES = ["Vôlei de Praia", "Beach Tennis", "Futevôlei"];
  const [customModality, setCustomModality] = useState(
    !!tournament.modality && !PRESET_MODALITIES.includes(tournament.modality)
  );

  const [form, setForm] = useState({
    name: tournament.name || "",
    modality: tournament.modality || "Vôlei de Praia",
    arena: tournament.arena || "",
    zip_code: tournament.zip_code || "",
    address: tournament.address || "",
    address_number: tournament.address_number || "",
    address_complement: tournament.address_complement || "",
    city: tournament.city || "",
    state: tournament.state || "",
    start_date: tournament.start_date || "",
    end_date: tournament.end_date || "",
    entry_fee: String(tournament.entry_fee ?? ""),
    entry_fee_2: String(tournament.entry_fee_2 ?? ""),
    entry_fee_3: String(tournament.entry_fee_3 ?? ""),
    payment_deadline_days: String(tournament.payment_deadline_days ?? "3"),
    rules: tournament.rules || "",
    rules_file_url: tournament.rules_file_url || "",
    match_enabled: tournament.match_enabled ?? true,
    split_platform: String(tournament.default_split_config?.platform_pct ?? ""),
    split_organizer: String(tournament.default_split_config?.organizer_pct ?? ""),
    split_arena: String(tournament.default_split_config?.arena_pct ?? ""),
    circuit_id: tournament.circuit_id || "",
  });

  const [circuits, setCircuits] = useState<{ id: string; name: string }[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [newCircuitName, setNewCircuitName] = useState("");
  const [creatingCircuit, setCreatingCircuit] = useState(false);

  useEffect(() => {
    (async () => {
      if (!userId) return;
      const { data: mem } = await (supabase as any).from("tenant_memberships").select("tenant_id").eq("user_id", userId).limit(1).maybeSingle();
      const tId = (mem as any)?.tenant_id;
      if (!tId) return;
      setTenantId(tId);
      const { data } = await supabase.from("circuits" as any).select("id, name").eq("tenant_id", tId).order("created_at", { ascending: false });
      setCircuits(((data ?? []) as any[]).map((c) => ({ id: c.id, name: c.name })));
    })();
  }, [userId]);

  const handleCreateCircuit = async () => {
    if (!tenantId || !newCircuitName.trim()) return;
    setCreatingCircuit(true);
    const { data, error } = await (supabase as any).from("circuits").insert({ tenant_id: tenantId, name: newCircuitName.trim() }).select("id, name").single();
    setCreatingCircuit(false);
    if (error) { toast({ title: "Erro ao criar circuito", description: error.message, variant: "destructive" }); return; }
    setCircuits((p) => [{ id: data.id, name: data.name }, ...p]);
    setForm((f) => ({ ...f, circuit_id: data.id }));
    setNewCircuitName("");
    toast({ title: "Circuito criado" });
  };

  const [slotConfig, setSlotConfig] = useState<SlotConfig[]>(
    Array.isArray(tournament.slot_config) ? tournament.slot_config : []
  );

  const [builder, setBuilder] = useState({
    gender: '',
    types: [] as string[],
    categories: [] as string[],
    slots: 16,
    datetime: '',
  });

  const totalSlots = slotConfig.reduce((sum, s) => sum + s.slots, 0);

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
          newSlots.push({ type, category, gender: builder.gender, slots: builder.slots, datetime: builder.datetime });
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
      } catch { /* allow manual */ } finally {
        setCepLoading(false);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    const ext = file.name.split(".").pop();
    const path = `${userId}/${Date.now()}.${ext}`;
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

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    setLoading(true);

    const genderArr = [...new Set(slotConfig.map((s) => s.gender))];
    const typesArr = [...new Set(slotConfig.map((s) => s.type))];
    const categoriesArr = [...new Set(slotConfig.map((s) => s.category))];

    const { data, error } = await supabase.from("tournaments").update({
      name: form.name,
      modality: form.modality,
      gender: genderArr,
      categories: categoriesArr,
      types: typesArr,
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
      max_slots: totalSlots || tournament.max_slots,
      slot_config: slotConfig,
      payment_deadline_days: parseInt(form.payment_deadline_days) || 3,
      rules: form.rules,
      rules_file_url: form.rules_file_url || null,
      match_enabled: form.match_enabled,
      default_split_config: (form.split_platform || form.split_organizer || form.split_arena)
        ? {
            platform_pct: parseFloat(form.split_platform) || 0,
            organizer_pct: parseFloat(form.split_organizer) || 0,
            arena_pct: parseFloat(form.split_arena) || 0,
          }
        : null,
    } as any).eq("id", tournament.id).select("*").single();

    setLoading(false);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Torneio atualizado!" });
      if (data) onSaved(data);
    }
  };

  return (
    <div className="space-y-6">
      {/* Nome */}
      <div>
        <Label>Nome do Torneio</Label>
        <Input value={form.name} onChange={(e) => update("name", e.target.value)} className="mt-1" />
      </div>

      {/* Modalidade */}
      {(() => {
        const isPreset = PRESET_MODALITIES.includes(form.modality);
        const showCustom = customModality || (!isPreset && !!form.modality);
        const selectValue = showCustom ? "__custom__" : (isPreset ? form.modality : "");
        return (
          <div>
            <Label>Modalidade</Label>
            <Select
              value={selectValue}
              onValueChange={(v) => {
                if (v === "__custom__") {
                  setCustomModality(true);
                  update("modality", "");
                } else {
                  setCustomModality(false);
                  update("modality", v);
                }
              }}
            >
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {PRESET_MODALITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                <SelectItem value="__custom__">Outra (personalizada)</SelectItem>
              </SelectContent>
            </Select>
            {showCustom && (
              <Input
                className="mt-2"
                placeholder="Digite a modalidade"
                value={form.modality}
                onChange={(e) => update("modality", e.target.value)}
                autoFocus
              />
            )}
          </div>
        );
      })()}

      {/* Builder Sequencial de Categorias */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <Label className="text-base font-semibold">Configurar Categorias por Gênero</Label>
        <p className="text-sm text-muted-foreground">Selecione um gênero, defina tipos e categorias, depois clique em Adicionar.</p>

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

      {/* Tabela de Vagas */}
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

      {/* Arena */}
      <div>
        <Label>Arena</Label>
        <Input value={form.arena} onChange={(e) => update("arena", e.target.value)} placeholder="Nome da arena" className="mt-1" />
      </div>

      {/* CEP */}
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

      {/* Endereço + Número + Complemento */}
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

      {/* Cidade / Estado */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Cidade</Label>
          <Input value={form.city} onChange={(e) => update("city", e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Estado</Label>
          <Input value={form.state} onChange={(e) => update("state", e.target.value)} className="mt-1" />
        </div>
      </div>

      {/* Datas */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Data início</Label>
          <Input type="date" value={form.start_date} onChange={(e) => update("start_date", e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Data fim</Label>
          <Input type="date" value={form.end_date} onChange={(e) => update("end_date", e.target.value)} className="mt-1" />
        </div>
      </div>

      {/* Valores */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label>Valor inscrição (R$)</Label>
          <Input type="number" step="0.01" value={form.entry_fee} onChange={(e) => update("entry_fee", e.target.value)} className="mt-1" />
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

      {/* Prazo pagamento */}
      <div>
        <Label>Prazo pagamento (dias)</Label>
        <Input type="number" value={form.payment_deadline_days} onChange={(e) => update("payment_deadline_days", e.target.value)} className="mt-1" />
      </div>

      {/* Regulamento */}
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

      {/* Match */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
        <div>
          <Label className="text-base">Match (Procurar parceiros)</Label>
          <p className="text-sm text-muted-foreground mt-0.5">Permitir que atletas encontrem duplas/times</p>
        </div>
        <Switch checked={form.match_enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, match_enabled: v }))} />
      </div>

      {/* Split Override */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div>
          <Label className="text-base">Override de Repartição (opcional)</Label>
          <p className="text-sm text-muted-foreground mt-0.5">Deixe em branco para herdar as regras do tenant. Soma dos % deve dar 100.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Plataforma %</Label>
            <Input type="number" step="0.01" min={0} max={100} value={form.split_platform} onChange={(e) => update("split_platform", e.target.value)} className="mt-1" placeholder="10" />
          </div>
          <div>
            <Label className="text-xs">Organizador %</Label>
            <Input type="number" step="0.01" min={0} max={100} value={form.split_organizer} onChange={(e) => update("split_organizer", e.target.value)} className="mt-1" placeholder="80" />
          </div>
          <div>
            <Label className="text-xs">Arena %</Label>
            <Input type="number" step="0.01" min={0} max={100} value={form.split_arena} onChange={(e) => update("split_arena", e.target.value)} className="mt-1" placeholder="10" />
          </div>
        </div>
      </div>

      <Button onClick={handleSave} className="w-full h-12 text-lg font-bold box-glow gap-2" disabled={loading}>
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
        {loading ? "Salvando..." : "Salvar Alterações"}
      </Button>
    </div>
  );
};

export default EditTournamentForm;
