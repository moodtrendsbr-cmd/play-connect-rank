import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Search, Store, ShoppingBag } from "lucide-react";

const CATEGORIES = [
  { label: "Todos", value: "" },
  { label: "Vestuário", value: "vestuario" },
  { label: "Acessórios", value: "acessorios" },
  { label: "Suplementos", value: "suplementos" },
  { label: "Fotografia", value: "fotografia" },
  { label: "Serviços", value: "servicos" },
  { label: "Locação", value: "locacao" },
];

const Marketplace = () => {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [userCity, setUserCity] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      supabase.from("profiles").select("city").eq("user_id", user.id).single().then(({ data }) => {
        setUserCity(data?.city || null);
      });
    }
  }, [user]);

  useEffect(() => {
    const fetchCompanies = async () => {
      setLoading(true);
      let query = supabase.from("companies").select("*").eq("status", "approved");
      if (category) query = query.eq("category", category);
      if (search) query = query.ilike("name", `%${search}%`);
      const { data } = await query;
      let list = data || [];
      // Sort local first
      if (userCity) {
        const local = list.filter((c) => c.city?.toLowerCase() === userCity.toLowerCase());
        const rest = list.filter((c) => c.city?.toLowerCase() !== userCity.toLowerCase());
        list = [...local, ...rest];
      }
      setCompanies(list);
      setLoading(false);
    };
    fetchCompanies();
  }, [search, category, userCity]);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center px-4 h-14" style={{ background: "#050708", borderBottom: "1px solid rgba(43,255,136,0.1)" }}>
        <ShoppingBag className="h-5 w-5 mr-2" style={{ color: "#2BFF88" }} />
        <span className="font-display text-lg tracking-wider" style={{ color: "#2BFF88" }}>MARKETPLACE</span>
      </header>

      <main className="pt-16 pb-20 px-4 max-w-xl mx-auto">
        <div className="flex items-center gap-2 rounded-full px-3 py-1.5 mb-4" style={{ background: "#0B0F12" }}>
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar empresas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className="whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: category === cat.value ? "#2BFF88" : "#0B0F12",
                color: category === cat.value ? "#050708" : "#9CA3AF",
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-muted-foreground">{companies.length} empresa(s)</p>
          <Link to="/marketplace/register" className="text-xs font-medium" style={{ color: "#2BFF88" }}>
            + Cadastrar empresa
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-lg animate-pulse" style={{ background: "#0B0F12" }} />
            ))}
          </div>
        ) : companies.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Store className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhuma empresa encontrada</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {companies.map((c) => (
              <Link
                key={c.id}
                to={`/marketplace/company/${c.id}`}
                className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:opacity-80"
                style={{ background: "#0B0F12" }}
              >
                {c.logo_url ? (
                  <img src={c.logo_url} alt={c.name} className="h-14 w-14 rounded-lg object-cover" />
                ) : (
                  <div className="h-14 w-14 rounded-lg flex items-center justify-center" style={{ background: "#1a1f25" }}>
                    <Store className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground truncate">{c.name}</h3>
                  <p className="text-xs text-muted-foreground">{c.city}{c.state ? `, ${c.state}` : ""}</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full mt-1 inline-block" style={{ background: "rgba(43,255,136,0.1)", color: "#2BFF88" }}>
                    {CATEGORIES.find((cat) => cat.value === c.category)?.label || c.category}
                  </span>
                </div>
                {c.highlight_enabled && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "#2BFF88", color: "#050708" }}>
                    Destaque
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}

        {user && (
          <div className="mt-6">
            <Link
              to="/marketplace/my-company"
              className="block text-center text-sm py-3 rounded-lg border transition-colors"
              style={{ borderColor: "rgba(43,255,136,0.2)", color: "#2BFF88" }}
            >
              Gerenciar minha empresa →
            </Link>
          </div>
        )}
      </main>
    </>
  );
};

export default Marketplace;
