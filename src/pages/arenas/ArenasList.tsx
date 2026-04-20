import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Grid3X3, Search } from "lucide-react";

const ArenasList = () => {
  const [arenas, setArenas] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArenas = async () => {
      let q = supabase.from("arenas_public").select("*, courts(id, price_per_hour)");
      const { data } = await q.order("name");
      setArenas(data || []);
      setLoading(false);
    };
    fetchArenas();
  }, []);

  const filtered = arenas.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.city.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-24">
      <div className="pt-4">
        <h1 className="text-2xl font-display text-foreground">Arenas</h1>
        <p className="text-sm text-muted-foreground mt-1">Encontre e reserve quadras</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou cidade..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 rounded-xl bg-muted/30 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">Nenhuma arena encontrada</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((arena) => {
            const courtCount = arena.courts?.length || 0;
            const prices = (arena.courts || []).map((c: any) => Number(c.price_per_hour)).filter((p: number) => p > 0);
            const minPrice = prices.length > 0 ? Math.min(...prices) : null;

            return (
              <Link key={arena.id} to={`/arenas/${arena.slug}`}>
                <Card className="bg-card border-border hover:border-primary/40 transition-colors overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex">
                      {arena.cover_image_url ? (
                        <img src={arena.cover_image_url} alt={arena.name} className="w-28 h-28 object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-28 h-28 bg-muted/50 flex items-center justify-center flex-shrink-0">
                          <Grid3X3 className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <div className="p-3 flex flex-col justify-between flex-1 min-w-0">
                        <div>
                          <h3 className="font-bold text-foreground truncate">{arena.name}</h3>
                          <div className="flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{arena.city}, {arena.state}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">{courtCount} quadra{courtCount !== 1 ? "s" : ""}</span>
                            {minPrice && <span className="text-xs font-bold text-primary">A partir de R$ {minPrice.toFixed(0)}/h</span>}
                          </div>
                          <Button size="sm" variant="outline" className="text-xs h-7">Ver arena</Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ArenasList;
