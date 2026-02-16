import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy } from "lucide-react";
import { useEntryMembers } from "@/hooks/useEntryMembers";
import AthleteAvatar from "./AthleteAvatar";

interface TabPlacementsProps {
  modalityId: string;
}

const medalEmojis = ["🥇", "🥈", "🥉", "🎖️"];
const bonusPoints = [80, 50, 30, 10];

const TabPlacements = ({ modalityId }: TabPlacementsProps) => {
  const [placements, setPlacements] = useState<any[]>([]);
  const [prizes, setPrizes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const [{ data: plData }, { data: prData }] = await Promise.all([
        supabase.from("modality_placements").select("*").eq("modality_id", modalityId).order("position"),
        supabase.from("modality_prizes").select("*").eq("modality_id", modalityId).order("position"),
      ]);
      setPlacements(plData || []);
      setPrizes(prData || []);
      setLoading(false);
    };
    fetch();
  }, [modalityId]);

  const entryIds = useMemo(() => placements.map((p) => p.entry_id), [placements]);
  const { entryMembers, membersLoading } = useEntryMembers(entryIds);

  if (loading || membersLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  if (placements.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Trophy className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>Classificação ainda não definida.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {placements.map((pl) => {
          const em = entryMembers[pl.entry_id];
          const members = em?.members || [];
          const prize = prizes.find((p) => p.position === pl.position);
          const idx = pl.position - 1;

          return (
            <div
              key={pl.id}
              className={`rounded-xl border bg-card p-5 ${
                pl.position === 1 ? "border-primary/40 box-glow" : "border-border"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-3xl">{medalEmojis[idx] || "🏅"}</span>
                <div className="flex-1 min-w-0">
                  {members.length > 0 ? (
                    <div className="space-y-1">
                      {members.map((m) => (
                        <AthleteAvatar key={m.memberId} member={m} showFullName size="h-8 w-8" />
                      ))}
                    </div>
                  ) : (
                    <p className="text-lg font-display text-foreground">
                      {em?.entryName || "—"}
                    </p>
                  )}
                  <p className="text-xs text-primary mt-1">+{bonusPoints[idx] || 0} pts</p>
                  {prize && prize.amount > 0 && (
                    <p className="text-sm text-secondary mt-1">
                      R$ {Number(prize.amount).toFixed(2)}
                    </p>
                  )}
                  {prize?.description && (
                    <p className="text-xs text-muted-foreground">{prize.description}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TabPlacements;
