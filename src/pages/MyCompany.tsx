import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Store, Package, CreditCard, Crown, Zap, X, Image, Video, DollarSign, CheckCircle, Truck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import PromoteFeaturedDialog from "@/components/featured/PromoteFeaturedDialog";
import { Sparkles } from "lucide-react";

const MyCompany = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [company, setCompany] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [allPlans, setAllPlans] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [promoteProduct, setPromoteProduct] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [productForm, setProductForm] = useState({ name: "", description: "", price: "", external_link: "", stock: "" });
  const [unlimitedStock, setUnlimitedStock] = useState(true);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [compRes, plansRes] = await Promise.all([
        supabase.from("companies").select("*").eq("owner_user_id", user.id).maybeSingle(),
        supabase.from("company_plans").select("*").order("monthly_price"),
      ]);
      const comp = compRes.data;
      setCompany(comp);
      setAllPlans(plansRes.data || []);
      if (comp?.plan_id) {
        const found = (plansRes.data || []).find((p: any) => p.id === comp.plan_id);
        setPlan(found || null);
      }
      if (comp) {
        // Fetch orders through products owned by this company
        const [prodRes, ordRes] = await Promise.all([
          supabase.from("products").select("*").eq("company_id", comp.id).order("created_at", { ascending: false }),
          supabase.from("marketplace_orders").select("*").order("created_at", { ascending: false }),
        ]);
        setProducts(prodRes.data || []);
        setOrders(ordRes.data || []);
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const addImageUrl = () => {
    const url = newImageUrl.trim();
    if (!url) return;
    if (imageUrls.length >= 10) {
      toast({ title: "Limite atingido", description: "Máximo de 10 imagens por produto.", variant: "destructive" });
      return;
    }
    setImageUrls([...imageUrls, url]);
    setNewImageUrl("");
  };

  const removeImageUrl = (index: number) => setImageUrls(imageUrls.filter((_, i) => i !== index));

  const resetForm = () => {
    setProductForm({ name: "", description: "", price: "", external_link: "", stock: "" });
    setUnlimitedStock(true);
    setImageUrls([]);
    setNewImageUrl("");
    setVideoUrl("");
  };

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
      stock: unlimitedStock ? null : (productForm.stock ? Number(productForm.stock) : null),
      image_urls: imageUrls,
      video_url: videoUrl || null,
    } as any);
    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Produto cadastrado!", description: "Aguardando aprovação do admin." });
      setShowAddProduct(false);
      resetForm();
      const { data } = await supabase.from("products").select("*").eq("company_id", company.id).order("created_at", { ascending: false });
      setProducts(data || []);
    }
  };

  const handleConfirmDelivery = async (orderId: string) => {
    const { error } = await supabase
      .from("marketplace_orders")
      .update({ company_confirmed: true } as any)
      .eq("id", orderId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Entrega confirmada!" });
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, company_confirmed: true } : o));
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

  // Calculate available balance
  const paidOrders = orders.filter((o) => o.status === "paid");
  const confirmedOrders = paidOrders.filter((o: any) => o.company_confirmed && o.buyer_confirmed);
  const availableBalance = confirmedOrders.reduce((sum: number, o: any) => sum + Number(o.company_amount || 0), 0);
  const pendingBalance = paidOrders.filter((o: any) => !o.company_confirmed || !o.buyer_confirmed)
    .reduce((sum: number, o: any) => sum + Number(o.company_amount || 0), 0);

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

      {/* Balance Section */}
      <Card className="mb-6 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5 text-primary" /> Saldo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Disponível</p>
              <p className="text-xl font-bold" style={{ color: "#2BFF88" }}>R$ {availableBalance.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pendente</p>
              <p className="text-xl font-bold text-muted-foreground">R$ {pendingBalance.toFixed(2)}</p>
            </div>
          </div>
          {availableBalance > 0 && (
            <Button size="sm" variant="outline" className="mt-3" onClick={() => toast({ title: "Solicite via suporte", description: "Entre em contato para solicitar o saque." })}>
              Solicitar saque
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Plan Section */}
      <Card className="mb-6 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-5 w-5 text-primary" /> Meu Plano
          </CardTitle>
        </CardHeader>
        <CardContent>
          {plan ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl font-display text-primary">{plan.display_name}</span>
                {company.billing_status && company.billing_status !== "none" && (
                  <Badge variant={company.billing_status === "active" ? "default" : company.billing_status === "overdue" ? "destructive" : "secondary"}>
                    {company.billing_status === "active" ? "Ativo" : company.billing_status === "overdue" ? "Atrasado" : "Cancelado"}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-2">{plan.description}</p>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>Comissão: {plan.commission_rate}%</span>
                {plan.max_products ? <span>Até {plan.max_products} produtos</span> : <span>Produtos ilimitados</span>}
                {plan.sponsored_posts_per_month > 0 && <span>{plan.sponsored_posts_per_month} post(s)/mês</span>}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground mb-3">Plano Free ativo. Faça upgrade para mais recursos!</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {allPlans.filter((p) => p.monthly_price > 0).map((p) => (
                  <div key={p.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center gap-1 mb-1">
                      {p.name === "elite" ? <Crown className="h-4 w-4 text-primary" /> : <Zap className="h-4 w-4 text-primary" />}
                      <span className="font-display text-sm">{p.display_name}</span>
                    </div>
                    <p className="text-lg font-bold text-primary mb-1">R$ {Number(p.monthly_price).toFixed(0)}/mês</p>
                    <p className="text-xs text-muted-foreground">{p.description}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">Entre em contato para fazer upgrade.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Products */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg text-foreground">PRODUTOS ({products.length})</h2>
        <Dialog open={showAddProduct} onOpenChange={(open) => { setShowAddProduct(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Novo Produto</DialogTitle></DialogHeader>
            <form onSubmit={handleAddProduct} className="space-y-3">
              <div><Label>Nome *</Label><Input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} /></div>
              <div><Label>Preço *</Label><Input type="number" step="0.01" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} /></div>
              <div><Label>Descrição</Label><Textarea value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} rows={2} /></div>
              <div><Label>Link externo</Label><Input value={productForm.external_link} onChange={(e) => setProductForm({ ...productForm, external_link: e.target.value })} placeholder="https://..." /></div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox id="unlimited-stock" checked={unlimitedStock} onCheckedChange={(checked) => setUnlimitedStock(checked === true)} />
                  <Label htmlFor="unlimited-stock" className="cursor-pointer">Estoque ilimitado</Label>
                </div>
                {!unlimitedStock && (
                  <div><Label>Quantidade em estoque</Label><Input type="number" value={productForm.stock} onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })} /></div>
                )}
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Image className="h-4 w-4" /> Imagens ({imageUrls.length}/10)</Label>
                {imageUrls.map((url, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <img src={url} alt={`img-${i}`} className="h-10 w-10 rounded object-cover shrink-0" />
                    <span className="text-xs text-muted-foreground truncate flex-1">{url}</span>
                    <button type="button" onClick={() => removeImageUrl(i)} className="text-destructive hover:opacity-70"><X className="h-4 w-4" /></button>
                  </div>
                ))}
                {imageUrls.length < 10 && (
                  <div className="flex gap-2">
                    <Input value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} placeholder="URL da imagem" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addImageUrl(); } }} />
                    <Button type="button" size="sm" variant="outline" onClick={addImageUrl}><Plus className="h-4 w-4" /></Button>
                  </div>
                )}
              </div>
              <div>
                <Label className="flex items-center gap-1"><Video className="h-4 w-4" /> Vídeo (URL)</Label>
                <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://...mp4" />
              </div>
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
              {p.status === "approved" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setPromoteProduct(p)}
                >
                  <Sparkles className="h-3 w-3 mr-1" /> Promover
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {promoteProduct && (
        <PromoteFeaturedDialog
          open={!!promoteProduct}
          onOpenChange={(o) => !o && setPromoteProduct(null)}
          entityType="product"
          entityId={promoteProduct.id}
          entityLabel={promoteProduct.name}
        />
      )}

      {/* Orders */}
      <h2 className="font-display text-lg text-foreground mt-8 mb-3">PEDIDOS</h2>
      {paidOrders.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum pedido recebido</p>
      ) : (
        <div className="space-y-2">
          {paidOrders.map((o: any) => {
            const orderItems = (() => { try { return JSON.parse(o.items || "[]"); } catch { return []; } })();
            return (
              <div key={o.id} className="p-3 rounded-lg" style={{ background: "#0B0F12" }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-foreground">
                    {orderItems.length > 0 ? orderItems.map((i: any) => `${i.quantity}x ${i.name}`).join(", ") : "Pedido"}
                  </p>
                  <span className="text-xs" style={{ color: "#2BFF88" }}>R$ {Number(o.total_amount).toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {o.company_confirmed ? (
                    <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3" style={{ color: "#2BFF88" }} /> Envio confirmado</span>
                  ) : (
                    <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => handleConfirmDelivery(o.id)}>
                      <Truck className="h-3 w-3 mr-1" /> Confirmar envio
                    </Button>
                  )}
                  {o.buyer_confirmed ? (
                    <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3" style={{ color: "#2BFF88" }} /> Recebido</span>
                  ) : (
                    <span>Aguardando recebimento</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
};

export default MyCompany;
