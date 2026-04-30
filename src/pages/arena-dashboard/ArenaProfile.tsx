import { useEffect, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Loader2, Save, Globe, Lock } from "lucide-react";

const MODALITY_OPTIONS = ["Beach Tennis", "Futevôlei", "Vôlei de Praia", "Tênis", "Padel", "Outros"];
const DAYS = [
  { key: "mon", label: "Seg" }, { key: "tue", label: "Ter" }, { key: "wed", label: "Qua" },
  { key: "thu", label: "Qui" }, { key: "fri", label: "Sex" }, { key: "sat", label: "Sáb" }, { key: "sun", label: "Dom" },
];

interface Hours { open?: string; close?: string; closed?: boolean }

const ArenaProfile = () => {
  const { arena } = useOutletContext<{ arena: any }>();
  const [form, setForm] = useState<any>(null);
  const [hours, setHours] = useState<Record<string, Hours>>({});
  const [modalities, setModalities] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [links, setLinks] = useState<any[]>([]);

  useEffect(() => {
    if (!arena) return;
    setForm({
      name: arena.name || "",
      description: arena.description || "",
      address: arena.address || "",
      city: arena.city || "",
      state: arena.state || "",
      zip_code: arena.zip_code || "",
      contact_email: arena.contact_email || "",
      contact_whatsapp: arena.contact_whatsapp || "",
      cover_image_url: arena.cover_image_url || "",
      logo_url: arena.logo_url || "",
      is_public: arena.is_public ?? true,
    });
    setModalities(arena.modalities || []);
    setHours(arena.opening_hours || {});
    (async () => {
      const { data } = await supabase.from("arena_links").select("*").eq("arena_id", arena.id).order("position_order");
      setLinks(data || []);
    })();
  }, [arena]);

  if (!form) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const toggleModality = (m: string) => {
    setModalities((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);
  };

  const setDayHour = (day: string, field: keyof Hours, value: any) => {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  };

  const lookupCep = async (cep: string) => {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const d = await r.json();
      if (d?.logradouro) {
        setForm((f: any) => ({ ...f, address: d.logradouro, city: d.localidade || f.city, state: d.uf || f.state }));
      }
    } catch {}
  };

  const handleSave = async () => {
    if (!arena?.id) return;
    setSaving(true);
    const { error } = await supabase.from("arenas").update({
      name: form.name,
      description: form.description,
      address: form.address,
      city: form.city,
      state: form.state,
      zip_code: form.zip_code,
      contact_email: form.contact_email,
      contact_whatsapp: form.contact_whatsapp,
      cover_image_url: form.cover_image_url || null,
      logo_url: form.logo_url || null,
      is_public: form.is_public,
      modalities,
      opening_hours: hours as any,
    }).eq("id", arena.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar");
      return;
    }
    toast.success("Perfil atualizado");
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <Link to="/arena/dashboard" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar ao painel
        </Link>
        {arena.slug && (
          <a href={`/arenas/${arena.slug}`} target="_blank" rel="noreferrer" className="text-sm inline-flex items-center gap-1 text-primary">
            Ver perfil público <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      <div>
        <h1 className="text-2xl font-display text-foreground">Perfil da arena</h1>
        <p className="text-sm text-muted-foreground">Como sua arena aparece no MoodPlay e nas buscas.</p>
      </div>

      {/* Visibilidade */}
      <Card className="bg-card/60 border-border/40">
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {form.is_public ? <Globe className="h-5 w-5 text-[#2BFF88]" /> : <Lock className="h-5 w-5 text-muted-foreground" />}
            <div>
              <p className="text-sm font-semibold">{form.is_public ? "Perfil público" : "Perfil privado"}</p>
              <p className="text-xs text-muted-foreground">{form.is_public ? "Aparece para todos no MoodPlay" : "Visível só para você e sua equipe"}</p>
            </div>
          </div>
          <Switch checked={form.is_public} onCheckedChange={(v) => setForm({ ...form, is_public: v })} />
        </CardContent>
      </Card>

      {/* Identidade */}
      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Identidade</h2>
          <div className="space-y-2">
            <Label>Nome da arena</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Conte sobre sua arena, infraestrutura, modalidades..." />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>URL do logo</Label>
              <Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label>URL da imagem de capa</Label>
              <Input value={form.cover_image_url} onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })} placeholder="https://..." />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modalidades */}
      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Modalidades</h2>
          <div className="flex flex-wrap gap-2">
            {MODALITY_OPTIONS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => toggleModality(m)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  modalities.includes(m)
                    ? "bg-[#2BFF88]/10 border-[#2BFF88]/40 text-[#2BFF88]"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Endereço */}
      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Endereço</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>CEP</Label>
              <Input value={form.zip_code} onChange={(e) => setForm({ ...form, zip_code: e.target.value })} onBlur={(e) => lookupCep(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Endereço</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Cidade</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>UF</Label>
              <Input maxLength={2} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contato */}
      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Contato</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input value={form.contact_whatsapp} onChange={(e) => setForm({ ...form, contact_whatsapp: e.target.value })} placeholder="(11) 99999-0000" />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
            </div>
          </div>
          {links.length > 0 && (
            <p className="text-xs text-muted-foreground">{links.length} link{links.length !== 1 ? "s" : ""} social{links.length !== 1 ? "is" : ""} cadastrados.</p>
          )}
        </CardContent>
      </Card>

      {/* Horários */}
      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Horários de funcionamento</h2>
          <div className="space-y-2">
            {DAYS.map((d) => {
              const h = hours[d.key] || {};
              return (
                <div key={d.key} className="flex items-center gap-2 text-sm">
                  <div className="w-12 font-medium">{d.label}</div>
                  <Switch checked={!h.closed} onCheckedChange={(v) => setDayHour(d.key, "closed", !v)} />
                  <Input type="time" disabled={h.closed} value={h.open || ""} onChange={(e) => setDayHour(d.key, "open", e.target.value)} className="w-28 h-8" />
                  <span className="text-muted-foreground">até</span>
                  <Input type="time" disabled={h.closed} value={h.close || ""} onChange={(e) => setDayHour(d.key, "close", e.target.value)} className="w-28 h-8" />
                  {h.closed && <span className="text-xs text-muted-foreground ml-2">Fechado</span>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3 sticky bottom-4">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Salvar alterações
        </Button>
      </div>
    </div>
  );
};

export default ArenaProfile;
