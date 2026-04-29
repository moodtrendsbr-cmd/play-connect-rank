import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy } from "lucide-react";

interface Props {
  athleteId: string;
}

const RankPosition = ({ athleteId }: Props) => {
  const [position, setPosition] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await (supabase as any)
        .from("ranking_global")
        .select("position")
        .eq("athlete_id", athleteId)
        .maybeSingle();
      if (!mounted) return;
      setPosition(data?.position ?? null);
    })();
    return () => { mounted = false; };
  }, [athleteId]);

  if (!position) return null;

  return (
    <div
      className="flex items-center gap-2 rounded-lg px-3 py-2"
      style={{ background: "#0B0F12", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <Trophy className="h-4 w-4" style={{ color: "#2BFF88" }} />
      <p className="text-xs text-muted-foreground">
        Posição global: <span className="text-foreground font-medium">#{position}</span>
      </p>
    </div>
  );
};

export default RankPosition;
