import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Store, ShoppingBag, Star } from "lucide-react";
import AdSlot from "@/components/ads/AdSlot";
import { useFeaturedSet } from "@/hooks/useFeaturedSet";
import FeaturedBadge from "@/components/featured/FeaturedBadge";

const CATEGORIES = [
  { label: "Todos", value: "" },
  { label: "Vestuário", value: "vestuario" },
  { label: "Acessórios", value: "acessorios" },
  { label: "Suplementos", value: "suplementos" },
  { label: "Fotografia", value: "fotografia" },
  { label: "Serviços", value: "servicos" },
  { label: "Locação", value: "locacao" },
];

const PLAN_PRIORITY: Record<string, number> = { elite: 3, pro: 2, free: 1 };

const Marketplace = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [userCity, setUserCity] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasCompany, setHasCompany] = useState(false);
  const { featuredSet: featuredProducts } = useFeaturedSet("product");

  useEffect(() => {
    if (user) {
      supabase.from("companies").select("id").eq("owner_user_id", user.id).maybeSingle().then(({ data }) => {
        setHasCompany(!!data);
      });
    }
  }, [user]);

  const handleSellCTA = () => {
    if (user && hasCompany) {
      navigate("/marketplace/my-company");
    } else {
      navigate("/marketplace/register");
    }
  };

  useEffect(() => {
    if (user) {
      supabase.from("profiles").select("city").eq("user_id", user.id).single().then(({ data }) => {
        setUserCity(data?.city || null);
      });
    }
  }, [user]);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("marketplace_public" as any)
        .select("*")
        .order("created_at", { ascending: false });

      let list = ((data as any[]) || []);

      if (search) {
        const term = search.toLowerCase();
        list = list.filter((p: any) =>
          p.name?.toLowerCase().includes(term) || p.company_name?.toLowerCase().includes(term)
        );
      }

      // Filter by category (companies category not in view; fallback to client-side via separate fetch)
      if (category) {
        const ids = list.map((p: any) => p.company_id);
        if (ids.length) {
          const { data: cos } = await supabase.from("companies").select("id, category").in("id", ids);
          const set = new Set((cos || []).filter((c: any) => c.category === category).map((c: any) => c.id));
          list = list.filter((p: any) => set.has(p.company_id));
        }
      }

      list.sort((a: any, b: any) => {
        const aFeat = featuredProducts.has(a.id) || a.featured;
        const bFeat = featuredProducts.has(b.id) || b.featured;
        if (aFeat !== bFeat) return aFeat ? -1 : 1;
        if (userCity) {
          const aLocal = a.city?.toLowerCase() === userCity.toLowerCase();
          const bLocal = b.city?.toLowerCase() === userCity.toLowerCase();
          if (aLocal !== bLocal) return aLocal ? -1 : 1;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setProducts(list);
      setLoading(false);
    };
    fetchProducts();
  }, [search, category, userCity, featuredProducts]);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-14" style={{ background: "#050708", borderBottom: "1px solid rgba(43,255,136,0.1)" }}>
        <div className="flex items-center">
          <ShoppingBag className="h-5 w-5 mr-2" style={{ color: "#2BFF88" }} />
          <span className="font-display text-lg tracking-wider" style={{ color: "#2BFF88" }}>MARKETPLACE</span>
        </div>
        <button
          onClick={handleSellCTA}
          className="text-xs font-medium px-3 py-1 rounded-full border transition-opacity hover:opacity-80"
          style={{ borderColor: "rgba(43,255,136,0.4)", color: "#2BFF88" }}
        >
          Vender produtos
        </button>
      </header>

      <main className="pt-16 pb-20 px-4 max-w-xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-full px-3 py-1.5 text-xs font-medium outline-none appearance-none cursor-pointer shrink-0"
            style={{ background: "#0B0F12", color: "#9CA3AF", border: "1px solid rgba(43,255,136,0.15)" }}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
          <div className="flex items-center gap-2 rounded-full px-3 py-1.5 flex-1 min-w-0" style={{ background: "#0B0F12" }}>
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Buscar produtos ou empresas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
            />
          </div>
        </div>

        <AdSlot code="marketplace.featured" className="mb-4" />

        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-muted-foreground">{products.length} produto(s)</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-48 rounded-lg animate-pulse" style={{ background: "#0B0F12" }} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Store className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum produto encontrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map((p) => (
              <Link
                key={p.id}
                to={`/marketplace/company/${p.company_id}`}
                className="rounded-lg overflow-hidden transition-opacity hover:opacity-80 relative"
                style={{ background: "#0B0F12" }}
              >
                {p.featured && (
                  <span className="absolute top-2 left-2 z-10 flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "#2BFF88", color: "#050708" }}>
                    <Star className="h-3 w-3" /> Destaque
                  </span>
                )}
                {p.image_urls?.[0] ? (
                  <img src={p.image_urls[0]} alt={p.name} className="w-full h-36 object-cover" />
                ) : (
                  <div className="w-full h-36 flex items-center justify-center" style={{ background: "#1a1f25" }}>
                    <Store className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="p-2">
                  <h3 className="text-sm font-medium text-foreground truncate">{p.name}</h3>
                  <p className="text-sm font-bold" style={{ color: "#2BFF88" }}>R$ {Number(p.price).toFixed(2)}</p>
                  {p.company_name && (
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">{p.company_name}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

      </main>

    </>
  );
};

export default Marketplace;
