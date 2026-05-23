import { useEffect, useMemo, useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Store, Link2, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/tenant/EmptyState";
import { toast } from "@/hooks/use-toast";

type Company = { id: string; name: string; logo_url: string | null; city: string | null; state: string | null; category: string | null };
type Arena = { id: string; name: string };
type Tournament = { id: string; name: string; arena_id: string | null };
type SponsorLink = {
  id: string;
  company_id: string;
  arena_id: string;
  tournament_id: string | null;
  contract_start: string | null;
  contract_end: string | null;
  is_active: boolean;
};

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
const daysUntil = (iso: string | null) => {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
};

export default function TenantCompanies() {
  const { tenant } = useTenant();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [links, setLinks] = useState<SponsorLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogCompanyId, setDialogCompanyId] = useState<string | null>(null);
  const [arenaToLink, setArenaToLink] = useState<string>("");
  const [tournamentToLink, setTournamentToLink] = useState<string>("");
  const [contractStart, setContractStart] = useState<string>("");
  const [contractEnd, setContractEnd] = useState<string>("");
  const [linking, setLinking] = useState(false);

  const load = async () => {
    if (!tenant?.id) return;
    setLoading(true);
    const [c, a, l, t] = await Promise.all([
      supabase.from("companies").select("id, name, logo_url, city, state, category").eq("tenant_id", tenant.id),
      supabase.from("arenas").select("id, name").eq("tenant_id", tenant.id),
      supabase.from("sponsor_arena_links" as any).select("id, company_id, arena_id, tournament_id, contract_start, contract_end, is_active").eq("tenant_id", tenant.id),
      supabase.from("tournaments").select("id, name, arena_id").eq("tenant_id", tenant.id).order("start_date", { ascending: false }).limit(200),
    ]);
    setCompanies((c.data ?? []) as Company[]);
    setArenas((a.data ?? []) as Arena[]);
    setLinks((l.data ?? []) as unknown as SponsorLink[]);
    setTournaments((t.data ?? []) as Tournament[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tenant?.id]);

  const resetDialog = () => {
    setArenaToLink(""); setTournamentToLink(""); setContractStart(""); setContractEnd(""); setDialogCompanyId(null);
  };

  const handleLink = async () => {
    if (!tenant?.id || !dialogCompanyId || !arenaToLink) return;
    setLinking(true);
    const { error } = await supabase.from("sponsor_arena_links" as any).insert({
      tenant_id: tenant.id,
      company_id: dialogCompanyId,
      arena_id: arenaToLink,
      tournament_id: tournamentToLink || null,
      contract_start: contractStart || null,
      contract_end: contractEnd || null,
      is_active: true,
    });
    setLinking(false);
    if (error) toast({ title: "Erro ao vincular", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Patrocinador vinculado" });
      resetDialog();
      load();
    }
  };

  const handleUnlink = async (id: string) => {
    const { error } = await supabase.from("sponsor_arena_links" as any).delete().eq("id", id);
    if (error) toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    else { toast({ title: "Vínculo removido" }); load(); }
  };

  const linksByCompany = (cid: string) => links.filter((l) => l.company_id === cid);

  const upcomingRenewals = useMemo(() => {
    return links
      .map((l) => ({ link: l, days: daysUntil(l.contract_end) }))
      .filter((x) => x.days !== null && x.days >= 0 && x.days <= 30)
      .sort((a, b) => (a.days ?? 0) - (b.days ?? 0));
  }, [links]);

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

      {upcomingRenewals.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Próximos vencimentos (30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {upcomingRenewals.map(({ link, days }) => {
                const company = companies.find((c) => c.id === link.company_id);
                const arena = arenas.find((a) => a.id === link.arena_id);
                const tour = tournaments.find((t) => t.id === link.tournament_id);
                return (
                  <li key={link.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{company?.name ?? "Empresa"} → {arena?.name ?? "Arena"}</p>
                      <p className="text-muted-foreground truncate">
                        {tour ? `Torneio · ${tour.name}` : "Patrocínio de arena"} · vence {fmtDate(link.contract_end)}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-amber-500 border-amber-500/40">
                      {days === 0 ? "Hoje" : `${days}d`}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

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
                  <Badge variant="outline" className="shrink-0">{cLinks.length} ativação{cLinks.length !== 1 ? "s" : ""}</Badge>
                </CardHeader>
                <CardContent className="space-y-2">
                  {cLinks.length > 0 && (
                    <ul className="space-y-1">
                      {cLinks.map((l) => {
                        const arena = arenas.find((a) => a.id === l.arena_id);
                        const tour = tournaments.find((t) => t.id === l.tournament_id);
                        return (
                          <li key={l.id} className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1.5">
                            <div className="min-w-0">
                              <p className="font-medium truncate">{arena?.name ?? "Arena removida"}</p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {tour ? `Torneio · ${tour.name}` : "Patrocínio de arena"}
                                {l.contract_end ? ` · até ${fmtDate(l.contract_end)}` : ""}
                              </p>
                            </div>
                            <button onClick={() => handleUnlink(l.id)} className="text-muted-foreground hover:text-destructive shrink-0 ml-2">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <Dialog
                    open={dialogCompanyId === c.id}
                    onOpenChange={(o) => { if (o) setDialogCompanyId(c.id); else resetDialog(); }}
                  >
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full">
                        <Link2 className="mr-2 h-3.5 w-3.5" /> Nova ativação
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Vincular {c.name}</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <div>
                          <Label>Arena</Label>
                          <Select value={arenaToLink} onValueChange={setArenaToLink}>
                            <SelectTrigger><SelectValue placeholder="Escolha uma arena" /></SelectTrigger>
                            <SelectContent>
                              {arenas.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Torneio (opcional)</Label>
                          <Select value={tournamentToLink || "__none__"} onValueChange={(v) => setTournamentToLink(v === "__none__" ? "" : v)}>
                            <SelectTrigger><SelectValue placeholder="Patrocínio geral da arena" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Patrocínio geral da arena</SelectItem>
                              {tournaments
                                .filter((t) => !arenaToLink || t.arena_id === arenaToLink)
                                .map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Início do contrato</Label>
                            <Input type="date" value={contractStart} onChange={(e) => setContractStart(e.target.value)} />
                          </div>
                          <div>
                            <Label className="text-xs">Fim do contrato</Label>
                            <Input type="date" value={contractEnd} onChange={(e) => setContractEnd(e.target.value)} />
                          </div>
                        </div>
                        <Button onClick={handleLink} disabled={!arenaToLink || linking} className="w-full">
                          {linking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Confirmar ativação
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
