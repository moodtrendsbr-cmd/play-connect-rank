import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import FeedTopBar from "@/components/feed/FeedTopBar";
import PostCard, { PostData } from "@/components/feed/PostCard";
import PostSkeleton from "@/components/feed/PostSkeleton";
import ClipsBar from "@/components/feed/ClipsBar";
import FriendSuggestions from "@/components/feed/FriendSuggestions";
import SponsoredPostCard from "@/components/feed/SponsoredPostCard";
import BoostedTournamentCard from "@/components/feed/BoostedTournamentCard";
import BoostedProductCard from "@/components/feed/BoostedProductCard";
import AdSlot from "@/components/ads/AdSlot";
import { SocialActivityFeed } from "@/components/social/SocialActivityFeed";
import { useFeedUnified, type UnifiedFeedItem } from "@/hooks/useFeedUnified";

const PAGE_SIZE = 20;

const Feed = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sponsoredPosts, setSponsoredPosts] = useState<any[]>([]);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(0);
  const mainRef = useRef<HTMLElement>(null);

  // Expose scroll to top for bottom nav
  useEffect(() => {
    const handler = () => mainRef.current?.scrollIntoView({ behavior: "smooth" });
    window.addEventListener("feed-scroll-top", handler);
    return () => window.removeEventListener("feed-scroll-top", handler);
  }, []);

  // Fetch sponsored posts
  useEffect(() => {
    const fetchSponsored = async () => {
      const { data } = await supabase
        .from("sponsored_posts")
        .select("*, companies(name, logo_url)")
        .eq("active", true)
        .lte("active_from", new Date().toISOString())
        .gte("active_to", new Date().toISOString());
      setSponsoredPosts(
        (data || []).map((sp: any) => ({
          id: sp.id, title: sp.title, content: sp.content, image_url: sp.image_url,
          company_id: sp.company_id, company_name: sp.companies?.name, company_logo: sp.companies?.logo_url,
        }))
      );
    };
    fetchSponsored();
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const enrichPosts = useCallback(
    async (rawPosts: any[]): Promise<PostData[]> => {
      if (rawPosts.length === 0) return [];

      const postIds = rawPosts.map((p) => p.id);
      const authorIds = [...new Set(rawPosts.map((p) => p.author_id))];

      const [profilesRes, mediaRes, commentsRes, likesCountRes, commentsCountRes, myLikesRes, mySavesRes, myFollowsRes] =
        await Promise.all([
          supabase.from("profiles_public").select("user_id, full_name, avatar_url").in("user_id", authorIds),
          supabase.from("post_media").select("*").in("post_id", postIds).order("order_index"),
          supabase.from("comments").select("id, post_id, author_id, content, created_at").in("post_id", postIds).order("created_at", { ascending: true }),
          supabase.from("likes").select("post_id").in("post_id", postIds),
          supabase.from("comments").select("post_id").in("post_id", postIds),
          user ? supabase.from("likes").select("post_id").in("post_id", postIds).eq("user_id", user.id) : Promise.resolve({ data: [] }),
          user ? supabase.from("post_saves").select("post_id").in("post_id", postIds).eq("user_id", user.id) : Promise.resolve({ data: [] }),
          user ? supabase.from("follows").select("following_id").eq("follower_id", user.id).in("following_id", authorIds) : Promise.resolve({ data: [] }),
        ]);

      const profileMap: Record<string, { name: string; avatar: string | null }> = {};
      (profilesRes.data || []).forEach((p) => {
        profileMap[p.user_id] = { name: p.full_name, avatar: p.avatar_url };
      });

      const mediaMap: Record<string, { media_url: string; order_index: number }[]> = {};
      (mediaRes.data || []).forEach((m) => {
        if (!mediaMap[m.post_id]) mediaMap[m.post_id] = [];
        mediaMap[m.post_id].push({ media_url: m.media_url, order_index: m.order_index });
      });

      const commentsByPost: Record<string, any[]> = {};
      const commentAuthorIds = new Set<string>();
      (commentsRes.data || []).forEach((c) => {
        if (!commentsByPost[c.post_id]) commentsByPost[c.post_id] = [];
        commentsByPost[c.post_id].push(c);
        commentAuthorIds.add(c.author_id);
      });

      let commentProfileMap: Record<string, string> = {};
      if (commentAuthorIds.size > 0) {
        const { data: cp } = await supabase.from("profiles_public").select("user_id, full_name").in("user_id", Array.from(commentAuthorIds));
        (cp || []).forEach((p) => { commentProfileMap[p.user_id] = p.full_name; });
      }

      const likesCount: Record<string, number> = {};
      (likesCountRes.data || []).forEach((l: any) => { likesCount[l.post_id] = (likesCount[l.post_id] || 0) + 1; });
      const commentsCount: Record<string, number> = {};
      (commentsCountRes.data || []).forEach((c: any) => { commentsCount[c.post_id] = (commentsCount[c.post_id] || 0) + 1; });

      const myLikedSet = new Set((myLikesRes.data || []).map((l: any) => l.post_id));
      const mySavedSet = new Set((mySavesRes.data || []).map((s: any) => s.post_id));
      const myFollowedSet = new Set((myFollowsRes.data || []).map((f: any) => f.following_id));

      return rawPosts.map((p) => {
        const profile = profileMap[p.author_id] || { name: "Atleta", avatar: null };
        const postComments = commentsByPost[p.id] || [];
        const top2 = postComments.slice(-2).map((c) => ({
          id: c.id, content: c.content, author_name: commentProfileMap[c.author_id] || "Atleta", created_at: c.created_at,
        }));
        return {
          id: p.id, author_id: p.author_id, author_name: profile.name, author_avatar: profile.avatar,
          content: p.content, type: p.type, created_at: p.created_at, media: mediaMap[p.id] || [],
          likes_count: likesCount[p.id] || 0, comments_count: commentsCount[p.id] || 0, top_comments: top2,
          liked_by_me: myLikedSet.has(p.id), saved_by_me: mySavedSet.has(p.id),
          followed_by_me: myFollowedSet.has(p.author_id),
        };
      });
    },
    [user]
  );

  const fetchPosts = useCallback(
    async (page = 0, append = false) => {
      if (page === 0) setLoading(true);
      else setLoadingMore(true);

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const term = debouncedSearch.trim();

      let postIds: string[] | null = null;

      if (term) {
        // Global search: content, author name, hashtags
        const results = new Set<string>();

        // 1. Search by content
        const { data: contentPosts } = await supabase.from("posts").select("id").ilike("content", `%${term}%`).limit(100);
        (contentPosts || []).forEach((p) => results.add(p.id));

        // 2. Search by author name
        const { data: matchedProfiles } = await supabase.from("profiles_public").select("user_id").ilike("full_name", `%${term}%`);
        if (matchedProfiles && matchedProfiles.length > 0) {
          const authorIds = matchedProfiles.map((p) => p.user_id);
          const { data: authorPosts } = await supabase.from("posts").select("id").in("author_id", authorIds).limit(100);
          (authorPosts || []).forEach((p) => results.add(p.id));
        }

        // 3. Search by hashtag
        if (term.startsWith("#")) {
          const tag = term.slice(1).toLowerCase();
          const { data: ht } = await supabase.from("hashtags").select("id").ilike("tag", `%${tag}%`);
          if (ht && ht.length > 0) {
            const htIds = ht.map((h) => h.id);
            const { data: phData } = await supabase.from("post_hashtags").select("post_id").in("hashtag_id", htIds);
            (phData || []).forEach((ph: any) => results.add(ph.post_id));

            // Log search for trending
            if (user) {
              for (const h of ht) {
                supabase.from("hashtag_searches").insert({ hashtag_id: h.id, searched_by: user.id }).then(() => {});
              }
            }
          }
        }

        postIds = Array.from(results);
        if (postIds.length === 0) {
          setPosts([]);
          setHasMore(false);
          setLoading(false);
          setLoadingMore(false);
          return;
        }
      }

      // Fetch posts, prioritize followed users
      let followingIds: string[] = [];
      if (user) {
        const { data: follows } = await supabase.from("follows").select("following_id").eq("follower_id", user.id);
        followingIds = (follows || []).map((f: any) => f.following_id);
      }

      let query = supabase.from("posts").select("*").order("created_at", { ascending: false });
      if (user) {
        query = query.neq("author_id", user.id);
      }
      if (postIds) {
        query = query.in("id", postIds);
      }

      const { data: rawPosts } = await query.range(from, to);

      if (!rawPosts || rawPosts.length < PAGE_SIZE) setHasMore(false);
      else setHasMore(true);

      const enriched = await enrichPosts(rawPosts || []);

      // Sort: followed users first, then rest
      if (followingIds.length > 0 && !term) {
        const followingSet = new Set(followingIds);
        const followed = enriched.filter((p) => followingSet.has(p.author_id));
        const rest = enriched.filter((p) => !followingSet.has(p.author_id));
        const sorted = [...followed, ...rest];
        if (append) setPosts((prev) => [...prev, ...sorted]);
        else setPosts(sorted);
      } else {
        if (append) setPosts((prev) => [...prev, ...enriched]);
        else setPosts(enriched);
      }

      setLoading(false);
      setLoadingMore(false);
    },
    [enrichPosts, debouncedSearch, user]
  );

  useEffect(() => {
    pageRef.current = 0;
    setHasMore(true);
    fetchPosts(0, false);
  }, [fetchPosts]);

  useEffect(() => {
    if (!loadMoreRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          pageRef.current += 1;
          fetchPosts(pageRef.current, true);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, fetchPosts]);

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

  const handleRefresh = () => {
    pageRef.current = 0;
    fetchPosts(0, false);
  };

  return (
    <>
      <FeedTopBar searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      <main ref={mainRef} className="pt-16 pb-20 px-4 max-w-xl mx-auto space-y-4">
        <ClipsBar />
        <AdSlot code="feed.inline" />
        <SocialActivityFeed limit={6} title="Atividade da rede" />
        {loading ? (
          <><PostSkeleton /><PostSkeleton /><PostSkeleton /></>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-lg font-display text-muted-foreground">Nenhum post encontrado</p>
            <p className="text-sm mt-1 text-muted-foreground">Seja o primeiro a publicar!</p>
          </div>
        ) : (
          posts.map((post, index) => (
            <div key={post.id}>
              {index === 3 && <FriendSuggestions />}
              {index > 0 && index % 5 === 0 && sponsoredPosts.length > 0 && (
                <SponsoredPostCard post={sponsoredPosts[Math.floor(index / 5 - 1) % sponsoredPosts.length]} />
              )}
              <PostCard post={post} userId={user?.id} onLike={handleLike} onSave={handleSave} onRefresh={handleRefresh} />
            </div>
          ))
        )}
        {loadingMore && <PostSkeleton />}
        <div ref={loadMoreRef} className="h-4" />
      </main>
    </>
  );
};

export default Feed;
