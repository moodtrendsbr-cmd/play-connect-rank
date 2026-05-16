import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Flame, Users, Clock } from "lucide-react";

type Variant = "playing_now" | "busy_arena" | "starting_soon";

interface Props {
  variant: Variant;
  arenaId?: string;
  count?: number;
}

const COPY: Record<Variant, (n: number) => string> = {
  playing_now: (n) => `${n} ${n === 1 ? "pessoa jogando" : "pessoas jogando"} agora`,
  busy_arena: () => `Arena movimentada`,
  starting_soon: () => `Torneio começando`,
};

const ICON: Record<Variant, JSX.Element> = {
  playing_now: <Users className="h-3 w-3" />,
  busy_arena: <Flame className="h-3 w-3" />,
  starting_soon: <Clock className="h-3 w-3" />,
};

export const LiveBadge = ({ variant, arenaId, count: providedCount }: Props) => {
  const [count, setCount] = useState<number | null>(providedCount ?? null);
  const [show, setShow] = useState(providedCount !== undefined);

  useEffect(() => {
    if (providedCount !== undefined) return;
    (async () => {
      if (variant === "playing_now") {
        let q = (supabase as any).from("modality_matches").select("id", { count: "exact", head: true }).eq("status", "in_progress");
        if (arenaId) q = q.eq("arena_id", arenaId);
        const { count: c } = await q;
        setCount(c ?? 0);
        setShow((c ?? 0) > 0);
      } else if (variant === "busy_arena") {
        if (!arenaId) return;
        const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        const { count: c } = await (supabase as any)
          .from("arena_attendance").select("id", { count: "exact", head: true })
          .eq("arena_id", arenaId).gte("checked_in_at", since);
        setCount(c ?? 0);
        setShow((c ?? 0) >= 10);
      }
    })();
  }, [variant, arenaId, providedCount]);

  if (!show) return null;
  const label = COPY[variant](count ?? 0);

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: "rgba(43,255,136,0.12)", color: "#2BFF88", border: "1px solid rgba(43,255,136,0.3)" }}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#2BFF88" }} />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: "#2BFF88" }} />
      </span>
      {ICON[variant]}
      {label}
    </span>
  );
};
