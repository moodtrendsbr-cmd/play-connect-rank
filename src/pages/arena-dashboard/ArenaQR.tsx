import { useEffect, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Plus, Printer, Download, Share2, Power, QrCode } from "lucide-react";
import { QRGenerator, qrToDataUrl } from "@/components/arena/QRGenerator";
import { printQRSheet } from "@/components/arena/QRPrintSheet";

const QR_KINDS = [
  { value: "arena",       label: "QR da arena",            hint: "Abre o WhatsApp da arena" },
  { value: "checkin",     label: "QR de check-in",         hint: "Cliente faz check-in pelo celular" },
  { value: "court",       label: "QR de reserva de quadra",hint: "Cola na quadra para reservar" },
  { value: "tournament",  label: "QR de torneio",          hint: "Compartilha o torneio rapidamente" },
  { value: "class",       label: "QR de aula",             hint: "Para banners e folders de aula" },
  { value: "product",     label: "QR de produto / bar",    hint: "Cola no balcão e nas mesas" },
  { value: "promo",       label: "QR de promoção",         hint: "Para campanhas e flyers" },
];

const kindLabel = (k?: string) => QR_KINDS.find((x) => x.value === k)?.label || "QR";

const ArenaQR = () => {
  const { arena } = useOutletContext<{ arena: any }>();
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ label: "", kind: "arena" });
  const [previewItem, setPreviewItem] = useState<any>(null);

  const fetchItems = async () => {
    if (!arena?.id) return;
    const { data } = await supabase
      .from("wa_qr_tokens")
      .select("*")
      .eq("arena_id", arena.id)
      .order("created_at", { ascending: false });
    setItems(data || []);
  };

  useEffect(() => { if (arena) fetchItems(); }, [arena]);

  const buildTargetUrl = (token: string, kind: string) => {
    // Frictionless arena check-in: open the public check-in page directly.
    if (kind === "checkin") {
      return `${window.location.origin}/c/QR-${token}?kind=qr`;
    }
    const wa = (arena?.contact_whatsapp || "").replace(/\D/g, "");
    if (wa) return `https://wa.me/${wa}?text=${encodeURIComponent(`MoodPlay #QR-${token.slice(0, 8)}`)}`;
    return `${window.location.origin}/arenas/${arena.slug}?qr=${token}`;
  };

  const handleCreate = async () => {
    if (!arena?.id || !form.label) return;
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("wa_qr_tokens")
      .insert({
        arena_id: arena.id,
        tenant_id: arena.tenant_id || null,
        intent: form.kind,
        kind: form.kind,
        label: form.label,
        payload: { arena_id: arena.id, kind: form.kind },
        expires_at: expiresAt,
        is_active: true,
      } as any)
      .select()
      .single();
    if (error) { toast.error("Não foi possível criar o QR"); return; }
    toast.success("QR criado");
    setOpen(false);
    setForm({ label: "", kind: "arena" });
    setPreviewItem(data);
    fetchItems();
  };

  const toggle = async (it: any) => {
    await (supabase as any).from("wa_qr_tokens").update({ is_active: !it.is_active }).eq("id", it.id);
    fetchItems();
  };

  const handleDownload = async (it: any) => {
    const url = buildTargetUrl(it.token, it.kind || it.intent);
    const dataUrl = await qrToDataUrl(url, 800);
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `qr-${it.label || it.kind || "moodplay"}.png`;
    a.click();
  };

  const handlePrint = (it: any) => {
    const url = buildTargetUrl(it.token, it.kind || it.intent);
    printQRSheet({
      value: url,
      title: it.label || kindLabel(it.kind || it.intent),
      subtitle: kindLabel(it.kind || it.intent),
      arenaName: arena?.name,
    });
  };

  const handleShare = async (it: any) => {
    const url = buildTargetUrl(it.token, it.kind || it.intent);
    if (navigator.share) {
      try { await navigator.share({ title: it.label, url }); return; } catch {}
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
          <h1 className="text-2xl font-display text-foreground">QR físico</h1>
          <p className="text-sm text-muted-foreground">Cole na recepção, mesas, quadras e banners. O cliente escaneia e continua pelo WhatsApp.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Novo QR</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar novo QR físico</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {QR_KINDS.map((k) => (
                      <SelectItem key={k.value} value={k.value}>
                        <div>
                          <div>{k.label}</div>
                          <div className="text-xs text-muted-foreground">{k.hint}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nome (só para você identificar)</Label>
                <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Ex: Recepção, Mesa 3, Quadra 1" />
              </div>
              <Button onClick={handleCreate} disabled={!form.label} className="w-full">Criar QR</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <Card className="bg-card border-border border-dashed">
          <CardContent className="p-10 text-center space-y-3">
            <QrCode className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="font-semibold">Crie seu primeiro QR físico</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">Cole na recepção, mesas, quadras ou eventos. O cliente escaneia e continua pelo WhatsApp.</p>
            <Button onClick={() => setOpen(true)} className="mt-2"><Plus className="h-4 w-4 mr-1" /> Criar primeiro QR</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((it) => (
            <Card key={it.id} className={`bg-card border-border ${!it.is_active ? "opacity-60" : ""}`}>
              <CardContent className="p-4 flex items-start gap-4">
                <div className="bg-white p-2 rounded-md shrink-0">
                  <QRGenerator value={buildTargetUrl(it.token, it.kind || it.intent)} size={96} />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div>
                    <p className="font-semibold truncate">{it.label || kindLabel(it.kind || it.intent)}</p>
                    <p className="text-xs text-muted-foreground">{kindLabel(it.kind || it.intent)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {it.scans_count || 0} scan{(it.scans_count || 0) !== 1 ? "s" : ""}
                    {!it.is_active && " · Inativo"}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handlePrint(it)}><Printer className="h-3 w-3" /> Imprimir</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleDownload(it)}><Download className="h-3 w-3" /> Baixar</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleShare(it)}><Share2 className="h-3 w-3" /> Compartilhar</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => toggle(it)}><Power className="h-3 w-3" /> {it.is_active ? "Desativar" : "Ativar"}</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Preview after create */}
      <Dialog open={!!previewItem} onOpenChange={(v) => !v && setPreviewItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{previewItem?.label}</DialogTitle></DialogHeader>
          {previewItem && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-md flex items-center justify-center">
                <QRGenerator value={buildTargetUrl(previewItem.token, previewItem.kind || previewItem.intent)} size={240} />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handlePrint(previewItem)} className="flex-1"><Printer className="h-4 w-4 mr-1" /> Imprimir</Button>
                <Button variant="outline" onClick={() => handleDownload(previewItem)} className="flex-1"><Download className="h-4 w-4 mr-1" /> Baixar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ArenaQR;
