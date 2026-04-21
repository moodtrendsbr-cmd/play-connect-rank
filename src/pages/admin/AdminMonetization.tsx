import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { CreditCard, Zap, DollarSign, TrendingUp, Gauge } from "lucide-react";
import { TIER_LABELS, type AutonomyTier } from "@/lib/autonomyTier";

const AUTONOMY_TIERS: AutonomyTier[] = ["free", "growth", "pro", "business", "enterprise"];
const ALL_DOMAINS = ["arena_operations", "growth", "finance", "tournaments"];

const AdminMonetization = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sourceFilter, setSourceFilter] = useState("all");

  const fetchData = async () => {
    setLoading(true);
    const [plansRes, subsRes, ledgerRes, compsRes] = await Promise.all([
      supabase.from("company_plans").select("*").order("monthly_price"),
      supabase.from("subscriptions").select("*, companies(name, city), company_plans(display_name)").order("created_at", { ascending: false }),
      supabase.from("financial_ledger").select("*, companies(name)").order("created_at", { ascending: false }).limit(100),
      supabase.from("companies").select("id, name, billing_status, plan_id").eq("status", "approved"),
    ]);
    setPlans(plansRes.data || []);
    setSubscriptions(subsRes.data || []);
    setLedger(ledgerRes.data || []);
    setCompanies(compsRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const updatePlan = async (id: string, updates: Record<string, any>) => {
    const { error } = await supabase.from("company_plans").update(updates).eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else fetchData();
  };

  const updateSubscription = async (id: string, status: string) => {
    const updates: any = { status };
    if (status === "canceled") updates.canceled_at = new Date().toISOString();
    const { error } = await supabase.from("subscriptions").update(updates).eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Assinatura atualizada!" }); fetchData(); }
  };

  const generateAds = async () => {
    setGenerating(true);
    try {
      const res = await supabase.functions.invoke("generate-sponsored-posts");
      if (res.error) throw res.error;
      toast({ title: "Ads gerados!", description: `${res.data?.generated || 0} posts criados.` });
      fetchData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setGenerating(false);
  };

  const filteredLedger = sourceFilter === "all" ? ledger : ledger.filter((l) => l.source === sourceFilter);
  const totalSubs = ledger.filter((l) => l.source === "subscription").reduce((s, l) => s + Number(l.amount), 0);
  const totalMk = ledger.filter((l) => l.source === "marketplace_order").reduce((s, l) => s + Number(l.mood_share), 0);

  if (loading) return <p className="text-muted-foreground p-6">Carregando...</p>;

  return (
    <div>
      <h1 className="mb-6 text-4xl font-display text-foreground">MONETIZAÇÃO</h1>

      {/* Plans Section */}
      <h2 className="font-display text-lg text-foreground mb-4">PLANOS</h2>
      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        {plans.map((plan) => (
          <Card key={plan.id} className="relative">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CreditCard className="h-5 w-5 text-primary" />
                {plan.display_name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Preço mensal (R$)</label>
                <Input type="number" defaultValue={plan.monthly_price} className="h-8"
                  onBlur={(e) => updatePlan(plan.id, { monthly_price: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Posts patrocinados/mês</label>
                <Input type="number" defaultValue={plan.sponsored_posts_per_month} className="h-8"
                  onBlur={(e) => updatePlan(plan.id, { sponsored_posts_per_month: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Comissão (%)</label>
                <Input type="number" defaultValue={plan.commission_rate} className="h-8"
                  onBlur={(e) => updatePlan(plan.id, { commission_rate: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Max produtos (vazio=ilimitado)</label>
                <Input type="number" defaultValue={plan.max_products ?? ""} className="h-8"
                  onBlur={(e) => updatePlan(plan.id, { max_products: e.target.value ? Number(e.target.value) : null })} />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch checked={plan.banner_feed_enabled} onCheckedChange={(v) => updatePlan(plan.id, { banner_feed_enabled: v })} />
                  Banner no feed
                </label>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch checked={plan.tournament_visibility} onCheckedChange={(v) => updatePlan(plan.id, { tournament_visibility: v })} />
                  Visibilidade torneios
                </label>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch checked={plan.marketplace_highlight} onCheckedChange={(v) => updatePlan(plan.id, { marketplace_highlight: v })} />
                  Destaque marketplace
                </label>
              </div>

              {/* Phase 10: Autonomy / AI Control Tower */}
              <div className="border-t border-border pt-3 mt-2 space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                  <Gauge className="h-3.5 w-3.5 text-primary" />
                  AI Autonomy
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Tier de autonomia</label>
                  <Select
                    value={plan.autonomy_tier ?? "free"}
                    onValueChange={(v) => updatePlan(plan.id, { autonomy_tier: v })}
                  >
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AUTONOMY_TIERS.map((t) => (
                        <SelectItem key={t} value={t}>{TIER_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground">Calls/mês</label>
                    <Input type="number" defaultValue={plan.orkym_calls_limit ?? 0} className="h-8"
                      title="-1 = ilimitado"
                      onBlur={(e) => updatePlan(plan.id, { orkym_calls_limit: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Sugestões</label>
                    <Input type="number" defaultValue={plan.orkym_suggestions_limit ?? 0} className="h-8"
                      onBlur={(e) => updatePlan(plan.id, { orkym_suggestions_limit: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Auto-actions</label>
                    <Input type="number" defaultValue={plan.orkym_auto_actions_limit ?? 0} className="h-8"
                      onBlur={(e) => updatePlan(plan.id, { orkym_auto_actions_limit: Number(e.target.value) })} />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Domínios liberados</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {ALL_DOMAINS.map((d) => {
                      const allowed: string[] = plan.orkym_allowed_domains ?? [];
                      const isOn = allowed.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => {
                            const next = isOn ? allowed.filter((x) => x !== d) : [...allowed, d];
                            updatePlan(plan.id, { orkym_allowed_domains: next });
                          }}
                          className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${
                            isOn
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Subscriptions Section */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg text-foreground">ASSINATURAS</h2>
        <Button size="sm" onClick={generateAds} disabled={generating}>
          <Zap className="h-4 w-4 mr-1" /> {generating ? "Gerando..." : "Gerar ads do mês"}
        </Button>
      </div>

      <Card className="mb-8">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Próx. Cobrança</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell className="font-medium">{(sub as any).companies?.name || "—"}</TableCell>
                  <TableCell>{(sub as any).company_plans?.display_name || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={sub.status === "active" ? "default" : sub.status === "overdue" ? "destructive" : "secondary"}>
                      {sub.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {sub.next_billing_at ? new Date(sub.next_billing_at).toLocaleDateString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {sub.status !== "active" && (
                        <Button size="sm" variant="outline" onClick={() => updateSubscription(sub.id, "active")}>Ativar</Button>
                      )}
                      {sub.status === "active" && (
                        <Button size="sm" variant="outline" onClick={() => updateSubscription(sub.id, "overdue")}>Suspender</Button>
                      )}
                      {sub.status !== "canceled" && (
                        <Button size="sm" variant="destructive" onClick={() => updateSubscription(sub.id, "canceled")}>Cancelar</Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {subscriptions.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma assinatura.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Financial Ledger */}
      <h2 className="font-display text-lg text-foreground mb-4">EXTRATO FINANCEIRO</h2>
      <div className="grid gap-4 sm:grid-cols-3 mb-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium font-sans">Receita Assinaturas</CardTitle>
            <CreditCard className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">R$ {totalSubs.toFixed(2)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium font-sans">Receita Marketplace</CardTitle>
            <DollarSign className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">R$ {totalMk.toFixed(2)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium font-sans">Total Mood Play</CardTitle>
            <TrendingUp className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">R$ {(totalSubs + totalMk).toFixed(2)}</div></CardContent>
        </Card>
      </div>

      <div className="flex gap-2 mb-4">
        {["all", "subscription", "marketplace_order", "sponsorship"].map((s) => (
          <button key={s} onClick={() => setSourceFilter(s)}
            className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
            style={{ background: sourceFilter === s ? "hsl(var(--primary))" : "hsl(var(--muted))", color: sourceFilter === s ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))" }}>
            {s === "all" ? "Todos" : s === "subscription" ? "Assinaturas" : s === "marketplace_order" ? "Marketplace" : "Patrocínio"}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fonte</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Mood Share</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLedger.map((l) => (
                <TableRow key={l.id}>
                  <TableCell><Badge variant="outline">{l.source}</Badge></TableCell>
                  <TableCell>{(l as any).companies?.name || "—"}</TableCell>
                  <TableCell>R$ {Number(l.amount).toFixed(2)}</TableCell>
                  <TableCell>R$ {Number(l.mood_share).toFixed(2)}</TableCell>
                  <TableCell className="text-xs">{new Date(l.created_at).toLocaleDateString("pt-BR")}</TableCell>
                </TableRow>
              ))}
              {filteredLedger.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum registro.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminMonetization;
