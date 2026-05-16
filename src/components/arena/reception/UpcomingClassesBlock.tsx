import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap } from "lucide-react";

interface Props { arenaId: string; }
type C = { id: string; title: string; start_at: string; end_at: string; capacity: number; modality: string | null };

export const UpcomingClassesBlock = ({ arenaId }: Props) => {
  const [items, setItems] = useState<C[]>([]);

  useEffect(() => {
    if (!arenaId) return;
    const load = async () => {
      const now = new Date();
      const in3h = new Date(now.getTime() + 3 * 60 * 60_000);
      const { data } = await supabase
        .from("arena_classes")
        .select("id, title, start_at, end_at, capacity, modality")
        .eq("arena_id", arenaId)
        .gte("start_at", now.toISOString())
        .lte("start_at", in3h.toISOString())
        .neq("status", "canceled")
        .order("start_at", { ascending: true })
        .limit(6);
      setItems((data as any) || []);
    };
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [arenaId]);

  if (items.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-2xl tracking-wide text-foreground">PRÓXIMAS AULAS</h2>
      </div>
      <div className="space-y-2">
        {items.map((c) => {
          const start = new Date(c.start_at);
          return (
            <Card key={c.id} className="bg-card border-border">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <GraduationCap className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{c.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.modality || "Aula"} · {start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <Badge variant="outline" className="text-xs">{c.capacity} vagas</Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
};
