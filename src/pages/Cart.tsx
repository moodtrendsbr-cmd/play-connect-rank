import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Minus, Plus, Trash2, MapPin, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ViaCepResult {
  cep: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

const Cart = () => {
  const { items, companyId, companyName, removeFromCart, updateQuantity, clearCart, getSubtotal } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [cep, setCep] = useState("");
  const [buyerAddress, setBuyerAddress] = useState<ViaCepResult | null>(null);
  const [companyAddress, setCompanyAddress] = useState<ViaCepResult | null>(null);
  const [companyZip, setCompanyZip] = useState<string | null>(null);
  const [shippingCost, setShippingCost] = useState<number | null>(null);
  const [loadingCep, setLoadingCep] = useState(false);

  // Fetch company zip_code
  useEffect(() => {
    if (!companyId) return;
    supabase.from("companies").select("zip_code, city, state").eq("id", companyId).single().then(({ data }) => {
      if (data?.zip_code) {
        setCompanyZip(data.zip_code);
        // Fetch company address info from ViaCEP
        fetchViaCep(data.zip_code.replace(/\D/g, "")).then((r) => {
          if (r) setCompanyAddress(r);
          else setCompanyAddress({ cep: data.zip_code!, localidade: data.city || "", uf: data.state || "" });
        });
      }
    });
  }, [companyId]);

  const fetchViaCep = async (zipCode: string): Promise<ViaCepResult | null> => {
    try {
      const res = await fetch(`https://viacep.com.br/ws/${zipCode}/json/`);
      const data = await res.json();
      if (data.erro) return null;
      return data;
    } catch {
      return null;
    }
  };

  const calculateShipping = (buyer: ViaCepResult, company: ViaCepResult): number => {
    // Same city = free
    if (buyer.localidade.toLowerCase() === company.localidade.toLowerCase() && buyer.uf === company.uf) return 0;
    // Same region (first 3 digits of CEP)
    const buyerPrefix = buyer.cep.replace(/\D/g, "").substring(0, 3);
    const companyPrefix = company.cep.replace(/\D/g, "").substring(0, 3);
    if (buyerPrefix === companyPrefix) return 10;
    // Same state
    if (buyer.uf === company.uf) return 20;
    // Different states
    return 35;
  };

  const handleCepSearch = async () => {
    const cleaned = cep.replace(/\D/g, "");
    if (cleaned.length !== 8) {
      toast({ title: "CEP inválido", description: "Digite um CEP com 8 dígitos.", variant: "destructive" });
      return;
    }
    setLoadingCep(true);
    const result = await fetchViaCep(cleaned);
    setLoadingCep(false);

    if (!result) {
      toast({ title: "CEP não encontrado", description: "Verifique o CEP digitado.", variant: "destructive" });
      setBuyerAddress(null);
      setShippingCost(null);
      return;
    }
    setBuyerAddress(result);

    if (companyAddress) {
      const cost = calculateShipping(result, companyAddress);
      setShippingCost(cost);
    }
  };

  const subtotal = getSubtotal();
  const total = subtotal + (shippingCost || 0);

  if (items.length === 0) {
    return (
      <main className="pt-4 pb-20 px-4 max-w-xl mx-auto text-center py-20">
        <p className="text-muted-foreground mb-4">Seu carrinho está vazio</p>
        <Button asChild variant="outline"><Link to="/marketplace">Ver produtos</Link></Button>
      </main>
    );
  }

  return (
    <main className="pt-4 pb-20 px-4 max-w-xl mx-auto">
      <Link to="/marketplace" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Marketplace
      </Link>

      <h1 className="text-2xl font-display text-foreground mb-1">CARRINHO</h1>
      <p className="text-xs text-muted-foreground mb-6">Produtos de: {companyName}</p>

      <div className="space-y-3 mb-6">
        {items.map((item) => (
          <div key={item.productId} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "#0B0F12" }}>
            {item.imageUrl ? (
              <img src={item.imageUrl} alt={item.name} className="h-16 w-16 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="h-16 w-16 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#1a1f25" }}>
                <span className="text-muted-foreground text-xs">Sem img</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
              <p className="text-sm font-bold" style={{ color: "#2BFF88" }}>R$ {(item.price * item.quantity).toFixed(2)}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="h-7 w-7 rounded flex items-center justify-center" style={{ background: "#1a1f25" }}>
                <Minus className="h-3 w-3 text-foreground" />
              </button>
              <span className="text-sm text-foreground w-6 text-center">{item.quantity}</span>
              <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="h-7 w-7 rounded flex items-center justify-center" style={{ background: "#1a1f25" }}>
                <Plus className="h-3 w-3 text-foreground" />
              </button>
            </div>
            <button onClick={() => removeFromCart(item.productId)} className="text-destructive shrink-0">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <button onClick={clearCart} className="text-xs text-destructive mb-6">Limpar carrinho</button>

      {/* Shipping */}
      <div className="rounded-lg p-4 mb-6" style={{ background: "#0B0F12" }}>
        <Label className="flex items-center gap-1 mb-2 text-foreground">
          <MapPin className="h-4 w-4" /> Calcular frete
        </Label>
        <div className="flex gap-2">
          <Input
            value={cep}
            onChange={(e) => setCep(e.target.value.replace(/\D/g, "").substring(0, 8))}
            placeholder="00000-000"
            maxLength={9}
          />
          <Button onClick={handleCepSearch} disabled={loadingCep} variant="outline" size="sm">
            {loadingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
          </Button>
        </div>
        {buyerAddress && (
          <p className="text-xs text-muted-foreground mt-2">
            {buyerAddress.localidade} - {buyerAddress.uf}
          </p>
        )}
        {shippingCost !== null && (
          <p className="text-sm font-medium mt-2" style={{ color: "#2BFF88" }}>
            {shippingCost === 0 ? "Frete grátis! 🎉" : `Frete: R$ ${shippingCost.toFixed(2)}`}
          </p>
        )}
      </div>

      {/* Summary */}
      <div className="rounded-lg p-4 mb-6 space-y-2" style={{ background: "#0B0F12" }}>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Subtotal</span>
          <span>R$ {subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Frete</span>
          <span>{shippingCost === null ? "Calcule o frete" : shippingCost === 0 ? "Grátis" : `R$ ${shippingCost.toFixed(2)}`}</span>
        </div>
        <div className="flex justify-between text-lg font-bold text-foreground border-t border-border pt-2">
          <span>Total</span>
          <span style={{ color: "#2BFF88" }}>R$ {total.toFixed(2)}</span>
        </div>
      </div>

      <Button
        onClick={() => {
          if (!user) { navigate("/login"); return; }
          if (shippingCost === null) {
            toast({ title: "Calcule o frete", description: "Insira seu CEP para calcular o frete.", variant: "destructive" });
            return;
          }
          navigate("/marketplace/checkout", { state: { shippingCost, shippingZip: cep, buyerCity: buyerAddress?.localidade, buyerState: buyerAddress?.uf } });
        }}
        className="w-full h-12 text-lg font-bold"
      >
        Finalizar compra
      </Button>
    </main>
  );
};

export default Cart;
