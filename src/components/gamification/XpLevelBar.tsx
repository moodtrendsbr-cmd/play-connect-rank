import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";

interface Props {
  athleteId: string;
}

// Inverse of level formula: level = floor(sqrt(lifetime/100)) + 1
// XP needed for level N = (N-1)^2 * 100
const xpForLevel = (level: number) => Math.pow(Math.max(level - 1, 0), 2) * 100;

const XpLevelBar = ({ athleteId }: Props) => {
  const [data, setData] = useState<{ lifetime_xp: number; level: number; weekly_points: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: summary } = await (supabase as any)
        .from("athlete_points_summary")
        .select("total_points, level, weekly_points")
        .eq("athlete_id", athleteId)
        .maybeSingle();
      if (!mounted) return;
      setData({
        lifetime_xp: summary?.total_points ?? 0,
        level: summary?.level ?? 1,
        weekly_points: summary?.weekly_points ?? 0,
      });
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [athleteId]);

  if (loading) {
    return <div className="h-16 rounded-lg animate-pulse" style={{ background: "#0B0F12" }} />;
  }

  const level = data?.level ?? 1;
  const lifetime = data?.lifetime_xp ?? 0;
  const currentLevelMin = xpForLevel(level);
  const nextLevelMin = xpForLevel(level + 1);
  const span = Math.max(nextLevelMin - currentLevelMin, 1);
  const progressed = Math.max(lifetime - currentLevelMin, 0);
  const pct = Math.min(100, Math.round((progressed / span) * 100));

  return (
    <div
      className="rounded-lg p-3"
      style={{ background: "#0B0F12", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="rounded-full p-1.5"
            style={{ background: "rgba(43,255,136,0.12)" }}
          >
            <Sparkles className="h-4 w-4" style={{ color: "#2BFF88" }} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Nível</p>
            <p className="text-base font-display leading-none text-foreground">
              {level}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">XP</p>
          <p className="text-sm text-foreground font-medium">{lifetime.toLocaleString("pt-BR")}</p>
        </div>
      </div>

      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.06)" }}
      >
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, #2BFF88 0%, #19C26A 100%)",
          }}
        />
      </div>
      <p className="text-[10px] mt-1 text-muted-foreground">
        {progressed} / {span} XP para o nível {level + 1}
      </p>
      {(data?.weekly_points ?? 0) > 0 && (
        <p className="text-[10px] mt-0.5" style={{ color: "#2BFF88" }}>
          +{data?.weekly_points} esta semana
        </p>
      )}
    </div>
  );
};

export default XpLevelBar;
