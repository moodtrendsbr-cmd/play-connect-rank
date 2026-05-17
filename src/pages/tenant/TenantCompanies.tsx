import { useEffect, useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Store, Plus, Link2, Loader2, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/tenant/EmptyState";
import { toast } from "@/hooks/use-toast";

type Company = { id: string; name: string; logo_url: string | null; city: string | null; state: string | null; category: string | null };
type Arena = { id: string; name: string };
type Link = { id: string; company_id: string; arena_id: string; is_active: boolean };

export default function TenantCompanies() {
  const { tenant } = useTenant();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogCompanyId, setDialogCompanyId] = useState<string | null>(null);
  const [arenaToLink, setArenaToLink] = useState<string>("");
  const [linking, setLinking] = useState(false);

  const load = async () => {
    if (!tenant?.id) return;
    setLoading(true);
    const [c, a, l] = await Promise.all([
      supabase.from("companies").select("id, name, logo_url, city, state, category").eq("tenant_id", tenant.id),
      supabase.from("arenas").select("id, name").eq("tenant_id", tenant.id),
      supabase.from("sponsor_arena_links" as any).select("id, company_id, arena_id, is_active").eq("tenant_id", tenant.id),
    ]);
    setCompanies((c.data ?? []) as Company[]);
    setArenas((a.data ?? []) as Arena[]);
    setLinks((l.data ?? []) as Link[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tenant?.id]);

  const handleLink = async () => {
    if (!tenant?.id || !dialogCompanyId || !arenaToLink) return;
    setLinking(true);
    const { error } = await supabase.from("sponsor_arena_links" as any).insert({
      tenant_id: tenant.id, company_id: dialogCompanyId, arena_id: arenaToLink, is_active: true,
    });
    setLinking(false);
    if (error) toast({ title: "Erro ao vincular", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Patrocinador vinculado", description: "Arena ligada com sucesso." });
      setArenaToLink(""); setDialogCompanyId(null);
      load();
    }
  };

  const handleUnlink = async (id: string) => {
    const { error } = await supabase.from("sponsor_arena_links" as any).delete().eq("id", id);
    if (error) toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    else { toast({ title: "Vínculo removido" }); load(); }
  };

  const linksByCompany = (cid: string) => links.filter((l) => l.company_id === cid);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl text-foreground flex items-center gap-2">
            <Store className="h-6 w-6 text-primary" /> Empresas e patrocinadores
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Marcas vinculadas à rede. Conecte-as a arenas e torneios para criar ativações.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 bg-muted/40 animate-pulse rounded-lg" />)}
        </div>
      ) : companies.length === 0 ? (
        <EmptyState
          icon={Store}
          title="Nenhuma empresa parceira ainda"
          description="Conecte marcas que querem patrocinar suas arenas e torneios. Elas aparecerão aqui."
          ctaLabel="Convidar empresa"
          ctaHref="/marketplace/register"
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {companies.map((c) => {
            const cLinks = linksByCompany(c.id);
            return (
              <Card key={c.id}>
                <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    {c.logo_url ? (
                      <img src={c.logo_url} alt={c.name} className="h-10 w-10 rounded-md object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                        <Store className="h-4 w-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-semibold truncate">{c.name}</CardTitle>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {[c.city, c.state].filter(Boolean).join("/")} {c.category ? `· ${c.category}` : ""}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0">{cLinks.length} arena{cLinks.length !== 1 ? "s" : ""}</Badge>
                </CardHeader>
                <CardContent className="space-y-2">
                  {cLinks.length > 0 && (
                    <ul className="space-y-1">
                      {cLinks.map((l) => {
                        const arena = arenas.find((a) => a.id === l.arena_id);
                        return (
                          <li key={l.id} className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1">
                            <span className="truncate">{arena?.name ?? "Arena removida"}</span>
                            <button onClick={() => handleUnlink(l.id)} className="text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <Dialog open={dialogCompanyId === c.id} onOpenChange={(o) => { setDialogCompanyId(o ? c.id : null); setArenaToLink(""); }}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full">
                        <Link2 className="mr-2 h-3.5 w-3.5" /> Vincular a uma arena
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Vincular {c.name} a uma arena</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <Label>Arena</Label>
                        <Select value={arenaToLink} onValueChange={setArenaToLink}>
                          <SelectTrigger><SelectValue placeholder="Escolha uma arena" /></SelectTrigger>
                          <SelectContent>
                            {arenas
                              .filter((a) => !cLinks.some((l) => l.arena_id === a.id))
                              .map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button onClick={handleLink} disabled={!arenaToLink || linking} className="w-full">
                          {linking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Confirmar vínculo
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
