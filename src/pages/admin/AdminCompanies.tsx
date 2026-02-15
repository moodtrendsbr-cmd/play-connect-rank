import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";

const AdminCompanies = () => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const fetchCompanies = async () => {
    setLoading(true);
    let query = supabase.from("companies").select("*").order("created_at", { ascending: false });
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    const { data } = await query;
    setCompanies(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchCompanies(); }, [statusFilter]);

  const updateCompany = async (id: string, updates: Record<string, any>) => {
    const { error } = await supabase.from("companies").update(updates).eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Atualizado!" }); fetchCompanies(); }
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
            style={{ background: statusFilter === s ? "#2BFF88" : "#0B0F12", color: statusFilter === s ? "#050708" : "#9CA3AF" }}
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
            <div key={c.id} className="rounded-lg p-4" style={{ background: "#0B0F12" }}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-medium text-foreground">{c.name}</h3>
                  <p className="text-xs text-muted-foreground">{c.city}{c.state ? `, ${c.state}` : ""} · {c.category} · {c.email}</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{
                  background: c.status === "approved" ? "rgba(43,255,136,0.1)" : c.status === "blocked" ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)",
                  color: c.status === "approved" ? "#2BFF88" : c.status === "blocked" ? "#EF4444" : "#F59E0B",
                }}>
                  {c.status}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {c.status !== "approved" && (
                  <Button size="sm" onClick={() => updateCompany(c.id, { status: "approved" })} style={{ background: "#2BFF88", color: "#050708" }}>Aprovar</Button>
                )}
                {c.status !== "blocked" && (
                  <Button size="sm" variant="destructive" onClick={() => updateCompany(c.id, { status: "blocked" })}>Bloquear</Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <label className="text-xs text-muted-foreground">Plano</label>
                  <Select value={c.plan} onValueChange={(v) => updateCompany(c.id, { plan: v })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="elite">Elite</SelectItem>
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
