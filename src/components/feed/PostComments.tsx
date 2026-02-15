import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Send } from "lucide-react";

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

const PostComments = ({ postId, userId, comments, totalComments, onCommentAdded }: PostCommentsProps) => {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!userId || !text.trim()) return;
    setSending(true);
    await supabase.from("comments").insert({
      post_id: postId,
      author_id: userId,
      content: text.trim(),
    });
    setText("");
    setSending(false);
    onCommentAdded();
  };

  return (
    <div className="space-y-2">
      {comments.map((c) => (
        <p key={c.id} className="text-sm">
          <span className="font-semibold text-white">{c.author_name}</span>{" "}
          <span style={{ color: "#9CA3AF" }}>{c.content}</span>
        </p>
      ))}
      {totalComments > 2 && (
        <button className="text-xs font-medium" style={{ color: "#9CA3AF" }}>
          Ver todos os {totalComments} comentários
        </button>
      )}
      {userId && (
        <div className="flex items-center gap-2 mt-1">
          <input
            type="text"
            placeholder="Adicionar comentário..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-[#9CA3AF] outline-none border-b border-[#9CA3AF]/20 py-1"
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
