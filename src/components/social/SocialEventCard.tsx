import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import {
  Trophy, MapPin, Users, Activity, CalendarPlus, Medal, CheckCircle2,
  Flame, Star, Zap, Award, TrendingUp, ChevronsUp,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface SocialFeedItem {
  event_id: string;
  event_type: string;
  occurred_at: string;
  profile_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  arena_name: string | null;
  tenant_name: string | null;
  description: string;
  payload: Record<string, any> | null;
}

const ACCENT = "#2BFF88";

const META: Record<string, { icon: JSX.Element; accent?: boolean; label?: string }> = {
  checkin:            { icon: <CheckCircle2 className="h-4 w-4" style={{ color: ACCENT }} /> },
  tournament_join:    { icon: <Users className="h-4 w-4" style={{ color: ACCENT }} /> },
  tournament_created: { icon: <CalendarPlus className="h-4 w-4" style={{ color: ACCENT }} /> },
  match_win:          { icon: <Trophy className="h-4 w-4" style={{ color: ACCENT }} /> },
  match_loss:         { icon: <Medal className="h-4 w-4 text-muted-foreground" /> },
  booking:            { icon: <MapPin className="h-4 w-4" style={{ color: ACCENT }} /> },
  class_attendance:   { icon: <Activity className="h-4 w-4" style={{ color: ACCENT }} /> },
  tournament_won:     { icon: <Trophy className="h-5 w-5" style={{ color: ACCENT }} />, accent: true, label: "CAMPEÃO" },
  tournament_podium:  { icon: <Medal className="h-4 w-4" style={{ color: ACCENT }} />, label: "PÓDIO" },
  tournament_advance: { icon: <ChevronsUp className="h-4 w-4" style={{ color: ACCENT }} />, label: "AVANÇOU" },
  level_up:           { icon: <TrendingUp className="h-4 w-4" style={{ color: ACCENT }} />, label: "NÍVEL" },
  streak_milestone:   { icon: <Flame className="h-4 w-4" style={{ color: "#FF6A00" }} />, label: "SEQUÊNCIA" },
  badge_earned:       { icon: <Award className="h-4 w-4" style={{ color: ACCENT }} />, label: "CONQUISTA" },
  ranking_update:     { icon: <Zap className="h-4 w-4" style={{ color: ACCENT }} /> },
  payment_completed:  { icon: <Star className="h-4 w-4 text-muted-foreground" /> },
};

const ctaFor = (item: SocialFeedItem): { to: string; label: string } | null => {
  const tid = item.payload?.tournament_id;
  if (tid && ["tournament_join","match_win","tournament_won","tournament_podium","tournament_created","tournament_advance"].includes(item.event_type)) {
    return { to: `/tournaments/${tid}`, label: "Ver torneio" };
  }
  if (item.arena_name) return { to: `#`, label: "Ver arena" };
  return null;
};

export const SocialEventCard = ({ item }: { item: SocialFeedItem }) => {
  const initials = (item.display_name || "A").slice(0, 1).toUpperCase();
  const profileHref = item.username ? `/u/${item.username}` : `/profile/${item.profile_id}`;
  const meta = META[item.event_type] || { icon: <Activity className="h-4 w-4 text-muted-foreground" /> };
  const cta = ctaFor(item);
  const isChampion = item.event_type === "tournament_won";

  return (
    <Card
      className="p-3 flex gap-3 items-start transition-colors hover:bg-card/80"
      style={{
        background: isChampion ? `linear-gradient(135deg, rgba(43,255,136,0.08), rgba(11,15,18,1))` : "rgba(11,15,18,0.6)",
        border: isChampion ? `1px solid ${ACCENT}55` : "1px solid hsl(var(--border) / 0.4)",
      }}
    >
      <Link to={profileHref}>
        <Avatar className="h-10 w-10">
          <AvatarImage src={item.avatar_url || undefined} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {meta.icon}
          {meta.label && (
            <span
              className="text-[10px] font-display tracking-wider px-1.5 py-0.5 rounded"
              style={{
                color: isChampion ? "#050708" : ACCENT,
                background: isChampion ? ACCENT : `${ACCENT}22`,
              }}
            >
              {meta.label}
            </span>
          )}
          <span>
            {formatDistanceToNow(new Date(item.occurred_at), { addSuffix: true, locale: ptBR })}
          </span>
          {item.arena_name && <span>· {item.arena_name}</span>}
        </div>
        <p className={`text-sm mt-1 leading-snug ${isChampion ? "font-display tracking-wide" : "text-foreground"}`}
           style={isChampion ? { color: ACCENT } : undefined}>
          {item.description}
        </p>
        {cta && (
          <Link
            to={cta.to}
            className="inline-block mt-2 text-[11px] font-semibold tracking-wide"
            style={{ color: ACCENT }}
          >
            {cta.label} →
          </Link>
        )}
      </div>
    </Card>
  );
};
