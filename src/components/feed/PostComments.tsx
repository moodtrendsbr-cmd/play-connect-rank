import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Send } from "lucide-react";
import MentionInput from "./MentionInput";

interface Comment {
  id: string;
  content: string;
  author_name: string;
  created_at: string;
}

interface PostCommentsProps {
  postId: string;
  userId: string | undefined;
  comments: Comment[];
  totalComments: number;
  onCommentAdded: () => void;
}

const renderCommentContent = (content: string) => {
  const parts = content.split(/(#\w+|@[^\s@]+(?:\s[^\s@#]+)*)/g);
  return parts.map((part, i) => {
    if (part.match(/^[#@]/)) {
      return <span key={i} className="font-semibold" style={{ color: "#2BFF88" }}>{part}</span>;
    }
    return part;
  });
};

const PostComments = ({ postId, userId, comments, totalComments, onCommentAdded }: PostCommentsProps) => {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!userId || !text.trim()) return;
    setSending(true);
    const { data: comment } = await supabase.from("comments").insert({
      post_id: postId,
      author_id: userId,
      content: text.trim(),
    }).select("id").single();

    // Extract mentions from comment
    if (comment) {
      const matches = text.match(/@([^\s@]+(?:\s[^\s@#]+)*)/g);
      if (matches) {
        const names = [...new Set(matches.map((m) => m.slice(1).trim()))];
        for (const name of names) {
          const { data: profile } = await supabase.from("profiles").select("user_id").ilike("full_name", name).maybeSingle();
          if (!profile) continue;
          await supabase.from("mentions").insert({
            mentioned_user_id: profile.user_id,
            mentioner_id: userId,
            post_id: postId,
            comment_id: comment.id,
          } as any);
        }
      }
    }

    setText("");
    setSending(false);
    onCommentAdded();
  };

  return (
    <div className="space-y-2">
      {comments.map((c) => (
        <p key={c.id} className="text-sm">
          <span className="font-semibold text-white">{c.author_name}</span>{" "}
          <span style={{ color: "#9CA3AF" }}>{renderCommentContent(c.content)}</span>
        </p>
      ))}
      {totalComments > 2 && (
        <button className="text-xs font-medium" style={{ color: "#9CA3AF" }}>
          Ver todos os {totalComments} comentários
        </button>
      )}
      {userId && (
        <div className="flex items-center gap-2 mt-1">
          <MentionInput
            value={text}
            onChange={setText}
            placeholder="Adicionar comentário..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-[#9CA3AF] outline-none border-b border-[#9CA3AF]/20 py-1"
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
          <button
            onClick={handleSubmit}
            disabled={sending || !text.trim()}
            className="p-1 disabled:opacity-30"
          >
            <Send className="h-4 w-4" style={{ color: "#2BFF88" }} />
          </button>
        </div>
      )}
    </div>
  );
};

export default PostComments;
