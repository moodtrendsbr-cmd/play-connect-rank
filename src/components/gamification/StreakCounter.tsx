import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Flame } from "lucide-react";

interface Props {
  athleteId: string;
}

const StreakCounter = ({ athleteId }: Props) => {
  const [data, setData] = useState<{ current_streak: number; longest_streak: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await (supabase as any)
        .from("athlete_streaks")
        .select("current_streak, longest_streak")
        .eq("athlete_id", athleteId)
        .maybeSingle();
      if (!mounted) return;
      setData(data || { current_streak: 0, longest_streak: 0 });
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [athleteId]);

  if (loading) {
    return <div className="h-16 rounded-lg animate-pulse" style={{ background: "#0B0F12" }} />;
  }

  const current = data?.current_streak ?? 0;
  const longest = data?.longest_streak ?? 0;
  const active = current > 0;

  return (
    <div
      className="rounded-lg p-3 flex items-center gap-3"
      style={{ background: "#0B0F12", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div
        className="rounded-full p-2"
        style={{ background: active ? "rgba(255,138,43,0.15)" : "rgba(255,255,255,0.04)" }}
      >
        <Flame
          className="h-5 w-5"
          style={{ color: active ? "#FF8A2B" : "rgba(255,255,255,0.4)" }}
        />
      </div>
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">Ofensiva</p>
        <p className="text-base font-display leading-tight text-foreground">
          {current} {current === 1 ? "dia" : "dias"}
        </p>
      </div>
      <div className="text-right">
        <p className="text-[10px] text-muted-foreground">Recorde</p>
        <p className="text-sm font-medium text-foreground">{longest}</p>
      </div>
    </div>
  );
};

export default StreakCounter;
