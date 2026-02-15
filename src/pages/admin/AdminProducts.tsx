import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";

const AdminProducts = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    setLoading(true);
    let query = supabase.from("products").select("*, companies(name)").order("created_at", { ascending: false });
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    const { data } = await query;
    setProducts(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, [statusFilter]);

  const updateProduct = async (id: string, updates: Record<string, any>) => {
    const { error } = await supabase.from("products").update(updates).eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Atualizado!" }); fetchProducts(); }
  };

  const deleteProduct = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Produto removido" }); fetchProducts(); }
  };

  return (
    <div>
      <h1 className="mb-6 text-4xl font-display text-foreground">PRODUTOS</h1>

      <div className="flex gap-2 mb-4">
        {["all", "pending", "approved", "rejected"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
            style={{ background: statusFilter === s ? "#2BFF88" : "#0B0F12", color: statusFilter === s ? "#050708" : "#9CA3AF" }}
          >
            {s === "all" ? "Todos" : s === "pending" ? "Pendentes" : s === "approved" ? "Aprovados" : "Rejeitados"}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : products.length === 0 ? (
        <p className="text-muted-foreground">Nenhum produto encontrado</p>
      ) : (
        <div className="space-y-3">
          {products.map((p) => (
            <div key={p.id} className="rounded-lg p-4 flex items-center gap-4" style={{ background: "#0B0F12" }}>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground truncate">{p.name}</h3>
                <p className="text-xs text-muted-foreground">{(p as any).companies?.name || "—"} · R$ {Number(p.price).toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Switch checked={p.featured} onCheckedChange={(v) => updateProduct(p.id, { featured: v })} />
                  Destaque
                </label>
                {p.status !== "approved" && (
                  <Button size="sm" onClick={() => updateProduct(p.id, { status: "approved" })} style={{ background: "#2BFF88", color: "#050708" }}>Aprovar</Button>
                )}
                {p.status !== "rejected" && (
                  <Button size="sm" variant="outline" onClick={() => updateProduct(p.id, { status: "rejected" })}>Rejeitar</Button>
                )}
                <Button size="sm" variant="destructive" onClick={() => deleteProduct(p.id)}>Remover</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminProducts;
