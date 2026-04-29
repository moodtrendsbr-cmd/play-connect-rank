import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, MapPin, Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface TournamentMemoriesProps {
  athleteId: string;
}

type Memory = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  start_date: string | null;
  end_date: string | null;
};

const TournamentMemories = ({ athleteId }: TournamentMemoriesProps) => {
  const [items, setItems] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const today = new Date().toISOString().split("T")[0];

      // Find paid enrollments for this athlete
      const { data: enrolls } = await supabase
        .from("enrollments")
        .select("tournament_id")
        .eq("user_id", athleteId)
        .eq("status", "paid");

      const ids = [...new Set((enrolls || []).map((e: any) => e.tournament_id))];
      if (ids.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      const { data: tdata } = await supabase
        .from("tournaments")
        .select("id, name, city, state, start_date, end_date")
        .in("id", ids)
        .lt("end_date", today)
        .order("end_date", { ascending: false })
        .limit(12);

      setItems((tdata as Memory[]) || []);
      setLoading(false);
    };
    load();
  }, [athleteId]);

  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-56 rounded-xl flex-shrink-0" />)}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Sem torneios encerrados ainda.</p>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
      {items.map((t) => {
        const year = t.end_date ? new Date(t.end_date).getFullYear() : "";
        return (
          <Link
            key={t.id}
            to={`/tournaments/${t.id}/brackets`}
            className="snap-start flex-shrink-0 w-56 rounded-xl border border-border bg-card overflow-hidden transition-all hover:border-primary/40 hover:shadow-[0_0_14px_hsl(110_100%_55%/0.12)]"
          >
            <div className="h-20 relative bg-gradient-to-br from-primary/15 to-muted">
              <div className="absolute top-2 right-2 rounded-full bg-background/80 backdrop-blur px-2 py-0.5 text-[10px] font-display tracking-wide text-primary">
                {year}
              </div>
              <Trophy className="absolute bottom-2 left-2 h-5 w-5 text-primary drop-shadow" />
            </div>
            <div className="p-3 space-y-1">
              <p className="text-sm font-semibold text-foreground truncate">{t.name}</p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                {t.city}{t.state ? `/${t.state}` : ""}
              </p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3 flex-shrink-0" />
                {t.start_date} → {t.end_date}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
};

export default TournamentMemories;
