import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ShieldAlert, Star, Sparkles, Crown } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";

const ENTITY_TYPES = [
  { code: "tournament", label: "Torneios" },
  { code: "product", label: "Produtos" },
  { code: "company", label: "Empresas" },
  { code: "arena", label: "Arenas" },
  { code: "sponsored_post", label: "Posts Patrocinados" },
];

const TIER_ICON: Record<string, any> = {
  basic: Star,
  premium: Sparkles,
  spotlight: Crown,
};

interface Listing {
  id: string;
  entity_type: string;
  entity_id: string;
  tier: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  paid_amount: number;
  created_by: string;
  created_at: string;
}

interface KillSwitch {
  entity_type: string;
  enabled: boolean;
  reason: string | null;
  toggled_at: string;
}

const AdminFeaturedListings = () => {
  const [listings, setListings] = useState<Listing[]>([]);
  const [switches, setSwitches] = useState<Record<string, KillSwitch>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"active" | "all" | "killed">("active");

  const load = useCallback(async () => {
    setLoading(true);
    const [lRes, sRes] = await Promise.all([
      (supabase as any).from("featured_listings").select("*").order("created_at", { ascending: false }).limit(200),
      (supabase as any).from("featured_kill_switch").select("*"),
    ]);
    setListings((lRes.data as Listing[]) || []);
    const map: Record<string, KillSwitch> = {};
    ((sRes.data as KillSwitch[]) || []).forEach((s) => { map[s.entity_type] = s; });
    setSwitches(map);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggleSwitch = async (entityType: string, enabled: boolean) => {
    const { data, error } = await (supabase as any).rpc("toggle_featured_kill_switch", {
      _entity_type: entityType,
      _enabled: enabled,
      _reason: null,
    });
    if (error || !data?.success) {
      toast({ title: "Erro", description: error?.message || "Falha ao alternar.", variant: "destructive" });
      return;
    }
    toast({ title: enabled ? "Kill-switch ativado" : "Kill-switch desativado" });
    load();
  };

  const handleKill = async (id: string) => {
    if (!confirm("Encerrar este destaque agora?")) return;
    const { data, error } = await (supabase as any).rpc("admin_kill_featured_listing", {
      _featured_id: id,
      _reason: null,
    });
    if (error || !data?.success) {
      toast({ title: "Erro", description: error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Destaque encerrado" });
    load();
  };

  const filtered = listings.filter((l) => {
    if (filter === "active") return l.status === "active";
    if (filter === "killed") return l.status === "killed";
    return true;
  });

  const globalKill = switches["*"]?.enabled || false;

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      <div>
        <h1 className="font-display text-2xl">Destaques pagos</h1>
        <p className="text-sm text-muted-foreground">Auto-aprovação ativa. Use os kill-switches para pausar destaques sem apagar dados.</p>
      </div>

      {/* Kill switches */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5" style={{ color: "#FF8A2B" }} />
          <h2 className="font-display text-lg">Kill-switches</h2>
        </div>

        <div
          className="flex items-center justify-between p-3 rounded-md"
          style={{
            background: globalKill ? "rgba(255,80,80,0.08)" : "transparent",
            border: globalKill ? "1px solid rgba(255,80,80,0.3)" : "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div>
            <p className="font-medium">Global (todas categorias)</p>
            <p className="text-xs text-muted-foreground">Pausa todos os destaques imediatamente.</p>
          </div>
          <Switch checked={globalKill} onCheckedChange={(v) => handleToggleSwitch("*", v)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {ENTITY_TYPES.map((et) => {
            const sw = switches[et.code];
            const enabled = sw?.enabled || false;
            return (
              <div
                key={et.code}
                className="flex items-center justify-between p-3 rounded-md"
                style={{ background: "#0B0F12", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div>
                  <p className="text-sm font-medium">{et.label}</p>
                  {sw?.toggled_at && (
                    <p className="text-[10px] text-muted-foreground">
                      Última alteração {formatDistanceToNow(new Date(sw.toggled_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  )}
                </div>
                <Switch checked={enabled} onCheckedChange={(v) => handleToggleSwitch(et.code, v)} />
              </div>
            );
          })}
        </div>
      </Card>

      {/* Listings */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg">Destaques recentes</h2>
          <div className="flex gap-1">
            {(["active", "all", "killed"] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "outline"}
                onClick={() => setFilter(f)}
              >
                {f === "active" ? "Ativos" : f === "killed" ? "Mortos" : "Todos"}
              </Button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhum destaque nesse filtro.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((l) => {
              const Icon = TIER_ICON[l.tier] || Star;
              return (
                <div
                  key={l.id}
                  className="flex items-center justify-between p-3 rounded-md"
                  style={{ background: "#0B0F12", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className="h-5 w-5 flex-shrink-0" style={{ color: "#2BFF88" }} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {l.entity_type} · {l.tier}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        ID {l.entity_id.slice(0, 8)}… ·
                        {l.ends_at ? ` até ${format(new Date(l.ends_at), "dd/MM/yyyy", { locale: ptBR })}` : " sem prazo"}
                        · R$ {Number(l.paid_amount).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={l.status === "active" ? "default" : "secondary"}>
                      {l.status}
                    </Badge>
                    {l.status === "active" && (
                      <Button size="sm" variant="destructive" onClick={() => handleKill(l.id)}>
                        Encerrar
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default AdminFeaturedListings;
