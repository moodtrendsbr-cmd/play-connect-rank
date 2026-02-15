import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Store, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const MarketplaceProduct = () => {
  const { productId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [currentImg, setCurrentImg] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: prod } = await supabase.from("products").select("*").eq("id", productId).single();
      setProduct(prod);
      if (prod) {
        const { data: comp } = await supabase.from("companies").select("*").eq("id", prod.company_id).single();
        setCompany(comp);
      }
      setLoading(false);
    };
    if (productId) fetch();
  }, [productId]);

  const handleBuy = async () => {
    if (!user) { navigate("/login"); return; }
    if (product.external_link) {
      window.open(product.external_link, "_blank");
      return;
    }
    const commission = Number(product.price) * (Number(company?.commission_rate || 10) / 100);
    const companyAmount = Number(product.price) - commission;
    const { error } = await supabase.from("marketplace_orders").insert({
      product_id: product.id,
      buyer_user_id: user.id,
      total_amount: product.price,
      mood_commission: commission,
      company_amount: companyAmount,
    });
    if (error) toast({ title: "Erro", description: "Não foi possível criar o pedido", variant: "destructive" });
    else toast({ title: "Pedido criado!", description: "Entraremos em contato em breve." });
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Carregando...</div>;
  if (!product) return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Produto não encontrado</div>;

  const images = product.image_urls || [];

  return (
    <main className="pt-4 pb-20 px-4 max-w-xl mx-auto">
      <Link to={`/marketplace/company/${product.company_id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      {images.length > 0 ? (
        <div className="relative rounded-xl overflow-hidden mb-4">
          <img src={images[currentImg]} alt={product.name} className="w-full h-64 object-cover" />
          {images.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {images.map((_: string, i: number) => (
                <button key={i} onClick={() => setCurrentImg(i)} className="h-2 w-2 rounded-full" style={{ background: i === currentImg ? "#2BFF88" : "rgba(255,255,255,0.4)" }} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="w-full h-64 rounded-xl flex items-center justify-center mb-4" style={{ background: "#0B0F12" }}>
          <Store className="h-16 w-16 text-muted-foreground" />
        </div>
      )}

      <h1 className="text-2xl font-display text-foreground">{product.name}</h1>
      <p className="text-2xl font-bold mt-1" style={{ color: "#2BFF88" }}>R$ {Number(product.price).toFixed(2)}</p>

      {product.description && <p className="text-sm text-muted-foreground mt-4">{product.description}</p>}

      {product.video_url && (
        <div className="mt-4 rounded-xl overflow-hidden">
          <video src={product.video_url} controls className="w-full" />
        </div>
      )}

      <Button onClick={handleBuy} className="w-full h-12 mt-6 text-lg font-bold">
        {product.external_link ? (
          <><ExternalLink className="h-4 w-4 mr-2" /> Comprar no site</>
        ) : (
          "Comprar"
        )}
      </Button>

      {company && (
        <Link to={`/marketplace/company/${company.id}`} className="flex items-center gap-3 mt-6 p-3 rounded-lg" style={{ background: "#0B0F12" }}>
          {company.logo_url ? (
            <img src={company.logo_url} className="h-10 w-10 rounded-lg object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: "#1a1f25" }}>
              <Store className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-foreground">{company.name}</p>
            <p className="text-xs text-muted-foreground">{company.city}</p>
          </div>
        </Link>
      )}
    </main>
  );
};

export default MarketplaceProduct;
