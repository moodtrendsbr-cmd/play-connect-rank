import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Save, Settings } from "lucide-react";

const SOURCE_TYPES = ["enrollment", "booking", "arena_billing_cycle", "marketplace_order", "sponsorship"];

const AdminSplitRules = () => {
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [rules, setRules] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: ts } = await supabase.from("tenants").select("id, name, slug").order("name");
      setTenants(ts || []);
      if ((ts || []).length > 0) setSelectedTenant(ts![0].id);
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (!selectedTenant) return;
    const loadRules = async () => {
      const { data } = await supabase
        .from("split_rules")
        .select("*")
        .eq("tenant_id", selectedTenant);
      const map: Record<string, any> = {};
      SOURCE_TYPES.forEach((src) => {
        const existing = (data || []).find((r) => r.source_type === src);
        map[src] = existing || {
          tenant_id: selectedTenant,
          source_type: src,
          platform_pct: 10,
          organizer_pct: 0,
          arena_pct: 0,
          company_pct: 0,
          affiliate_pct: 0,
          is_active: true,
        };
      });
      setRules(map);
    };
    loadRules();
  }, [selectedTenant]);

  const updateRule = (src: string, field: string, value: any) => {
    setRules((prev) => ({ ...prev, [src]: { ...prev[src], [field]: value } }));
  };

  const save = async (src: string) => {
    const r = rules[src];
    const total = Number(r.platform_pct) + Number(r.organizer_pct) + Number(r.arena_pct) + Number(r.company_pct) + Number(r.affiliate_pct);
    if (Math.abs(total - 100) > 0.01) {
      toast.error(`Soma deve ser 100%. Atual: ${total}%`);
      return;
    }
    const { error } = await supabase.from("split_rules").upsert({
      tenant_id: r.tenant_id,
      source_type: r.source_type,
      platform_pct: r.platform_pct,
      organizer_pct: r.organizer_pct,
      arena_pct: r.arena_pct,
      company_pct: r.company_pct,
      affiliate_pct: r.affiliate_pct,
      is_active: r.is_active,
    }, { onConflict: "tenant_id,source_type" });
    if (error) toast.error(error.message);
    else toast.success(`Regra ${src} salva`);
  };

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" /> Regras de Split
        </h1>
        <p className="text-sm text-muted-foreground">Configuração de % por tenant e fonte de receita.</p>
      </div>

      <div>
        <Label>Tenant</Label>
        <Select value={selectedTenant} onValueChange={setSelectedTenant}>
          <SelectTrigger className="max-w-md"><SelectValue /></SelectTrigger>
          <SelectContent>
            {tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} (/{t.slug})</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {SOURCE_TYPES.map((src) => {
        const r = rules[src];
        if (!r) return null;
        const total = Number(r.platform_pct) + Number(r.organizer_pct) + Number(r.arena_pct) + Number(r.company_pct) + Number(r.affiliate_pct);
        return (
          <Card key={src}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base capitalize">{src.replace(/_/g, " ")}</CardTitle>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Ativo</Label>
                  <Switch checked={r.is_active} onCheckedChange={(v) => updateRule(src, "is_active", v)} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {["platform_pct", "organizer_pct", "arena_pct", "company_pct", "affiliate_pct"].map((field) => (
                  <div key={field}>
                    <Label className="text-xs capitalize">{field.replace("_pct", "")}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={r[field]}
                      onChange={(e) => updateRule(src, field, parseFloat(e.target.value) || 0)}
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2">
                <p className={`text-sm ${Math.abs(total - 100) < 0.01 ? "text-primary" : "text-destructive"}`}>
                  Total: {total.toFixed(2)}%
                </p>
                <Button size="sm" onClick={() => save(src)} className="gap-2">
                  <Save className="h-4 w-4" /> Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default AdminSplitRules;
