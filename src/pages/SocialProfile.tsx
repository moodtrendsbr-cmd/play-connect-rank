import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Loader2, MapPin } from "lucide-react";
import { SocialActivityFeed } from "@/components/social/SocialActivityFeed";

interface SocialProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  level: string | null;
  main_sport: string | null;
  city: string | null;
  state: string | null;
}

const SocialProfilePage = () => {
  const { username } = useParams();
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!username) return;
      const { data } = await (supabase as any)
        .from("social_profiles_public")
        .select("id,username,display_name,avatar_url,bio,level,main_sport,city,state")
        .eq("username", username)
        .maybeSingle();
      setProfile((data as SocialProfile) || null);
      setLoading(false);
    })();
  }, [username]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#050708" }}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#050708" }}>
        <Card className="p-6 max-w-sm text-center">
          <p className="text-foreground mb-2">Perfil não encontrado</p>
          <Link to="/feed" className="text-[#2BFF88] text-sm">Voltar para o feed</Link>
        </Card>
      </div>
    );
  }

  const initials = profile.display_name?.slice(0, 2).toUpperCase() || "AT";

  return (
    <div className="min-h-screen pb-12" style={{ background: "#050708" }}>
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <Card className="bg-card/60 border-border/40 p-5 flex gap-4 items-center">
          <Avatar className="h-20 w-20">
            <AvatarImage src={profile.avatar_url || undefined} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground">{profile.display_name}</h1>
            <p className="text-xs text-muted-foreground">@{profile.username}</p>
            {(profile.city || profile.main_sport) && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {[profile.city, profile.state].filter(Boolean).join(", ")}
                {profile.main_sport && ` · ${profile.main_sport}`}
              </p>
            )}
            {profile.bio && <p className="text-sm text-foreground/80 mt-2">{profile.bio}</p>}
          </div>
        </Card>

        <div className="mt-6">
          <SocialActivityFeed profileId={profile.id} title="Atividade recente" limit={30} />
        </div>
      </div>
    </div>
  );
};

export default SocialProfilePage;
