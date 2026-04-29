import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Trophy, Swords, Crown, Calendar, Activity, Heart, Flag, Flame, Lock, Award,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  athleteId: string;
}

const ICON_MAP: Record<string, any> = {
  Trophy, Swords, Crown, Calendar, Activity, Heart, Flag, Flame, Award,
};

interface BadgeRow {
  code: string;
  name: string;
  description: string;
  icon: string | null;
  category: string;
  xp_reward: number;
}

const BadgesGrid = ({ athleteId }: Props) => {
  const [catalog, setCatalog] = useState<BadgeRow[]>([]);
  const [earned, setEarned] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [catRes, earnedRes] = await Promise.all([
        (supabase as any)
          .from("badges_catalog")
          .select("code,name,description,icon,category,xp_reward")
          .eq("active", true)
          .order("category"),
        (supabase as any)
          .from("athlete_badges")
          .select("badge_code")
          .eq("athlete_id", athleteId),
      ]);
      if (!mounted) return;
      setCatalog((catRes.data as BadgeRow[]) || []);
      setEarned(new Set(((earnedRes.data as any[]) || []).map((b) => b.badge_code)));
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [athleteId]);

  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-lg animate-pulse" style={{ background: "#0B0F12" }} />
        ))}
      </div>
    );
  }

  if (catalog.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma conquista disponível.</p>;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="grid grid-cols-4 gap-2">
        {catalog.map((b) => {
          const isEarned = earned.has(b.code);
          const Icon = ICON_MAP[b.icon || "Award"] || Award;
          return (
            <Tooltip key={b.code}>
              <TooltipTrigger asChild>
                <div
                  className="aspect-square rounded-lg flex flex-col items-center justify-center p-2 transition-all"
                  style={{
                    background: isEarned ? "rgba(43,255,136,0.08)" : "#0B0F12",
                    border: isEarned
                      ? "1px solid rgba(43,255,136,0.4)"
                      : "1px solid rgba(255,255,255,0.06)",
                    opacity: isEarned ? 1 : 0.5,
                  }}
                >
                  {isEarned ? (
                    <Icon className="h-6 w-6" style={{ color: "#2BFF88" }} />
                  ) : (
                    <Lock className="h-5 w-5 text-muted-foreground" />
                  )}
                  <p
                    className="text-[9px] text-center mt-1 leading-tight line-clamp-2"
                    style={{ color: isEarned ? "#fff" : "rgba(255,255,255,0.5)" }}
                  >
                    {b.name}
                  </p>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px]">
                <p className="font-medium text-xs">{b.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{b.description}</p>
                {!isEarned && b.xp_reward > 0 && (
                  <p className="text-[10px] mt-1" style={{ color: "#2BFF88" }}>
                    Recompensa: +{b.xp_reward} XP
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
};

export default BadgesGrid;
