import { useState } from "react";
import { FileText, Pin } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import PostCard, { PostData } from "@/components/feed/PostCard";

interface PostGridProps {
  posts: PostData[];
  userId: string | undefined;
  onLike: (postId: string) => void;
  onSave: (postId: string) => void;
  onRefresh: () => void;
}

const PostGrid = ({ posts, userId, onLike, onSave, onRefresh }: PostGridProps) => {
  const [selectedPost, setSelectedPost] = useState<PostData | null>(null);

  return (
    <>
      <div className="grid grid-cols-3 gap-1">
        {posts.map((post) => {
          const coverImage = post.media?.[0]?.media_url;
          const isPinned = !!(post as any).pinned_at;

          return (
            <button
              key={post.id}
              onClick={() => setSelectedPost(post)}
              className="relative aspect-square overflow-hidden rounded-md"
              style={{ background: "#0B0F12", border: "1px solid rgba(43,255,136,0.08)" }}
            >
              {coverImage ? (
                <img src={coverImage} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ background: "rgba(43,255,136,0.05)" }}>
                  <FileText className="h-6 w-6" style={{ color: "#9CA3AF" }} />
                </div>
              )}
              {isPinned && (
                <div className="absolute top-1 right-1 p-0.5 rounded-full" style={{ background: "rgba(0,0,0,0.6)" }}>
                  <Pin className="h-3 w-3" style={{ color: "#2BFF88" }} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <Dialog open={!!selectedPost} onOpenChange={(o) => !o && setSelectedPost(null)}>
        <DialogContent className="max-w-lg p-0 border-0 overflow-y-auto max-h-[90vh]" style={{ background: "transparent" }}>
          {selectedPost && (
            <PostCard
              post={selectedPost}
              userId={userId}
              onLike={onLike}
              onSave={onSave}
              onRefresh={() => { onRefresh(); setSelectedPost(null); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PostGrid;
