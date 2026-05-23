import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Layers, CalendarDays, Building2, Trophy, Store, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/tenant/EmptyState";

type Circuit = {
  id: string; name: string; description: string | null; cover_image_url: string | null;
  start_date: string | null; end_date: string | null;
};

type Tournament = {
  id: string; name: string; start_date: string | null; end_date: string | null;
  arena: string | null; city: string | null; state: string | null; status: string | null;
};

export default function TenantCircuitDetail() {
  const { id } = useParams();
  const [circuit, setCircuit] = useState<Circuit | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [sponsors, setSponsors] = useState<{ company_id: string; name: string; logo_url: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data: c } = await supabase.from("circuits" as any).select("*").eq("id", id).maybeSingle();
      const circ = (c as unknown as Circuit) ?? null;
      setCircuit(circ);

      const { data: ts } = await supabase
        .from("tournaments")
        .select("id, name, start_date, end_date, arena, city, state, status, tenant_id")
        .eq("circuit_id", id)
        .order("start_date", { ascending: true });
      const list = (ts ?? []) as Tournament[];
      setTournaments(list);

      // Patrocinadores — derivar via tournaments do circuito
      if (list.length > 0 && circ) {
        const tIds = list.map((t) => t.id);
        const { data: links } = await supabase
          .from("sponsor_arena_links" as any)
          .select("company_id, companies:company_id(id,name,logo_url)")
          .in("tournament_id", tIds);
        const seen = new Map<string, any>();
        (links ?? []).forEach((l: any) => {
          const co = l.companies;
          if (co && !seen.has(co.id)) seen.set(co.id, { company_id: co.id, name: co.name, logo_url: co.logo_url });
        });
        setSponsors([...seen.values()]);
      } else {
        setSponsors([]);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!circuit) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm"><Link to="/tenant/circuitos"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Link></Button>
        <p className="text-sm text-muted-foreground">Circuito não encontrado.</p>
      </div>
    );
  }

  const now = new Date();
  const upcoming = tournaments.filter((t) => t.end_date && new Date(t.end_date) >= now);
  const finished = tournaments.filter((t) => t.end_date && new Date(t.end_date) < now);
  const arenas = [...new Set(tournaments.map((t) => t.arena).filter(Boolean))] as string[];

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/tenant/circuitos"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar para circuitos</Link>
      </Button>

      <div className="flex items-start gap-4 flex-wrap">
        <div className="h-16 w-16 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 overflow-hidden">
          {circuit.cover_image_url ? <img src={circuit.cover_image_url} alt="" className="h-full w-full object-cover" /> : <Layers className="h-7 w-7" />}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl text-foreground truncate">{circuit.name}</h1>
          {(circuit.start_date || circuit.end_date) && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <CalendarDays className="h-3 w-3" /> {circuit.start_date ?? "—"} → {circuit.end_date ?? "—"}
            </p>
          )}
          {circuit.description && <p className="text-sm text-muted-foreground mt-2">{circuit.description}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Etapas</p><p className="text-2xl font-semibold tabular-nums">{tournaments.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Arenas</p><p className="text-2xl font-semibold tabular-nums">{arenas.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Próximas</p><p className="text-2xl font-semibold tabular-nums">{upcoming.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Patrocinadores</p><p className="text-2xl font-semibold tabular-nums">{sponsors.length}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Trophy className="h-4 w-4" /> Etapas</CardTitle></CardHeader>
        <CardContent>
          {tournaments.length === 0 ? (
            <EmptyState icon={Trophy} title="Sem etapas ainda" description="Crie torneios e vincule a este circuito para montar a sequência." />
          ) : (
            <ul className="divide-y divide-border">
              {tournaments.map((t) => {
                const past = !!t.end_date && new Date(t.end_date) < now;
                return (
                  <li key={t.id} className="flex items-center justify-between py-2 gap-3">
                    <div className="min-w-0">
                      <Link to={`/tournaments/${t.id}`} className="text-sm font-medium hover:underline truncate block">{t.name}</Link>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {[t.arena, t.city && `${t.city}/${t.state}`, t.start_date].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <Badge variant={past ? "outline" : "secondary"} className="shrink-0 text-[10px]">{past ? "Concluído" : "Próximo"}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Building2 className="h-4 w-4" /> Arenas envolvidas</CardTitle></CardHeader>
          <CardContent>
            {arenas.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : (
              <ul className="space-y-1">{arenas.map((a) => <li key={a} className="text-sm">{a}</li>)}</ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Store className="h-4 w-4" /> Patrocinadores</CardTitle></CardHeader>
          <CardContent>
            {sponsors.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum patrocínio vinculado às etapas.</p> : (
              <ul className="space-y-2">
                {sponsors.map((s) => (
                  <li key={s.company_id} className="flex items-center gap-2 text-sm">
                    {s.logo_url ? <img src={s.logo_url} alt="" className="h-6 w-6 rounded object-cover" /> : <div className="h-6 w-6 rounded bg-primary/10" />}
                    <span className="truncate">{s.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {finished.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Etapas concluídas</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {finished.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                  <Link to={`/tournaments/${t.id}`} className="hover:underline truncate">{t.name}</Link>
                  <span className="text-[11px] text-muted-foreground">{t.end_date}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
