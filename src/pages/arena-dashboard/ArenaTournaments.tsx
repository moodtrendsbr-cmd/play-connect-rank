import { useEffect, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Users, DollarSign, Calendar, ExternalLink } from "lucide-react";

const ArenaTournaments = () => {
  const { arena } = useOutletContext<{ arena: any }>();
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!arena) return;
    const load = async () => {
      // Prefer arena_id (post P2 backfill); fallback to legacy name match for unbound rows
      const orParts = [`arena_id.eq.${arena.id}`];
      if (arena.name) orParts.push(`arena.eq.${arena.name}`);
      if (arena.tenant_id) orParts.push(`tenant_id.eq.${arena.tenant_id}`);

      const { data: t } = await supabase
        .from("tournaments")
        .select("*")
        .or(orParts.join(","))
        .order("start_date", { ascending: false })
        .limit(50);

      const tournamentList = t || [];

      // Aggregate enrollments + revenue per tournament
      const ids = tournamentList.map((x) => x.id);
      let enrollMap: Record<string, { paid: number; pending: number; revenue: number }> = {};
      if (ids.length > 0) {
        const { data: enrolls } = await supabase
          .from("enrollments")
          .select("tournament_id, status, amount_paid")
          .in("tournament_id", ids);
        (enrolls || []).forEach((e: any) => {
          const key = e.tournament_id;
          if (!enrollMap[key]) enrollMap[key] = { paid: 0, pending: 0, revenue: 0 };
          if (e.status === "paid") {
            enrollMap[key].paid += 1;
            enrollMap[key].revenue += Number(e.amount_paid || 0);
          } else if (e.status === "pending") {
            enrollMap[key].pending += 1;
          }
        });
      }

      const enriched = tournamentList.map((x) => ({ ...x, ...enrollMap[x.id] }));
      setTournaments(enriched);
      setLoading(false);
    };
    load();
  }, [arena]);

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="h-6 w-6" /> Torneios
        </h1>
        <p className="text-sm text-muted-foreground">Torneios vinculados a esta arena ou ao seu organizador.</p>
      </div>

      {tournaments.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum torneio encontrado.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {tournaments.map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  <Badge variant={t.status === "active" ? "default" : "secondary"}>{t.status || "—"}</Badge>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {t.start_date} → {t.end_date}
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span><strong className="text-foreground">{t.paid || 0}</strong> pagos</span>
                  </div>
                  <div className="text-muted-foreground">
                    <span><strong className="text-foreground">{t.pending || 0}</strong> pend.</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <DollarSign className="h-3.5 w-3.5" />
                    <strong className="text-foreground">R$ {Number(t.revenue || 0).toFixed(2)}</strong>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button asChild size="sm" variant="outline" className="flex-1">
                    <Link to={`/tournaments/${t.id}/manage`}>Gerenciar</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/tournaments/${t.id}`}><ExternalLink className="h-3.5 w-3.5" /></Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ArenaTournaments;
