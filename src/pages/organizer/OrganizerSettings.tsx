import { useState, useEffect } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Percent } from "lucide-react";

const OrganizerSettings = () => {
  const { tenant, settings, refresh } = useTenant();
  const [form, setForm] = useState({
    display_name: "",
    legal_name: "",
    support_email: "",
    support_phone: "",
    primary_color: "#2BFF88",
    secondary_color: "#050708",
    logo_url: "",
    favicon_url: "",
    default_locale: "pt-BR",
    timezone: "America/Sao_Paulo",
  });
  const [saving, setSaving] = useState(false);
  const [splitRules, setSplitRules] = useState<any[]>([]);

  useEffect(() => {
    if (!tenant) return;
    supabase.from("split_rules").select("*").eq("tenant_id", tenant.id).eq("is_active", true).order("source_type")
      .then(({ data }) => setSplitRules(data || []));
  }, [tenant]);

  useEffect(() => {
    if (settings) {
      setForm({
        display_name: settings.display_name || "",
        legal_name: settings.legal_name || "",
        support_email: settings.support_email || "",
        support_phone: settings.support_phone || "",
        primary_color: settings.primary_color || "#2BFF88",
        secondary_color: settings.secondary_color || "#050708",
        logo_url: settings.logo_url || "",
        favicon_url: settings.favicon_url || "",
        default_locale: settings.default_locale || "pt-BR",
        timezone: settings.timezone || "America/Sao_Paulo",
      });
    }
  }, [settings]);

  const handleSave = async () => {
    if (!tenant) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("tenant_settings")
        .upsert({ tenant_id: tenant.id, ...form }, { onConflict: "tenant_id" });
      if (error) throw error;
      toast.success("Configurações salvas");
      await refresh();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Branding, contato e operação do organizador</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Identidade</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nome de exibição</Label>
            <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
          </div>
          <div>
            <Label>Razão social</Label>
            <Input value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Logo URL</Label>
              <Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." />
            </div>
            <div>
              <Label>Favicon URL</Label>
              <Input value={form.favicon_url} onChange={(e) => setForm({ ...form, favicon_url: e.target.value })} placeholder="https://..." />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Cores da marca</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Primária</Label>
              <div className="flex gap-2">
                <Input type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} className="w-16 p-1" />
                <Input value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Secundária</Label>
              <div className="flex gap-2">
                <Input type="color" value={form.secondary_color} onChange={(e) => setForm({ ...form, secondary_color: e.target.value })} className="w-16 p-1" />
                <Input value={form.secondary_color} onChange={(e) => setForm({ ...form, secondary_color: e.target.value })} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Contato e operação</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>E-mail de suporte</Label>
              <Input type="email" value={form.support_email} onChange={(e) => setForm({ ...form, support_email: e.target.value })} />
            </div>
            <div>
              <Label>Telefone de suporte</Label>
              <Input value={form.support_phone} onChange={(e) => setForm({ ...form, support_phone: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Locale</Label>
              <Input value={form.default_locale} onChange={(e) => setForm({ ...form, default_locale: e.target.value })} />
            </div>
            <div>
              <Label>Timezone</Label>
              <Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-4 w-4" /> Regras de Repartição
          </CardTitle>
        </CardHeader>
        <CardContent>
          {splitRules.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma regra ativa. Contate o suporte para configurar.</p>
          ) : (
            <div className="space-y-2">
              {splitRules.map((r) => {
                const labels: Record<string, string> = {
                  enrollment: "Inscrições de torneio",
                  booking: "Reservas de quadra",
                  marketplace_order: "Vendas marketplace",
                  arena_billing_cycle: "Mensalidades arena",
                  sponsorship: "Patrocínios",
                };
                return (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                    <span className="text-sm font-medium">{labels[r.source_type] || r.source_type}</span>
                    <div className="flex gap-2 text-xs">
                      <Badge variant="outline">Plataforma {Number(r.platform_pct).toFixed(0)}%</Badge>
                      <Badge variant="outline">Organizador {Number(r.organizer_pct).toFixed(0)}%</Badge>
                      <Badge variant="outline">Arena {Number(r.arena_pct).toFixed(0)}%</Badge>
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground mt-2">Somente leitura. Contate o admin para alterar.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full md:w-auto">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Salvar alterações
      </Button>
    </div>
  );
};

export default OrganizerSettings;
