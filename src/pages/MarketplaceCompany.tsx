import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Store, ArrowLeft, Mail, Phone, MapPin, MessageCircle } from "lucide-react";

const MarketplaceCompany = () => {
  const { companyId } = useParams();
  const [company, setCompany] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [compRes, prodRes] = await Promise.all([
        supabase.from("companies").select("*").eq("id", companyId).single(),
        supabase.from("products").select("*").eq("company_id", companyId).eq("status", "approved"),
      ]);
      setCompany(compRes.data);
      setProducts(prodRes.data || []);
      setLoading(false);
    };
    if (companyId) fetch();
  }, [companyId]);

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Carregando...</div>;
  if (!company) return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Empresa não encontrada</div>;

  const whatsappLink = company.whatsapp
    ? `https://wa.me/55${company.whatsapp.replace(/\D/g, "")}`
    : null;

  return (
    <main className="pt-4 pb-20 px-4 max-w-xl mx-auto">
      <Link to="/marketplace" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="flex items-center gap-4 mb-4">
        {company.logo_url ? (
          <img src={company.logo_url} alt={company.name} className="h-20 w-20 rounded-xl object-cover" />
        ) : (
          <div className="h-20 w-20 rounded-xl flex items-center justify-center" style={{ background: "#0B0F12" }}>
            <Store className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-display text-foreground">{company.name}</h1>
          <p className="text-sm text-muted-foreground">{company.city}{company.state ? `, ${company.state}` : ""}</p>
        </div>
      </div>

      {company.description && <p className="text-sm text-muted-foreground mb-4">{company.description}</p>}

      {/* Contact & Address Section */}
      <div className="rounded-lg p-4 mb-6 space-y-2" style={{ background: "#0B0F12" }}>
        <h3 className="text-sm font-medium text-foreground mb-2">Contato</h3>
        {company.email && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4 shrink-0" />
            <a href={`mailto:${company.email}`} className="hover:underline">{company.email}</a>
          </div>
        )}
        {company.whatsapp && (
          <div className="flex items-center gap-2 text-sm">
            <MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
            <a href={whatsappLink!} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: "#2BFF88" }}>
              {company.whatsapp}
            </a>
          </div>
        )}
        {company.phone && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4 shrink-0" />
            <span>{company.phone}</span>
          </div>
        )}
        {(company.address || company.zip_code) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            <span>{[company.address, company.city, company.state, company.zip_code].filter(Boolean).join(", ")}</span>
          </div>
        )}
      </div>

      <h2 className="font-display text-lg text-foreground mb-3">PRODUTOS</h2>

      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">Nenhum produto disponível</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {products.map((p) => (
            <Link
              key={p.id}
              to={`/marketplace/product/${p.id}`}
              className="rounded-lg overflow-hidden transition-opacity hover:opacity-80"
              style={{ background: "#0B0F12" }}
            >
              {p.image_urls?.[0] ? (
                <img src={p.image_urls[0]} alt={p.name} className="w-full h-32 object-cover" />
              ) : (
                <div className="w-full h-32 flex items-center justify-center" style={{ background: "#1a1f25" }}>
                  <Store className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="p-2">
                <h3 className="text-sm font-medium text-foreground truncate">{p.name}</h3>
                <p className="text-sm font-bold" style={{ color: "#2BFF88" }}>R$ {Number(p.price).toFixed(2)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
};

export default MarketplaceCompany;
