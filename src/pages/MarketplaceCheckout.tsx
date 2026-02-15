import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CreditCard, QrCode, Loader2, Copy, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const MarketplaceCheckout = () => {
  const { items, companyId, getSubtotal, clearCart } = useCart()!;
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { shippingCost = 0, shippingZip = "" } = (location.state as any) || {};

  const [payerName, setPayerName] = useState("");
  const [payerEmail, setPayerEmail] = useState("");
  const [payerCpf, setPayerCpf] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "credit_card">("pix");
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<{ qr_code: string; qr_code_base64: string } | null>(null);
  const [paymentDone, setPaymentDone] = useState(false);
  const [copied, setCopied] = useState(false);

  const subtotal = getSubtotal();
  const total = subtotal + shippingCost;

  if (items.length === 0 && !paymentDone) {
    navigate("/marketplace/cart");
    return null;
  }

  const handlePay = async () => {
    if (!user) { navigate("/login"); return; }
    if (!payerName || !payerEmail || !payerCpf) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-marketplace-payment", {
        body: {
          company_id: companyId,
          items: items.map((i) => ({ product_id: i.productId, name: i.name, price: i.price, quantity: i.quantity })),
          shipping_cost: shippingCost,
          shipping_zip: shippingZip,
          payer_email: payerEmail,
          payer_first_name: payerName.split(" ")[0],
          payer_last_name: payerName.split(" ").slice(1).join(" "),
          payer_doc_number: payerCpf.replace(/\D/g, ""),
          payment_method: paymentMethod,
          buyer_user_id: user.id,
        },
      });

      if (error) throw error;

      if (paymentMethod === "pix" && data.pix_qr_code) {
        setPixData({ qr_code: data.pix_qr_code, qr_code_base64: data.pix_qr_code_base64 });
      } else if (data.status === "approved") {
        setPaymentDone(true);
        clearCart();
        toast({ title: "Pagamento aprovado! ✅", description: "Seu pedido foi realizado com sucesso." });
      } else {
        toast({ title: "Pagamento pendente", description: `Status: ${data.status_detail || data.status}` });
      }
    } catch (err: any) {
      toast({ title: "Erro no pagamento", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const handleCopyPix = () => {
    if (pixData?.qr_code) {
      navigator.clipboard.writeText(pixData.qr_code);
      setCopied(true);
      toast({ title: "Código PIX copiado!" });
      setTimeout(() => setCopied(false), 3000);
    }
  };

  if (paymentDone) {
    return (
      <main className="pt-4 pb-20 px-4 max-w-xl mx-auto text-center py-20">
        <CheckCircle className="h-16 w-16 mx-auto mb-4" style={{ color: "#2BFF88" }} />
        <h1 className="text-2xl font-display text-foreground mb-2">Pedido realizado!</h1>
        <p className="text-muted-foreground mb-6">Seu pagamento foi processado com sucesso.</p>
        <Button asChild><Link to="/marketplace">Voltar ao Marketplace</Link></Button>
      </main>
    );
  }

  if (pixData) {
    return (
      <main className="pt-4 pb-20 px-4 max-w-xl mx-auto">
        <h1 className="text-2xl font-display text-foreground mb-4 text-center">Pague com PIX</h1>
        <div className="rounded-lg p-6 text-center" style={{ background: "#0B0F12" }}>
          {pixData.qr_code_base64 && (
            <img src={`data:image/png;base64,${pixData.qr_code_base64}`} alt="QR Code PIX" className="mx-auto mb-4 rounded-lg" style={{ maxWidth: 250 }} />
          )}
          <p className="text-2xl font-bold mb-4" style={{ color: "#2BFF88" }}>R$ {total.toFixed(2)}</p>
          <Button onClick={handleCopyPix} variant="outline" className="w-full">
            {copied ? <CheckCircle className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            {copied ? "Copiado!" : "Copiar código PIX"}
          </Button>
          <p className="text-xs text-muted-foreground mt-4">Após o pagamento, o pedido será confirmado automaticamente.</p>
        </div>
        <Button asChild variant="ghost" className="w-full mt-4">
          <Link to="/marketplace">Voltar ao Marketplace</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="pt-4 pb-20 px-4 max-w-xl mx-auto">
      <Link to="/marketplace/cart" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Voltar ao carrinho
      </Link>

      <h1 className="text-2xl font-display text-foreground mb-6">CHECKOUT</h1>

      {/* Order summary */}
      <div className="rounded-lg p-4 mb-6 space-y-1" style={{ background: "#0B0F12" }}>
        {items.map((item) => (
          <div key={item.productId} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{item.quantity}x {item.name}</span>
            <span className="text-foreground">R$ {(item.price * item.quantity).toFixed(2)}</span>
          </div>
        ))}
        <div className="flex justify-between text-sm text-muted-foreground border-t border-border pt-1 mt-1">
          <span>Frete</span>
          <span>{shippingCost === 0 ? "Grátis" : `R$ ${shippingCost.toFixed(2)}`}</span>
        </div>
        <div className="flex justify-between text-lg font-bold text-foreground border-t border-border pt-1 mt-1">
          <span>Total</span>
          <span style={{ color: "#2BFF88" }}>R$ {total.toFixed(2)}</span>
        </div>
      </div>

      {/* Payer info */}
      <div className="space-y-3 mb-6">
        <div>
          <Label>Nome completo *</Label>
          <Input value={payerName} onChange={(e) => setPayerName(e.target.value)} placeholder="João Silva" />
        </div>
        <div>
          <Label>Email *</Label>
          <Input type="email" value={payerEmail} onChange={(e) => setPayerEmail(e.target.value)} placeholder="joao@email.com" />
        </div>
        <div>
          <Label>CPF *</Label>
          <Input value={payerCpf} onChange={(e) => setPayerCpf(e.target.value)} placeholder="000.000.000-00" />
        </div>
      </div>

      {/* Payment method */}
      <div className="mb-6">
        <Label className="mb-2 block">Método de pagamento</Label>
        <div className="flex gap-3">
          <button
            onClick={() => setPaymentMethod("pix")}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border transition-colors text-sm font-medium"
            style={{
              borderColor: paymentMethod === "pix" ? "#2BFF88" : "rgba(255,255,255,0.1)",
              background: paymentMethod === "pix" ? "rgba(43,255,136,0.1)" : "#0B0F12",
              color: paymentMethod === "pix" ? "#2BFF88" : "#9CA3AF",
            }}
          >
            <QrCode className="h-4 w-4" /> PIX
          </button>
          <button
            onClick={() => setPaymentMethod("credit_card")}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border transition-colors text-sm font-medium"
            style={{
              borderColor: paymentMethod === "credit_card" ? "#2BFF88" : "rgba(255,255,255,0.1)",
              background: paymentMethod === "credit_card" ? "rgba(43,255,136,0.1)" : "#0B0F12",
              color: paymentMethod === "credit_card" ? "#2BFF88" : "#9CA3AF",
            }}
          >
            <CreditCard className="h-4 w-4" /> Cartão
          </button>
        </div>
      </div>

      <Button onClick={handlePay} className="w-full h-12 text-lg font-bold" disabled={loading}>
        {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
        {loading ? "Processando..." : `Pagar R$ ${total.toFixed(2)}`}
      </Button>
    </main>
  );
};

export default MarketplaceCheckout;
