import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Store, Package } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const MyCompany = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [company, setCompany] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [productForm, setProductForm] = useState({ name: "", description: "", price: "", external_link: "", stock: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: comp } = await supabase.from("companies").select("*").eq("owner_user_id", user.id).maybeSingle();
      setCompany(comp);
      if (comp) {
        const [prodRes, ordRes] = await Promise.all([
          supabase.from("products").select("*").eq("company_id", comp.id).order("created_at", { ascending: false }),
          supabase.from("marketplace_orders").select("*, products(name)").eq("products.company_id", comp.id).order("created_at", { ascending: false }),
        ]);
        setProducts(prodRes.data || []);
        setOrders(ordRes.data || []);
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !productForm.name || !productForm.price) return;
    setSaving(true);
    const { error } = await supabase.from("products").insert({
      company_id: company.id,
      name: productForm.name,
      description: productForm.description,
      price: Number(productForm.price),
      external_link: productForm.external_link || null,
      stock: productForm.stock ? Number(productForm.stock) : null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Produto cadastrado!", description: "Aguardando aprovação do admin." });
      setShowAddProduct(false);
      setProductForm({ name: "", description: "", price: "", external_link: "", stock: "" });
      // Refresh
      const { data } = await supabase.from("products").select("*").eq("company_id", company.id).order("created_at", { ascending: false });
      setProducts(data || []);
    }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Carregando...</div>;

  if (!company) {
    return (
      <main className="pt-4 pb-20 px-4 max-w-xl mx-auto text-center py-20">
        <Store className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
        <p className="text-muted-foreground mb-4">Você ainda não possui uma empresa cadastrada.</p>
        <Button asChild><Link to="/marketplace/register">Cadastrar empresa</Link></Button>
      </main>
    );
  }

  const statusLabel: Record<string, { text: string; color: string }> = {
    pending_approval: { text: "Pendente de aprovação", color: "#F59E0B" },
    approved: { text: "Aprovada", color: "#2BFF88" },
    blocked: { text: "Bloqueada", color: "#EF4444" },
  };

  const st = statusLabel[company.status] || statusLabel.pending_approval;

  return (
    <main className="pt-4 pb-20 px-4 max-w-xl mx-auto">
      <Link to="/marketplace" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display text-foreground">{company.name}</h1>
        <span className="text-xs px-3 py-1 rounded-full font-medium" style={{ background: `${st.color}20`, color: st.color }}>
          {st.text}
        </span>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg text-foreground">PRODUTOS ({products.length})</h2>
        <Dialog open={showAddProduct} onOpenChange={setShowAddProduct}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Produto</DialogTitle></DialogHeader>
            <form onSubmit={handleAddProduct} className="space-y-3">
              <div><Label>Nome *</Label><Input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} /></div>
              <div><Label>Preço *</Label><Input type="number" step="0.01" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} /></div>
              <div><Label>Descrição</Label><Textarea value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} rows={2} /></div>
              <div><Label>Link externo</Label><Input value={productForm.external_link} onChange={(e) => setProductForm({ ...productForm, external_link: e.target.value })} placeholder="https://..." /></div>
              <div><Label>Estoque</Label><Input type="number" value={productForm.stock} onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })} /></div>
              <Button type="submit" className="w-full" disabled={saving}>{saving ? "Salvando..." : "Cadastrar produto"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum produto cadastrado</p>
      ) : (
        <div className="space-y-2">
          {products.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "#0B0F12" }}>
              <Package className="h-8 w-8 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                <p className="text-xs" style={{ color: "#2BFF88" }}>R$ {Number(p.price).toFixed(2)}</p>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{
                background: p.status === "approved" ? "rgba(43,255,136,0.1)" : "rgba(245,158,11,0.1)",
                color: p.status === "approved" ? "#2BFF88" : "#F59E0B",
              }}>
                {p.status === "approved" ? "Aprovado" : p.status === "rejected" ? "Rejeitado" : "Pendente"}
              </span>
            </div>
          ))}
        </div>
      )}

      <h2 className="font-display text-lg text-foreground mt-8 mb-3">PEDIDOS</h2>
      {orders.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum pedido recebido</p>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <div key={o.id} className="p-3 rounded-lg text-sm" style={{ background: "#0B0F12" }}>
              <p className="text-foreground">{(o as any).products?.name || "Produto"}</p>
              <p className="text-xs text-muted-foreground">R$ {Number(o.total_amount).toFixed(2)} · {o.status}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
};

export default MyCompany;
