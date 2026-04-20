import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy } from "lucide-react";
import { useEntryMembers } from "@/hooks/useEntryMembers";
import AthleteAvatar from "./AthleteAvatar";

interface TabPlacementsProps {
  modalityId: string;
}

const medals = ["🥇", "🥈", "🥉", "🎖️"];
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
      <div className="space-y-4">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    );
  }

  if (placements.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Trophy className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>Pódio ainda não definido.</p>
      </div>
    );
  }

  const byPosition: Record<number, any> = {};
  placements.forEach((p) => { byPosition[p.position] = p; });

  const renderEntry = (pl: any, full = true) => {
    const em = entryMembers[pl.entry_id];
    const members = em?.members || [];
    if (members.length === 0) {
      return <p className="text-sm font-medium text-foreground">{em?.entryName || "—"}</p>;
    }
    return (
      <div className={full ? "space-y-1" : "flex flex-col items-center gap-1"}>
        {members.map((m) => (
          <AthleteAvatar
            key={m.memberId}
            member={m}
            showFullName={full}
            size={full ? "h-7 w-7" : "h-9 w-9"}
          />
        ))}
        {!full && (
          <p className="text-[11px] text-foreground text-center font-medium leading-tight">
            {members.map((m) => m.firstName).join(" / ")}
          </p>
        )}
      </div>
    );
  };

  const podiumCard = (position: number, height: string, glow = false) => {
    const pl = byPosition[position];
    if (!pl) return <div className={`flex-1 ${height} rounded-xl border border-dashed border-border/50 bg-card/30`} />;
    const idx = position - 1;
    const prize = prizes.find((p) => p.position === position);

    return (
      <div
        className={`flex-1 ${height} rounded-xl border bg-card p-3 flex flex-col items-center justify-end text-center gap-2 ${
          glow ? "border-primary/40 box-glow" : "border-border"
        }`}
      >
        <span className="text-2xl">{medals[idx]}</span>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{position}º Lugar</p>
        {renderEntry(pl, false)}
        {prize && prize.amount > 0 && (
          <p className="text-xs text-secondary">R$ {Number(prize.amount).toFixed(2)}</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Pódio: 2 - 1 - 3 */}
      <div className="flex items-end gap-2">
        {podiumCard(2, "h-44")}
        {podiumCard(1, "h-56", true)}
        {podiumCard(3, "h-44")}
      </div>

      {/* 4º lugar */}
      {byPosition[4] && (
        <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
          <span className="text-xl">🎖️</span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">4º Lugar</p>
            {renderEntry(byPosition[4], true)}
          </div>
          <p className="text-xs text-primary">+{bonusPoints[3]} pts</p>
        </div>
      )}

      {/* Lista numerada */}
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Classificação</p>
        <div className="space-y-1.5">
          {[1, 2, 3, 4].map((pos) => {
            const pl = byPosition[pos];
            if (!pl) return null;
            const em = entryMembers[pl.entry_id];
            const label = em?.members?.length
              ? em.members.map((m: any) => m.firstName).join(" / ")
              : em?.entryName || "—";
            return (
              <div key={pos} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-mono w-6">{pos}º</span>
                <span className="flex-1 text-foreground truncate">{label}</span>
                <span className="text-xs text-primary">+{bonusPoints[pos - 1] || 0} pts</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TabPlacements;
