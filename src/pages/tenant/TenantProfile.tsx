import { useEffect, useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Globe, Save, Image as ImageIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Branding = {
  description?: string;
  logo_url?: string;
  hero_url?: string;
  cities?: string;
};

export default function TenantProfile() {
  const { tenant, refresh } = useTenant();
  const [form, setForm] = useState<Branding>({ description: "", logo_url: "", hero_url: "", cities: "" });
  const [counts, setCounts] = useState({ arenas: 0, organizers: 0, sponsors: 0, tournaments: 0 });
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);

  useEffect(() => {
    if (!tenant) return;
    const b = (tenant as any).branding ?? {};
    setForm({
      description: b.description ?? "",
      logo_url: b.logo_url ?? "",
      hero_url: b.hero_url ?? "",
      cities: b.cities ?? "",
    });
    (async () => {
      const [a, o, s, t] = await Promise.all([
        supabase.from("arenas").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
        supabase.from("tenant_memberships").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
        supabase.from("sponsor_arena_links" as any).select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
        supabase.from("tournaments").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
      ]);
      setCounts({
        arenas: a.count ?? 0,
        organizers: o.count ?? 0,
        sponsors: s.count ?? 0,
        tournaments: t.count ?? 0,
      });
    })();
  }, [tenant?.id]);

  const uploadImage = async (file: File, kind: "logo" | "hero") => {
    if (!tenant) return;
    const setUp = kind === "logo" ? setUploadingLogo : setUploadingHero;
    setUp(true);
    const path = `tenants/${tenant.id}/${kind}-${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("arena-assets").upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
      setUp(false); return;
    }
    const { data } = supabase.storage.from("arena-assets").getPublicUrl(path);
    setForm((f) => ({ ...f, [kind === "logo" ? "logo_url" : "hero_url"]: data.publicUrl }));
    setUp(false);
  };

  const handleSave = async () => {
    if (!tenant) return;
    setSaving(true);
    const branding = { ...((tenant as any).branding ?? {}), ...form };
    const { error } = await supabase.from("tenants").update({ branding }).eq("id", tenant.id);
    setSaving(false);
    if (error) toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    else { toast({ title: "Perfil atualizado" }); refresh(); }
  };

  if (!tenant) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-foreground flex items-center gap-2">
          <Globe className="h-6 w-6 text-primary" /> Perfil da rede
        </h1>
        <p className="text-xs text-muted-foreground mt-1">A vitrine pública da sua rede esportiva.</p>
      </div>

      {/* Hero preview */}
      <Card className="overflow-hidden">
        <div
          className="h-44 bg-muted relative bg-center bg-cover"
          style={form.hero_url ? { backgroundImage: `url(${form.hero_url})` } : undefined}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
          <div className="absolute bottom-3 left-3 flex items-center gap-3">
            {form.logo_url ? (
              <img src={form.logo_url} alt="Logo" className="h-14 w-14 rounded-lg object-cover border-2 border-background" />
            ) : (
              <div className="h-14 w-14 rounded-lg bg-card border-2 border-background flex items-center justify-center">
                <Globe className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div>
              <h2 className="text-xl font-display text-foreground">{tenant.name}</h2>
              <p className="text-xs text-muted-foreground">/{tenant.slug}</p>
            </div>
          </div>
        </div>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
          <div className="text-center"><p className="text-xl font-semibold tabular-nums">{counts.arenas}</p><p className="text-[11px] text-muted-foreground">arenas</p></div>
          <div className="text-center"><p className="text-xl font-semibold tabular-nums">{counts.organizers}</p><p className="text-[11px] text-muted-foreground">organizadores</p></div>
          <div className="text-center"><p className="text-xl font-semibold tabular-nums">{counts.sponsors}</p><p className="text-[11px] text-muted-foreground">patrocínios</p></div>
          <div className="text-center"><p className="text-xl font-semibold tabular-nums">{counts.tournaments}</p><p className="text-[11px] text-muted-foreground">torneios</p></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Identidade visual</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="flex items-center gap-2">
                <Input type="file" accept="image/*" disabled={uploadingLogo}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, "logo"); }} />
                {uploadingLogo && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Imagem de capa (hero)</Label>
              <div className="flex items-center gap-2">
                <Input type="file" accept="image/*" disabled={uploadingHero}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, "hero"); }} />
                {uploadingHero && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
            </div>
          </div>

          <div>
            <Label>Descrição da rede</Label>
            <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Conte para o público quem é sua rede esportiva, sua missão e diferenciais." />
          </div>

          <div>
            <Label>Cidades atendidas</Label>
            <Input value={form.cities} onChange={(e) => setForm({ ...form, cities: e.target.value })}
              placeholder="Ex: São Paulo, Rio de Janeiro, Belo Horizonte" />
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar perfil
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
