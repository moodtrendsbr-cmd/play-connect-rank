import { useEffect, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, QrCode, Share2, Package } from "lucide-react";
import { QRGenerator } from "@/components/arena/QRGenerator";
import { printQRSheet } from "@/components/arena/QRPrintSheet";
import { ImageUploadField } from "@/components/shared/ImageUploadField";

const CATEGORIES = [
  { value: "bebidas", label: "Bebidas" },
  { value: "comidas", label: "Comidas" },
  { value: "acessorios", label: "Acessórios" },
  { value: "aluguel", label: "Aluguel / Serviço" },
  { value: "esportivos", label: "Esportivos" },
  { value: "outros", label: "Outros" },
];

const emptyForm = { name: "", description: "", price: "", category: "bebidas", image_url: "", stock: "", featured: false, is_active: true };

const ArenaProducts = () => {
  const { arena } = useOutletContext<{ arena: any }>();
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [orders, setOrders] = useState<any[]>([]);
  const [qrProduct, setQrProduct] = useState<any>(null);

  const fetchItems = async () => {
    if (!arena?.id) return;
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("service_arena_id", arena.id)
      .order("created_at", { ascending: false });
    setItems(data || []);
    const productIds = (data || []).map((p) => p.id);
    if (productIds.length) {
      const { data: o } = await (supabase as any)
        .from("marketplace_orders")
        .select("id,total_amount,status,created_at,product_id")
        .in("product_id", productIds)
        .order("created_at", { ascending: false })
        .limit(10);
      setOrders(o || []);
    } else {
      setOrders([]);
    }
  };

  useEffect(() => { if (arena) fetchItems(); }, [arena]);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      name: p.name || "",
      description: p.description || "",
      price: String(p.price ?? ""),
      category: p.category || "outros",
      image_url: p.image_urls?.[0] || "",
      stock: p.stock != null ? String(p.stock) : "",
      featured: !!p.featured,
      is_active: p.status === "approved",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!arena?.id || !form.name || !form.price) {
      toast.error("Preencha nome e preço");
      return;
    }
    const payload: any = {
      name: form.name,
      description: form.description || null,
      price: Number(form.price),
      category: form.category,
      image_urls: form.image_url ? [form.image_url] : [],
      stock: form.stock ? Number(form.stock) : null,
      featured: !!form.featured,
      status: form.is_active ? "approved" : "inactive",
      service_arena_id: arena.id,
      tenant_id: arena.tenant_id || null,
      kind: "physical",
    };
    if (editing) {
      const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
      if (error) { toast.error("Não foi possível salvar"); return; }
      toast.success("Produto atualizado");
    } else {
      // products requires company_id (legacy). Use arena owner as a stand-in via a virtual company link.
      // If schema requires company_id, fall back to the arena_id placeholder is not allowed; surface a friendly message.
      payload.company_id = arena.id; // arenas are treated as the seller scope here
      const { error } = await supabase.from("products").insert(payload);
      if (error) { toast.error("Não foi possível criar o produto"); return; }
      toast.success("Produto criado");
    }
    setOpen(false);
    fetchItems();
  };

  const buildProductLink = (p: any) => `${window.location.origin}/marketplace/product/${p.id}`;

  const handleQr = (p: any) => setQrProduct(p);

  const handleShare = async (p: any) => {
    const url = buildProductLink(p);
    const text = `${p.name} — R$ ${Number(p.price).toFixed(2)}`;
    if (navigator.share) {
      try { await navigator.share({ title: p.name, text, url }); return; } catch {}
    }
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  return (
    <div className="space-y-6">
      <Link to="/arena/dashboard" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar ao painel
      </Link>

      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display text-foreground">Produtos</h1>
          <p className="text-sm text-muted-foreground">Venda produtos da recepção, bar e loja da arena. Gere QR do produto para mesas e balcão.</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openAdd}><Plus className="h-4 w-4" /> Novo produto</Button>
      </div>

      {items.length === 0 ? (
        <Card className="bg-card border-border border-dashed">
          <CardContent className="p-10 text-center space-y-3">
            <Package className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="font-semibold">Cadastre o primeiro produto</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">Bebidas, comidas, acessórios, aluguel — tudo em um só lugar. Cliente compra pelo QR ou pelo link.</p>
            <Button onClick={openAdd} className="mt-2"><Plus className="h-4 w-4 mr-1" /> Cadastrar produto</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((p) => (
            <Card key={p.id} className="bg-card border-border">
              <CardContent className="p-4 flex gap-3">
                {p.image_urls?.[0] ? (
                  <img src={p.image_urls[0]} alt={p.name} className="w-20 h-20 object-cover rounded-md shrink-0" />
                ) : (
                  <div className="w-20 h-20 rounded-md bg-muted/30 flex items-center justify-center shrink-0">
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold truncate">{p.name}</p>
                    <p className="font-bold text-[#2BFF88]">R$ {Number(p.price).toFixed(2)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{CATEGORIES.find((c) => c.value === p.category)?.label || "Outros"} {p.featured && "· Destaque"} {p.status !== "approved" && "· Inativo"}</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openEdit(p)}><Pencil className="h-3 w-3" /> Editar</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleQr(p)}><QrCode className="h-3 w-3" /> QR</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleShare(p)}><Share2 className="h-3 w-3" /> Link</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {orders.length > 0 && (
        <Card className="bg-card border-border">
          <CardContent className="p-4 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Últimos pedidos</h2>
            <div className="space-y-1.5">
              {orders.map((o) => (
                <div key={o.id} className="flex items-center justify-between text-sm border-b border-border/40 pb-1.5">
                  <span className="text-muted-foreground">{new Date(o.created_at).toLocaleDateString("pt-BR")}</span>
                  <span className="font-medium">R$ {Number(o.total_amount).toFixed(2)}</span>
                  <span className="text-xs text-muted-foreground">{o.status}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Preço (R$)</Label>
                <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <ImageUploadField
              label="Foto do produto"
              value={form.image_url || null}
              onChange={(url) => setForm({ ...form, image_url: url ?? "" })}
              bucket="company-images"
              pathPrefix={`products/arena-${arena?.id}`}
              previewShape="square"
              aspect="1/1"
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Estoque (opcional)</Label>
                <Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
              </div>
              <div className="flex flex-col justify-end gap-2 pb-2">
                <label className="flex items-center justify-between text-sm">
                  <span>Ativo</span>
                  <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                </label>
                <label className="flex items-center justify-between text-sm">
                  <span>Destaque</span>
                  <Switch checked={form.featured} onCheckedChange={(v) => setForm({ ...form, featured: v })} />
                </label>
              </div>
            </div>
            <Button onClick={handleSave} className="w-full">{editing ? "Salvar" : "Criar produto"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR dialog */}
      <Dialog open={!!qrProduct} onOpenChange={(v) => !v && setQrProduct(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{qrProduct?.name}</DialogTitle></DialogHeader>
          {qrProduct && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-md flex items-center justify-center">
                <QRGenerator value={buildProductLink(qrProduct)} size={240} />
              </div>
              <Button onClick={() => printQRSheet({ value: buildProductLink(qrProduct), title: qrProduct.name, subtitle: `R$ ${Number(qrProduct.price).toFixed(2)}`, arenaName: arena?.name })} className="w-full">Imprimir QR</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ArenaProducts;
