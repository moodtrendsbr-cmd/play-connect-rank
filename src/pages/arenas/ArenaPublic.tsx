import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Grid3X3, Video, Instagram, Map, Globe, ExternalLink, ArrowLeft } from "lucide-react";

const ICON_MAP: Record<string, any> = {
  video: Video,
  instagram: Instagram,
  maps: Map,
  site: Globe,
  other: ExternalLink,
};

const ArenaPublic = () => {
  const { arenaSlug } = useParams();
  const { user } = useAuth();
  const [arena, setArena] = useState<any>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [courts, setCourts] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: arenaData } = await supabase.from("arenas_public").select("*").eq("slug", arenaSlug).maybeSingle();
      if (!arenaData) { setLoading(false); return; }
      setArena(arenaData);

      if (user?.id) {
        const { data: own } = await supabase.from("arenas").select("id").eq("slug", arenaSlug).eq("owner_user_id", user.id).maybeSingle();
        setIsOwner(!!own);
      }

      const [c, l, p, inv] = await Promise.all([
        supabase.from("courts").select("*").eq("arena_id", arenaData.id).eq("is_active", true).order("created_at"),
        supabase.from("arena_links").select("*").eq("arena_id", arenaData.id).eq("is_active", true).order("position_order"),
        supabase.from("arena_partners").select("*").eq("arena_id", arenaData.id).eq("is_active", true).order("position_order"),
        supabase.from("arena_physical_inventory").select("*").eq("arena_id", arenaData.id).eq("is_available", true).order("created_at"),
      ]);
      setCourts(c.data || []);
      setLinks(l.data || []);
      setPartners(p.data || []);
      setInventory(inv.data || []);
      setLoading(false);
    };
    load();
  }, [arenaSlug, user?.id]);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!arena) return <div className="text-center py-20 text-muted-foreground">Arena não encontrada</div>;

  return (
    <div className="space-y-6 pb-24">
      {isOwner && (
        <Link to="/arena/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar ao painel
        </Link>
      )}
      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden">
        {arena.cover_image_url ? (
          <img src={arena.cover_image_url} alt={arena.name} className="w-full h-48 object-cover" />
        ) : (
          <div className="w-full h-48 bg-muted/30 flex items-center justify-center">
            <Grid3X3 className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4">
          <h1 className="text-2xl font-display text-foreground">{arena.name}</h1>
          <div className="flex items-center gap-1 mt-1">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span className="text-sm text-muted-foreground">{arena.address ? `${arena.address}, ` : ""}{arena.city}, {arena.state}</span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-muted-foreground">{courts.length} quadra{courts.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      <Link to={`/arenas/${arenaSlug}/reservar`}>
        <Button className="w-full h-12 text-lg font-bold">Reservar quadra</Button>
      </Link>

      {/* Sobre */}
      {arena.description && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-base">Sobre / Infraestrutura</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{arena.description}</p></CardContent>
        </Card>
      )}

      {/* Regras */}
      {arena.rules && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-base">Regras de uso</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{arena.rules}</p></CardContent>
        </Card>
      )}

      {/* Links */}
      {links.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-base">Links</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {links.map((link) => {
                const Icon = ICON_MAP[link.icon_type] || ExternalLink;
                return (
                  <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                    <Icon className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="text-sm text-foreground truncate">{link.title}</span>
                  </a>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Partners */}
      {partners.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-base">Apoiadores da arena</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {partners.map((p) => (
                <a key={p.id} href={p.link_url || "#"} target={p.link_url ? "_blank" : undefined} rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-muted/30 transition-colors">
                  {p.logo_url ? (
                    <img src={p.logo_url} alt={p.name} className="h-12 w-12 rounded-lg object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-muted/50 flex items-center justify-center text-xs font-bold text-muted-foreground">{p.name.charAt(0)}</div>
                  )}
                  <span className="text-xs text-muted-foreground">{p.name}</span>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Physical Inventory */}
      {inventory.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-base">Espaços físicos disponíveis</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {inventory.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                <div>
                  <span className="text-sm font-medium text-foreground capitalize">{inv.space_type}</span>
                  {inv.description && <span className="text-xs text-muted-foreground ml-2">{inv.description}</span>}
                </div>
                {inv.price_monthly && <span className="text-xs font-bold text-primary">R$ {Number(inv.price_monthly).toFixed(2)}/mês</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ArenaPublic;
