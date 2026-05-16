import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { Link } from "react-router-dom";

interface Props { arenaId: string; }

export const ActiveTournamentsBlock = ({ arenaId }: Props) => {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (!arenaId) return;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await (supabase as any)
        .from("tournaments")
        .select("id, name, status, start_date, end_date")
        .eq("arena_id", arenaId)
        .in("status", ["ongoing", "in_progress", "open"])
        .lte("start_date", today)
        .gte("end_date", today)
        .limit(5);
      setItems((data as any[]) || []);
    })();
  }, [arenaId]);

  if (items.length === 0) return null;

  return (
    <section>
      <h2 className="font-display text-2xl tracking-wide text-foreground mb-3">TORNEIOS ATIVOS</h2>
      <div className="space-y-2">
        {items.map((t) => (
          <Link key={t.id} to={`/tournaments/${t.id}`}>
            <Card className="bg-card border-border hover:bg-muted/30 transition">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Trophy className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.status === "ongoing" || t.status === "in_progress" ? "Em andamento" : "Aberto"}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
};
