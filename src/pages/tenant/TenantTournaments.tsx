import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Calendar, Users, DollarSign, ExternalLink } from "lucide-react";

const TenantTournaments = () => {
  const { tenant } = useTenant();
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant?.id) return;
    const load = async () => {
      setLoading(true);
      const { data: t } = await supabase
        .from("tournaments")
        .select("*")
        .eq("tenant_id", tenant.id)
        .order("start_date", { ascending: false })
        .limit(100);

      const list = t || [];
      const ids = list.map((x) => x.id);

      let countsMap: Record<string, { paid: number; pending: number; revenue: number }> = {};
      if (ids.length) {
        const { data: enrolls } = await supabase
          .from("enrollments")
          .select("tournament_id, status, amount_paid")
          .in("tournament_id", ids);
        (enrolls || []).forEach((e: any) => {
          const k = e.tournament_id;
          if (!countsMap[k]) countsMap[k] = { paid: 0, pending: 0, revenue: 0 };
          if (e.status === "paid") {
            countsMap[k].paid += 1;
            countsMap[k].revenue += Number(e.amount_paid || 0);
          } else if (e.status === "pending") countsMap[k].pending += 1;
        });
      }

      setTournaments(list.map((x) => ({ ...x, ...countsMap[x.id] })));
      setLoading(false);
    };
    load();
  }, [tenant?.id]);

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="h-6 w-6" /> Torneios da rede
        </h1>
        <p className="text-sm text-muted-foreground">
          Todos os torneios vinculados a esta rede ({tenant?.name || "—"}).
        </p>
      </div>

      {loading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
        </div>
      ) : tournaments.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhum torneio cadastrado nesta rede ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {tournaments.map((t) => {
            const isActive = t.end_date >= today;
            return (
              <Card key={t.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    <Badge variant={isActive ? "default" : "outline"}>
                      {isActive ? "Ativo" : "Encerrado"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> {t.start_date} → {t.end_date} · {t.city}/{t.state}
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      <span><strong className="text-foreground">{t.paid || 0}</strong> pagos</span>
                    </div>
                    <div className="text-muted-foreground">
                      <strong className="text-foreground">{t.pending || 0}</strong> pend.
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
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TenantTournaments;
