import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import FeedTopBar from "@/components/feed/FeedTopBar";
import PostCard, { PostData } from "@/components/feed/PostCard";
import PostSkeleton from "@/components/feed/PostSkeleton";

const PAGE_SIZE = 20;

const Feed = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(0);

  const enrichPosts = useCallback(
    async (rawPosts: any[]): Promise<PostData[]> => {
      if (rawPosts.length === 0) return [];

      const postIds = rawPosts.map((p) => p.id);
      const authorIds = [...new Set(rawPosts.map((p) => p.author_id))];

      // Parallel fetches
      const [profilesRes, mediaRes, commentsRes, likesCountRes, commentsCountRes, myLikesRes, mySavesRes] =
        await Promise.all([
          supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", authorIds),
          supabase.from("post_media").select("*").in("post_id", postIds).order("order_index"),
          supabase.from("comments").select("id, post_id, author_id, content, created_at").in("post_id", postIds).order("created_at", { ascending: true }),
          supabase.from("likes").select("post_id").in("post_id", postIds),
          supabase.from("comments").select("post_id").in("post_id", postIds),
          user ? supabase.from("likes").select("post_id").in("post_id", postIds).eq("user_id", user.id) : Promise.resolve({ data: [] }),
          user ? supabase.from("post_saves").select("post_id").in("post_id", postIds).eq("user_id", user.id) : Promise.resolve({ data: [] }),
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

      // Group comments by post for top 2
      const commentsByPost: Record<string, any[]> = {};
      const commentAuthorIds = new Set<string>();
      (commentsRes.data || []).forEach((c) => {
        if (!commentsByPost[c.post_id]) commentsByPost[c.post_id] = [];
        commentsByPost[c.post_id].push(c);
        commentAuthorIds.add(c.author_id);
      });

      // Fetch comment author names
      let commentProfileMap: Record<string, string> = {};
      if (commentAuthorIds.size > 0) {
        const { data: cp } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", Array.from(commentAuthorIds));
        (cp || []).forEach((p) => {
          commentProfileMap[p.user_id] = p.full_name;
        });
      }

      // Count likes/comments per post
      const likesCount: Record<string, number> = {};
      (likesCountRes.data || []).forEach((l: any) => {
        likesCount[l.post_id] = (likesCount[l.post_id] || 0) + 1;
      });
      const commentsCount: Record<string, number> = {};
      (commentsCountRes.data || []).forEach((c: any) => {
        commentsCount[c.post_id] = (commentsCount[c.post_id] || 0) + 1;
      });

      const myLikedSet = new Set((myLikesRes.data || []).map((l: any) => l.post_id));
      const mySavedSet = new Set((mySavesRes.data || []).map((s: any) => s.post_id));

      return rawPosts.map((p) => {
        const profile = profileMap[p.author_id] || { name: "Atleta", avatar: null };
        const postComments = commentsByPost[p.id] || [];
        const top2 = postComments.slice(-2).map((c) => ({
          id: c.id,
          content: c.content,
          author_name: commentProfileMap[c.author_id] || "Atleta",
          created_at: c.created_at,
        }));

        return {
          id: p.id,
          author_id: p.author_id,
          author_name: profile.name,
          author_avatar: profile.avatar,
          content: p.content,
          type: p.type,
          created_at: p.created_at,
          media: mediaMap[p.id] || [],
          likes_count: likesCount[p.id] || 0,
          comments_count: commentsCount[p.id] || 0,
          top_comments: top2,
          liked_by_me: myLikedSet.has(p.id),
          saved_by_me: mySavedSet.has(p.id),
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

      let query = supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (searchQuery.trim()) {
        query = query.ilike("content", `%${searchQuery.trim()}%`);
      }

      const { data: rawPosts } = await query;

      if (!rawPosts || rawPosts.length < PAGE_SIZE) setHasMore(false);
      else setHasMore(true);

      const enriched = await enrichPosts(rawPosts || []);

      if (append) {
        setPosts((prev) => [...prev, ...enriched]);
      } else {
        setPosts(enriched);
      }

      setLoading(false);
      setLoadingMore(false);
    },
    [enrichPosts, searchQuery]
  );

  // Initial + search
  useEffect(() => {
    pageRef.current = 0;
    setHasMore(true);
    fetchPosts(0, false);
  }, [fetchPosts]);

  // Infinite scroll observer
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

    // Optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              liked_by_me: !p.liked_by_me,
              likes_count: p.liked_by_me ? p.likes_count - 1 : p.likes_count + 1,
            }
          : p
      )
    );

    if (post.liked_by_me) {
      await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", user.id);
    } else {
      await supabase.from("likes").insert({ user_id: user.id, post_id: postId });
    }
  };

  const handleSave = async (postId: string) => {
    if (!user) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, saved_by_me: !p.saved_by_me } : p))
    );

    if (post.saved_by_me) {
      await supabase.from("post_saves").delete().eq("post_id", postId).eq("user_id", user.id);
    } else {
      await supabase.from("post_saves").insert({ user_id: user.id, post_id: postId });
    }
  };

  const handleRefresh = () => {
    pageRef.current = 0;
    fetchPosts(0, false);
  };

  return (
    <>
      <FeedTopBar searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      <main className="pt-16 pb-20 px-4 max-w-xl mx-auto space-y-4">
        {loading ? (
          <>
            <PostSkeleton />
            <PostSkeleton />
            <PostSkeleton />
          </>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-lg font-display" style={{ color: "#9CA3AF" }}>
              Nenhum post encontrado
            </p>
            <p className="text-sm mt-1" style={{ color: "#9CA3AF" }}>
              Seja o primeiro a publicar!
            </p>
          </div>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              userId={user?.id}
              onLike={handleLike}
              onSave={handleSave}
              onRefresh={handleRefresh}
            />
          ))
        )}

        {loadingMore && <PostSkeleton />}
        <div ref={loadMoreRef} className="h-4" />
      </main>
    </>
  );
};

export default Feed;
