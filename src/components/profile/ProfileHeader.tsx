import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MapPin, Users, FileText, Trophy, MessageCircle, Eye, EyeOff } from "lucide-react";
import FollowListDialog from "./FollowListDialog";

interface ProfileHeaderProps {
  profileUserId: string;
  currentUserId: string | undefined;
  fullName: string;
  avatarUrl: string | null;
  city: string | null;
  state: string | null;
  bio: string | null;
  team: string | null;
  titles: string | null;
  whatsapp: string | null;
  showContact: boolean;
  postsCount: number;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  isOwnProfile: boolean;
  onFollowToggle: () => void;
  onEditClick?: () => void;
}

const getInitials = (name: string) =>
  name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

const ProfileHeader = ({
  profileUserId,
  currentUserId,
  fullName,
  avatarUrl,
  city,
  state,
  bio,
  team,
  titles,
  whatsapp,
  showContact,
  postsCount,
  followersCount,
  followingCount,
  isFollowing,
  isOwnProfile,
  onFollowToggle,
  onEditClick,
}: ProfileHeaderProps) => {
  const [followListType, setFollowListType] = useState<"followers" | "following" | null>(null);

  return (
    <div className="space-y-4">
      {/* Avatar + Name */}
      <div className="flex items-center gap-4">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-20 w-20 rounded-full object-cover border-2" style={{ borderColor: "rgba(43,255,136,0.3)" }} />
        ) : (
          <div className="h-20 w-20 rounded-full flex items-center justify-center text-xl font-bold" style={{ background: "rgba(43,255,136,0.15)", color: "#2BFF88" }}>
            {getInitials(fullName || "A")}
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-display text-white">{fullName || "Atleta"}</h1>
          {(city || state) && (
            <p className="text-sm flex items-center gap-1 mt-1" style={{ color: "#9CA3AF" }}>
              <MapPin className="h-3 w-3" /> {city}{city && state ? " - " : ""}{state}
            </p>
          )}
        </div>
      </div>

      {/* Bio */}
      {bio && <p className="text-sm text-white/80 whitespace-pre-wrap">{bio}</p>}

      {/* Extra info */}
      <div className="flex flex-wrap gap-3">
        {team && (
          <span className="text-xs flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: "rgba(43,255,136,0.1)", color: "#2BFF88" }}>
            <Users className="h-3 w-3" /> {team}
          </span>
        )}
        {titles && (
          <span className="text-xs flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: "rgba(43,255,136,0.1)", color: "#2BFF88" }}>
            <Trophy className="h-3 w-3" /> {titles}
          </span>
        )}
      </div>

      {/* Contact */}
      {!isOwnProfile && showContact && whatsapp && (
        <p className="text-sm flex items-center gap-1" style={{ color: "#9CA3AF" }}>
          <MessageCircle className="h-3 w-3" /> {whatsapp}
        </p>
      )}

      {/* Follow / Edit button */}
      <div className="flex gap-2">
        {isOwnProfile ? (
          onEditClick && (
            <Button variant="outline" size="sm" onClick={onEditClick} className="border-[#2BFF88]/30 text-white">
              Editar perfil
            </Button>
          )
        ) : currentUserId ? (
          <Button
            size="sm"
            onClick={onFollowToggle}
            style={isFollowing ? { background: "transparent", border: "1px solid rgba(43,255,136,0.3)", color: "#9CA3AF" } : { background: "#2BFF88", color: "#050708" }}
          >
            {isFollowing ? "Seguindo" : "Seguir"}
          </Button>
        ) : null}
      </div>

      {/* Stats */}
      <div className="flex gap-6 pt-2">
        <div className="text-center">
          <p className="text-lg font-bold text-white">{postsCount}</p>
          <p className="text-xs" style={{ color: "#9CA3AF" }}>posts</p>
        </div>
        <button className="text-center" onClick={() => setFollowListType("followers")}>
          <p className="text-lg font-bold text-white">{followersCount}</p>
          <p className="text-xs" style={{ color: "#9CA3AF" }}>seguidores</p>
        </button>
        <button className="text-center" onClick={() => setFollowListType("following")}>
          <p className="text-lg font-bold text-white">{followingCount}</p>
          <p className="text-xs" style={{ color: "#9CA3AF" }}>seguindo</p>
        </button>
      </div>

      {followListType && (
        <FollowListDialog
          open={!!followListType}
          onOpenChange={(o) => !o && setFollowListType(null)}
          userId={profileUserId}
          type={followListType}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
};

export default ProfileHeader;
