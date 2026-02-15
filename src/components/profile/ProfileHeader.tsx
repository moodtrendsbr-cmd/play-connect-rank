import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MapPin, Users, FileText, Trophy, MessageCircle, Camera, LinkIcon, ExternalLink, Mail, Pencil, Video } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  link?: string | null;
  showContact: boolean;
  postsCount: number;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  isOwnProfile: boolean;
  onFollowToggle: () => void;
  onEditClick?: () => void;
  onAvatarUpdate?: (url: string) => void;
}

const getInitials = (name: string) =>
  name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

interface HighlightItem {
  id: string;
  post_id?: string;
  clip_id?: string;
  image_url: string | null;
  content: string;
  isClip?: boolean;
}

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
  link,
  showContact,
  postsCount,
  followersCount,
  followingCount,
  isFollowing,
  isOwnProfile,
  onFollowToggle,
  onEditClick,
  onAvatarUpdate,
}: ProfileHeaderProps) => {
  const [followListType, setFollowListType] = useState<"followers" | "following" | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [highlights, setHighlights] = useState<HighlightItem[]>([]);
  const [medalPosition, setMedalPosition] = useState<number | null>(null);

  useEffect(() => {
    const fetchHighlights = async () => {
      // Fetch post highlights
      const { data: hl } = await supabase
        .from("profile_highlights")
        .select("id, post_id")
        .eq("user_id", profileUserId)
        .order("created_at", { ascending: false })
        .limit(20);

      let postHighlights: HighlightItem[] = [];
      if (hl && hl.length > 0) {
        const postIds = hl.map((h: any) => h.post_id);
        const [postsRes, mediaRes] = await Promise.all([
          supabase.from("posts").select("id, content").in("id", postIds),
          supabase.from("post_media").select("post_id, media_url").in("post_id", postIds).order("order_index").limit(50),
        ]);
        const mediaMap: Record<string, string> = {};
        (mediaRes.data || []).forEach((m: any) => { if (!mediaMap[m.post_id]) mediaMap[m.post_id] = m.media_url; });
        const contentMap: Record<string, string> = {};
        (postsRes.data || []).forEach((p: any) => { contentMap[p.id] = p.content; });
        postHighlights = hl.map((h: any) => ({
          id: h.id, post_id: h.post_id,
          image_url: mediaMap[h.post_id] || null,
          content: contentMap[h.post_id] || "",
        }));
      }

      // Fetch clips
      const { data: clips } = await supabase
        .from("clips")
        .select("id, thumbnail_url, caption, media_url")
        .eq("author_id", profileUserId)
        .order("created_at", { ascending: false })
        .limit(10);

      const clipHighlights: HighlightItem[] = (clips || []).map((c: any) => ({
        id: `clip-${c.id}`,
        clip_id: c.id,
        image_url: c.thumbnail_url || null,
        content: c.caption || "",
        isClip: true,
      }));

      setHighlights([...postHighlights, ...clipHighlights]);
    };
    fetchHighlights();
  }, [profileUserId]);

  // Fetch medal position from victory ranking
  useEffect(() => {
    const fetchMedal = async () => {
      const { data: matchData } = await supabase.from("match_results").select("winner_id").not("winner_id", "is", null);
      if (!matchData || matchData.length === 0) return;
      const counts: Record<string, number> = {};
      matchData.forEach((r) => { if (r.winner_id) counts[r.winner_id] = (counts[r.winner_id] || 0) + 1; });
      const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);
      const idx = sorted.findIndex(([uid]) => uid === profileUserId);
      if (idx >= 0 && idx < 3) setMedalPosition(idx + 1);
    };
    fetchMedal();
  }, [profileUserId]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUserId) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `avatars/${currentUserId}.${ext}`;
    const { error: upErr } = await supabase.storage.from("post-images").upload(path, file, { upsert: true });
    if (upErr) { toast({ title: "Erro no upload", variant: "destructive" }); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(path);
    const publicUrl = urlData.publicUrl + "?t=" + Date.now();
    await supabase.from("profiles").update({ avatar_url: publicUrl } as any).eq("user_id", currentUserId);
    onAvatarUpdate?.(publicUrl);
    toast({ title: "Foto atualizada!" });
    setUploading(false);
  };

  const formatLink = (url: string) => {
    try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace("www.", ""); }
    catch { return url; }
  };
  const getHref = (url: string) => url.startsWith("http") ? url : `https://${url}`;

  return (
    <div className="space-y-4">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />

      {/* Avatar + Name */}
      <div className="flex items-center gap-4">
        <div className="relative">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-20 w-20 rounded-full object-cover border-2" style={{ borderColor: "rgba(43,255,136,0.3)" }} />
          ) : (
            <div className="h-20 w-20 rounded-full flex items-center justify-center text-xl font-bold" style={{ background: "rgba(43,255,136,0.15)", color: "#2BFF88" }}>
              {getInitials(fullName || "A")}
            </div>
          )}
          {isOwnProfile && (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 h-7 w-7 rounded-full flex items-center justify-center"
              style={{ background: "#2BFF88", color: "#050708" }}
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-display text-white flex items-center gap-2">
            {fullName || "Atleta"}
            {medalPosition && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xl cursor-help">
                    {medalPosition === 1 ? "🥇" : medalPosition === 2 ? "🥈" : "🥉"}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{medalPosition}º lugar no Ranking de Vitórias</p>
                </TooltipContent>
              </Tooltip>
            )}
            {isOwnProfile && onEditClick && (
              <button
                onClick={onEditClick}
                className="p-1.5 rounded-full transition-colors hover:bg-[#2BFF88]/20"
                style={{ color: "#2BFF88" }}
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </h1>
          {(city || state) && (
            <p className="text-sm flex items-center gap-1 mt-1" style={{ color: "#9CA3AF" }}>
              <MapPin className="h-3 w-3" /> {city}{city && state ? " - " : ""}{state}
            </p>
          )}
        </div>
      </div>

      {/* Bio */}
      {bio && <p className="text-sm text-white/80 whitespace-pre-wrap">{bio}</p>}

      {/* Link */}
      {link && (
        <a href={getHref(link)} target="_blank" rel="noopener noreferrer" className="text-sm flex items-center gap-1.5 hover:underline" style={{ color: "#2BFF88" }}>
          <LinkIcon className="h-3.5 w-3.5" />
          {formatLink(link)}
          <ExternalLink className="h-3 w-3" />
        </a>
      )}

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

      {/* Follow / Edit / Message buttons */}
      {!isOwnProfile && currentUserId && (
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={onFollowToggle}
            style={isFollowing ? { background: "transparent", border: "1px solid rgba(43,255,136,0.3)", color: "#9CA3AF" } : { background: "#2BFF88", color: "#050708" }}
          >
            {isFollowing ? "Seguindo" : "Seguir"}
          </Button>
          <Link to={`/messages/${profileUserId}`}>
            <Button size="sm" variant="outline" className="border-[#2BFF88]/30 text-white">
              <Mail className="h-4 w-4 mr-1" /> Mensagem
            </Button>
          </Link>
        </div>
      )}

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

      {/* Highlights */}
      {(highlights.length > 0 || isOwnProfile) && (
        <div className="pt-2">
          <h3 className="text-xs font-semibold mb-2" style={{ color: "#9CA3AF" }}>Destaques</h3>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {highlights.map((h) => (
              <div key={h.id} className="shrink-0 w-16 h-16 rounded-lg overflow-hidden border relative" style={{ borderColor: "rgba(43,255,136,0.2)" }}>
                {h.image_url ? (
                  <img src={h.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] p-1 text-center" style={{ background: "rgba(43,255,136,0.1)", color: "#9CA3AF" }}>
                    {h.isClip ? <Video className="h-5 w-5" style={{ color: "#2BFF88" }} /> : <FileText className="h-5 w-5" style={{ color: "#2BFF88" }} />}
                  </div>
                )}
                {h.isClip && (
                  <div className="absolute bottom-0.5 right-0.5">
                    <Video className="h-3 w-3" style={{ color: "#2BFF88" }} />
                  </div>
                )}
              </div>
            ))}
            {highlights.length === 0 && isOwnProfile && (
              <div className="text-xs py-2" style={{ color: "#9CA3AF" }}>Use os 3 pontinhos em seus posts para destacar</div>
            )}
          </div>
        </div>
      )}

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
