import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { MemberProfile } from "@/hooks/useEntryMembers";

interface AthleteAvatarProps {
  member: MemberProfile;
  /** Show full name or first name */
  showFullName?: boolean;
  /** Avatar size class */
  size?: string;
}

const AthleteAvatar = ({ member, showFullName = false, size = "h-8 w-8" }: AthleteAvatarProps) => {
  const displayName = showFullName ? member.fullName : member.firstName;

  return (
    <Link
      to={`/profile/${member.userId}`}
      className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0"
      onClick={(e) => e.stopPropagation()}
    >
      <Avatar className={`${size} border-2 border-background shrink-0`}>
        <AvatarImage src={member.avatarUrl || undefined} alt={displayName} />
        <AvatarFallback className="text-xs bg-muted">
          {displayName[0]?.toUpperCase() || "?"}
        </AvatarFallback>
      </Avatar>
      <span className="text-sm truncate">{displayName}</span>
    </Link>
  );
};

export default AthleteAvatar;
