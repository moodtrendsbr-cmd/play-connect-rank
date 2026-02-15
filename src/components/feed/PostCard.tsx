import { useState } from "react";
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, Trash2, Link2, Flag, Star } from "lucide-react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import PostTypeBadge from "./PostTypeBadge";
import PostImageCarousel from "./PostImageCarousel";
import PostComments from "./PostComments";

export interface PostData {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  content: string;
  type: string;
  created_at: string;
  media: { media_url: string; order_index: number }[];
  likes_count: number;
  comments_count: number;
  top_comments: { id: string; content: string; author_name: string; created_at: string }[];
  liked_by_me: boolean;
  saved_by_me: boolean;
}

interface PostCardProps {
  post: PostData;
  userId: string | undefined;
  onLike: (postId: string) => void;
  onSave: (postId: string) => void;
  onRefresh: () => void;
}

const getInitials = (name: string) => name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

const renderContent = (content: string) => {
  const parts = content.split(/(#\w+)/g);
  return parts.map((part, i) => {
    if (part.match(/^#\w+$/)) {
      return (
        <span key={i} className="cursor-pointer font-semibold" style={{ color: "#2BFF88" }}>
          {part}
        </span>
      );
    }
    return part;
  });
};

const PostCard = ({ post, userId, onLike, onSave, onRefresh }: PostCardProps) => {
  const isHighlight = post.type === "highlight";
  const isAuthor = userId === post.author_id;
  const [deleting, setDeleting] = useState(false);

  const handleShare = async () => {
    const url = `${window.location.origin}/feed#${post.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: post.author_name, text: post.content?.slice(0, 100), url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copiado!" });
    }
  };

  const handleDelete = async () => {
    if (!userId || deleting) return;
    setDeleting(true);
    const { error } = await supabase.from("posts").delete().eq("id", post.id).eq("author_id", userId);
    if (error) { toast({ title: "Erro ao excluir", variant: "destructive" }); setDeleting(false); return; }
    toast({ title: "Post excluído" });
    onRefresh();
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/feed#${post.id}`);
    toast({ title: "Link copiado!" });
  };

  const handleHighlight = async () => {
    if (!userId) return;
    const { error } = await supabase.from("profile_highlights").insert({ user_id: userId, post_id: post.id } as any);
    if (error?.code === "23505") { toast({ title: "Já está nos destaques" }); return; }
    if (error) { toast({ title: "Erro", variant: "destructive" }); return; }
    toast({ title: "Adicionado aos destaques!" });
  };

  return (
    <article
      className="rounded-xl overflow-hidden"
      style={{
        background: "#0B0F12",
        border: `1px solid ${isHighlight ? "rgba(43, 255, 136, 0.3)" : "rgba(43, 255, 136, 0.08)"}`,
        boxShadow: isHighlight ? "0 0 20px rgba(43, 255, 136, 0.1)" : "none",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <Link to={`/profile/${post.author_id}`} className="flex items-center gap-3">
          {post.author_avatar ? (
            <img src={post.author_avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "rgba(43, 255, 136, 0.15)", color: "#2BFF88" }}>
              {getInitials(post.author_name)}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">{post.author_name}</span>
              <PostTypeBadge type={post.type} />
            </div>
            <span className="text-[11px]" style={{ color: "#9CA3AF" }}>
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
            </span>
          </div>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1">
              <MoreHorizontal className="h-5 w-5" style={{ color: "#9CA3AF" }} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" style={{ background: "#0B0F12", border: "1px solid rgba(43,255,136,0.15)" }}>
            <DropdownMenuItem onClick={handleCopyLink} className="text-white hover:text-white cursor-pointer">
              <Link2 className="h-4 w-4 mr-2" /> Copiar link
            </DropdownMenuItem>
            {isAuthor && (
              <DropdownMenuItem onClick={handleHighlight} className="text-white hover:text-white cursor-pointer">
                <Star className="h-4 w-4 mr-2" /> Adicionar aos Destaques
              </DropdownMenuItem>
            )}
            {isAuthor && (
              <DropdownMenuItem onClick={handleDelete} disabled={deleting} className="text-red-400 hover:text-red-400 cursor-pointer">
                <Trash2 className="h-4 w-4 mr-2" /> Excluir post
              </DropdownMenuItem>
            )}
            {!isAuthor && (
              <DropdownMenuItem className="text-white hover:text-white cursor-pointer">
                <Flag className="h-4 w-4 mr-2" /> Denunciar
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Media */}
      {post.media.length > 0 && <PostImageCarousel images={post.media} />}

      {/* Content text */}
      {post.content && (
        <div className="px-4 pt-3">
          <p className="text-sm text-white whitespace-pre-wrap">{renderContent(post.content)}</p>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 pt-3 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <motion.button whileTap={{ scale: 1.3 }} onClick={() => onLike(post.id)} className="flex items-center gap-1.5">
            <Heart className="h-5 w-5 transition-colors" style={{ color: post.liked_by_me ? "#ef4444" : "#9CA3AF", fill: post.liked_by_me ? "#ef4444" : "transparent" }} />
            <span className="text-xs" style={{ color: "#9CA3AF" }}>{post.likes_count}</span>
          </motion.button>
          <span className="flex items-center gap-1.5">
            <MessageCircle className="h-5 w-5" style={{ color: "#9CA3AF" }} />
            <span className="text-xs" style={{ color: "#9CA3AF" }}>{post.comments_count}</span>
          </span>
          <button onClick={handleShare}>
            <Share2 className="h-5 w-5" style={{ color: "#9CA3AF" }} />
          </button>
        </div>
        <motion.button whileTap={{ scale: 1.2 }} onClick={() => onSave(post.id)}>
          <Bookmark className="h-5 w-5 transition-colors" style={{ color: post.saved_by_me ? "#2BFF88" : "#9CA3AF", fill: post.saved_by_me ? "#2BFF88" : "transparent" }} />
        </motion.button>
      </div>

      {/* Comments */}
      <div className="px-4 py-3">
        <PostComments postId={post.id} userId={userId} comments={post.top_comments} totalComments={post.comments_count} onCommentAdded={onRefresh} />
      </div>
    </article>
  );
};

export default PostCard;
