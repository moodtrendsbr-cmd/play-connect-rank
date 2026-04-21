import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ProfileHeader from "@/components/profile/ProfileHeader";
import { PostData } from "@/components/feed/PostCard";
import PostSkeleton from "@/components/feed/PostSkeleton";
import PostGrid from "@/components/profile/PostGrid";
import AthleteActivities from "@/components/profile/AthleteActivities";

const UserProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [postsCount, setPostsCount] = useState(0);

  const fetchProfile = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const [profileRes, followersRes, followingRes, postsCountRes] = await Promise.all([
      supabase.from("profiles_public").select("*").eq("user_id", userId).single(),
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", userId),
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", userId),
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", userId),
    ]);

    setProfile(profileRes.data);
    setFollowersCount(followersRes.count || 0);
    setFollowingCount(followingRes.count || 0);
    setPostsCount(postsCountRes.count || 0);

    if (user) {
      const { data: followCheck } = await supabase.from("follows").select("id").eq("follower_id", user.id).eq("following_id", userId).maybeSingle();
      setIsFollowing(!!followCheck);
    }

    // Fetch posts
    const { data: rawPosts } = await supabase.from("posts").select("*").eq("author_id", userId).order("pinned_at" as any, { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(50);
    if (rawPosts && rawPosts.length > 0) {
      const postIds = rawPosts.map((p) => p.id);
      const [mediaRes, likesRes, commentsRes, myLikesRes, mySavesRes] = await Promise.all([
        supabase.from("post_media").select("*").in("post_id", postIds).order("order_index"),
        supabase.from("likes").select("post_id").in("post_id", postIds),
        supabase.from("comments").select("post_id").in("post_id", postIds),
        user ? supabase.from("likes").select("post_id").in("post_id", postIds).eq("user_id", user.id) : Promise.resolve({ data: [] }),
        user ? supabase.from("post_saves").select("post_id").in("post_id", postIds).eq("user_id", user.id) : Promise.resolve({ data: [] }),
      ]);

      const mediaMap: Record<string, any[]> = {};
      (mediaRes.data || []).forEach((m) => { if (!mediaMap[m.post_id]) mediaMap[m.post_id] = []; mediaMap[m.post_id].push(m); });
      const likesCount: Record<string, number> = {};
      (likesRes.data || []).forEach((l: any) => { likesCount[l.post_id] = (likesCount[l.post_id] || 0) + 1; });
      const commentsCount: Record<string, number> = {};
      (commentsRes.data || []).forEach((c: any) => { commentsCount[c.post_id] = (commentsCount[c.post_id] || 0) + 1; });
      const myLikedSet = new Set((myLikesRes.data || []).map((l: any) => l.post_id));
      const mySavedSet = new Set((mySavesRes.data || []).map((s: any) => s.post_id));

      const enriched: PostData[] = rawPosts.map((p) => ({
        id: p.id,
        author_id: p.author_id,
        author_name: profileRes.data?.full_name || "Atleta",
        author_avatar: profileRes.data?.avatar_url || null,
        content: p.content,
        type: p.type,
        created_at: p.created_at,
        media: mediaMap[p.id] || [],
        likes_count: likesCount[p.id] || 0,
        comments_count: commentsCount[p.id] || 0,
        top_comments: [],
        liked_by_me: myLikedSet.has(p.id),
        saved_by_me: mySavedSet.has(p.id),
        pinned_at: (p as any).pinned_at || null,
      }));
      setPosts(enriched);
    } else {
      setPosts([]);
    }
    setLoading(false);
  }, [userId, user]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  useEffect(() => {
    if (user && userId && user.id === userId) {
      navigate("/profile", { replace: true });
    }
  }, [user, userId, navigate]);

  const handleFollowToggle = async () => {
    if (!user || !userId) return;
    setIsFollowing((prev) => !prev);
    setFollowersCount((prev) => isFollowing ? prev - 1 : prev + 1);

    if (isFollowing) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", userId);
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: userId });
    }
  };

  const handleLike = async (postId: string) => {
    if (!user) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, liked_by_me: !p.liked_by_me, likes_count: p.liked_by_me ? p.likes_count - 1 : p.likes_count + 1 } : p));
    if (post.liked_by_me) await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", user.id);
    else await supabase.from("likes").insert({ user_id: user.id, post_id: postId });
  };

  const handleSave = async (postId: string) => {
    if (!user) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, saved_by_me: !p.saved_by_me } : p));
    if (post.saved_by_me) await supabase.from("post_saves").delete().eq("post_id", postId).eq("user_id", user.id);
    else await supabase.from("post_saves").insert({ user_id: user.id, post_id: postId });
  };

  if (loading) return <main className="px-4 py-6 pb-20 max-w-xl mx-auto"><PostSkeleton /><PostSkeleton /></main>;
  if (!profile) return <main className="px-4 py-6 pb-20 max-w-xl mx-auto text-center text-white">Perfil não encontrado</main>;

  return (
    <main className="px-4 py-6 pb-20 max-w-xl mx-auto space-y-6">
      <ProfileHeader
        profileUserId={userId!}
        currentUserId={user?.id}
        fullName={profile.full_name}
        avatarUrl={profile.avatar_url}
        city={profile.city}
        state={profile.state}
        bio={profile.bio}
        team={profile.team}
        arena={(profile as any).arena}
        titles={profile.titles}
        whatsapp={profile.whatsapp}
        link={(profile as any).link}
        socialLinks={{
          instagram: (profile as any).social_instagram,
          facebook: (profile as any).social_facebook,
          youtube: (profile as any).social_youtube,
          tiktok: (profile as any).social_tiktok,
          linkedin: (profile as any).social_linkedin,
          x: (profile as any).social_x,
        }}
        showContact={profile.show_contact || false}
        postsCount={postsCount}
        followersCount={followersCount}
        followingCount={followingCount}
        isFollowing={isFollowing}
        isOwnProfile={user?.id === userId}
        onFollowToggle={handleFollowToggle}
      />

      <div>
        <h2 className="text-lg font-display text-white mb-3">Atividades recentes</h2>
        <AthleteActivities athleteId={userId!} />
      </div>

      <h2 className="text-lg font-display text-white">Posts</h2>
      {posts.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: "#9CA3AF" }}>Nenhum post ainda</p>
      ) : (
        <PostGrid posts={posts} userId={user?.id} onLike={handleLike} onSave={handleSave} onRefresh={fetchProfile} />
      )}
    </main>
  );
};

export default UserProfile;
