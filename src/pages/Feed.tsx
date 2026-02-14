import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Heart, MessageCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const Feed = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [newPost, setNewPost] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchPosts = async () => {
    const { data: postsData } = await supabase
      .from("posts")
      .select("*, likes(count), comments(count)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!postsData || postsData.length === 0) {
      setPosts([]);
      return;
    }

    // Fetch profiles for all unique author_ids
    const authorIds = [...new Set(postsData.map((p) => p.author_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", authorIds);

    const profileMap: Record<string, string> = {};
    (profiles || []).forEach((p) => { profileMap[p.user_id] = p.full_name; });

    setPosts(postsData.map((p) => ({ ...p, author_name: profileMap[p.author_id] || "Atleta" })));
  };

  useEffect(() => { fetchPosts(); }, []);

  const handlePost = async () => {
    if (!user || !newPost.trim()) return;
    setLoading(true);
    const { error } = await supabase.from("posts").insert({
      author_id: user.id,
      content: newPost.trim(),
      type: "manual",
    });
    setLoading(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setNewPost("");
      fetchPosts();
    }
  };

  const handleLike = async (postId: string) => {
    if (!user) return;
    const { data: existing } = await supabase
      .from("likes")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      await supabase.from("likes").delete().eq("id", existing.id);
    } else {
      await supabase.from("likes").insert({ user_id: user.id, post_id: postId });
    }
    fetchPosts();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="text-2xl font-display text-primary text-glow">🏐 MOOD PLAY</Link>
          <div className="flex items-center gap-4">
            <Link to="/ranking" className="text-sm text-muted-foreground hover:text-foreground">Ranking</Link>
            <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">Dashboard</Link>
          </div>
        </div>
      </header>

      <main className="container max-w-2xl py-8">
        <h1 className="mb-8 text-4xl font-display text-foreground">FEED</h1>

        {user && (
          <Card className="mb-8">
            <CardContent className="pt-6 space-y-4">
              <Textarea
                placeholder="O que está acontecendo?"
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
              />
              <Button onClick={handlePost} disabled={loading || !newPost.trim()}>
                {loading ? "Publicando..." : "Publicar"}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {posts.map((post) => (
            <Card key={post.id} className="hover:border-primary/20 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-sm">{post.author_name || "Atleta"}</span>
                  <span className="text-xs text-muted-foreground">{new Date(post.created_at).toLocaleDateString("pt-BR")}</span>
                </div>
                <p className="text-foreground">{post.content}</p>
                <div className="mt-4 flex items-center gap-6">
                  <button onClick={() => handleLike(post.id)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors">
                    <Heart className="h-4 w-4" /> {post.likes?.[0]?.count || 0}
                  </button>
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MessageCircle className="h-4 w-4" /> {post.comments?.[0]?.count || 0}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Feed;
