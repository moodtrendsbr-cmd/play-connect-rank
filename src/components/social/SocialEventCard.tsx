import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Trophy, MapPin, Users, Activity, CalendarPlus, Medal, CheckCircle2 } from "lucide-react";
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

const ICON: Record<string, JSX.Element> = {
  checkin: <CheckCircle2 className="h-4 w-4 text-[#2BFF88]" />,
  tournament_join: <Users className="h-4 w-4 text-[#2BFF88]" />,
  tournament_created: <CalendarPlus className="h-4 w-4 text-[#2BFF88]" />,
  match_win: <Trophy className="h-4 w-4 text-[#2BFF88]" />,
  match_loss: <Medal className="h-4 w-4 text-muted-foreground" />,
  booking: <MapPin className="h-4 w-4 text-[#2BFF88]" />,
  class_attendance: <Activity className="h-4 w-4 text-[#2BFF88]" />,
};

export const SocialEventCard = ({ item }: { item: SocialFeedItem }) => {
  const initials = (item.display_name || "A").slice(0, 1).toUpperCase();
  const profileHref = item.username ? `/u/${item.username}` : "#";
  return (
    <Card className="bg-card/60 border-border/40 p-3 flex gap-3 items-start">
      <Link to={profileHref}>
        <Avatar className="h-10 w-10">
          <AvatarImage src={item.avatar_url || undefined} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {ICON[item.event_type] || <Activity className="h-4 w-4" />}
          <span>
            {formatDistanceToNow(new Date(item.occurred_at), { addSuffix: true, locale: ptBR })}
          </span>
          {item.arena_name && <span>· {item.arena_name}</span>}
        </div>
        <p className="text-sm text-foreground mt-1 leading-snug">{item.description}</p>
      </div>
    </Card>
  );
};
