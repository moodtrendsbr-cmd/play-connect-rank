import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

const AdminCompanies = () => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const [compQuery, plansRes] = await Promise.all([
      (() => {
        let q = supabase.from("companies").select("*, company_plans(display_name)").order("created_at", { ascending: false });
        if (statusFilter !== "all") q = q.eq("status", statusFilter);
        return q;
      })(),
      supabase.from("company_plans").select("*").order("monthly_price"),
    ]);
    setCompanies(compQuery.data || []);
    setPlans(plansRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [statusFilter]);

  const updateCompany = async (id: string, updates: Record<string, any>) => {
    const { error } = await supabase.from("companies").update(updates).eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Atualizado!" }); fetchData(); }
  };

  const assignPlan = async (companyId: string, planId: string) => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;

    // Update company
    await supabase.from("companies").update({
      plan_id: planId,
      commission_rate: plan.commission_rate,
      billing_status: plan.monthly_price > 0 ? "active" : "none",
      highlight_enabled: plan.marketplace_highlight,
      feed_ads_enabled: plan.banner_feed_enabled,
      tournament_visibility: plan.tournament_visibility,
    }).eq("id", companyId);

    // Upsert subscription
    if (plan.monthly_price > 0) {
      const nextBilling = new Date();
      nextBilling.setDate(nextBilling.getDate() + 30);

      // Delete existing then insert (upsert workaround)
      await supabase.from("subscriptions").delete().eq("company_id", companyId);
      await supabase.from("subscriptions").insert({
        company_id: companyId,
        plan_id: planId,
        status: "active",
        next_billing_at: nextBilling.toISOString(),
      });
    } else {
      await supabase.from("subscriptions").delete().eq("company_id", companyId);
    }

    toast({ title: "Plano atribuído!" });
    fetchData();
  };

  return (
    <div>
      <h1 className="mb-6 text-4xl font-display text-foreground">EMPRESAS</h1>

      <div className="flex gap-2 mb-4">
        {["all", "pending_approval", "approved", "blocked"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
            style={{ background: statusFilter === s ? "hsl(var(--primary))" : "hsl(var(--muted))", color: statusFilter === s ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))" }}
          >
            {s === "all" ? "Todas" : s === "pending_approval" ? "Pendentes" : s === "approved" ? "Aprovadas" : "Bloqueadas"}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : companies.length === 0 ? (
        <p className="text-muted-foreground">Nenhuma empresa encontrada</p>
      ) : (
        <div className="space-y-4">
          {companies.map((c) => (
            <div key={c.id} className="rounded-lg p-4 bg-card border border-border">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-medium text-foreground">{c.name}</h3>
                  <p className="text-xs text-muted-foreground">{c.city}{c.state ? `, ${c.state}` : ""} · {c.category} · {c.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {c.billing_status && c.billing_status !== "none" && (
                    <Badge variant={c.billing_status === "active" ? "default" : c.billing_status === "overdue" ? "destructive" : "secondary"}>
                      {c.billing_status}
                    </Badge>
                  )}
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{
                    background: c.status === "approved" ? "rgba(43,255,136,0.1)" : c.status === "blocked" ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)",
                    color: c.status === "approved" ? "#2BFF88" : c.status === "blocked" ? "#EF4444" : "#F59E0B",
                  }}>
                    {c.status}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {c.status !== "approved" && (
                  <Button size="sm" onClick={() => updateCompany(c.id, { status: "approved" })} className="bg-primary text-primary-foreground">Aprovar</Button>
                )}
                {c.status !== "blocked" && (
                  <Button size="sm" variant="destructive" onClick={() => updateCompany(c.id, { status: "blocked" })}>Bloquear</Button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <label className="text-xs text-muted-foreground">Plano</label>
                  <Select value={c.plan_id || ""} onValueChange={(v) => assignPlan(c.id, v)}>
                    <SelectTrigger className="h-8"><SelectValue placeholder={c.company_plans?.display_name || "Nenhum"} /></SelectTrigger>
                    <SelectContent>
                      {plans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.display_name} (R${p.monthly_price})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Comissão (%)</label>
                  <Input
                    type="number"
                    className="h-8"
                    defaultValue={c.commission_rate}
                    onBlur={(e) => updateCompany(c.id, { commission_rate: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Billing</label>
                  <Select value={c.billing_status} onValueChange={(v) => updateCompany(c.id, { billing_status: v })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="overdue">Atrasado</SelectItem>
                      <SelectItem value="canceled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 mt-3 text-xs">
                <label className="flex items-center gap-2 text-muted-foreground">
                  <Switch checked={c.highlight_enabled} onCheckedChange={(v) => updateCompany(c.id, { highlight_enabled: v })} />
                  Destaque
                </label>
                <label className="flex items-center gap-2 text-muted-foreground">
                  <Switch checked={c.feed_ads_enabled} onCheckedChange={(v) => updateCompany(c.id, { feed_ads_enabled: v })} />
                  Ads no feed
                </label>
                <label className="flex items-center gap-2 text-muted-foreground">
                  <Switch checked={c.tournament_visibility} onCheckedChange={(v) => updateCompany(c.id, { tournament_visibility: v })} />
                  Torneios
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminCompanies;
