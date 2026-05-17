import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Trophy, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/tenant/EmptyState";

export default function TenantCalendar() {
  const { tenant } = useTenant();
  const [byMonth, setByMonth] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant?.id) return;
    (async () => {
      setLoading(true);
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("tournaments")
        .select("id, name, start_date, end_date, modality, city, state")
        .eq("tenant_id", tenant.id)
        .gte("end_date", today)
        .order("start_date", { ascending: true });
      const grouped: Record<string, any[]> = {};
      (data ?? []).forEach((t: any) => {
        const k = (t.start_date ?? "").slice(0, 7) || "sem-data";
        if (!grouped[k]) grouped[k] = [];
        grouped[k].push(t);
      });
      setByMonth(grouped);
      setLoading(false);
    })();
  }, [tenant?.id]);

  const monthLabel = (k: string) => {
    if (k === "sem-data") return "Sem data";
    const [y, m] = k.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).replace(/^./, (c) => c.toUpperCase());
  };

  const months = Object.keys(byMonth).sort();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-foreground flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-primary" /> Calendário esportivo
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Próximos torneios da rede agrupados por mês.</p>
      </div>

      {loading ? (
        <div className="grid gap-3">{[1, 2].map((i) => <div key={i} className="h-32 bg-muted/40 animate-pulse rounded-lg" />)}</div>
      ) : months.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Sem torneios agendados"
          description="Crie o próximo torneio da rede para vê-lo no calendário."
          ctaLabel="Ir para torneios"
          ctaHref="/tenant/torneios"
        />
      ) : (
        <div className="space-y-6">
          {months.map((m) => (
            <div key={m}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">{monthLabel(m)}</h2>
              <div className="grid gap-2 md:grid-cols-2">
                {byMonth[m].map((t) => (
                  <Card key={t.id}>
                    <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-sm truncate">{t.name}</CardTitle>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {t.start_date} → {t.end_date} · {t.city}/{t.state}
                        </p>
                      </div>
                      {t.modality && <Badge variant="outline" className="shrink-0">{t.modality}</Badge>}
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Button asChild size="sm" variant="ghost" className="w-full justify-between">
                        <Link to={`/tournaments/${t.id}/manage`}>Gerenciar <ArrowRight className="h-3.5 w-3.5" /></Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
