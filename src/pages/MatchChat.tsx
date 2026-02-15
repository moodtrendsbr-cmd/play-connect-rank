import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Send } from "lucide-react";

interface MatchMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

const getInitials = (name: string) =>
  name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

const MatchChat = () => {
  const { id, conversationId } = useParams<{ id: string; conversationId: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<MatchMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [members, setMembers] = useState<Record<string, { full_name: string; avatar_url: string | null }>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!conversationId) return;
    const loadMembers = async () => {
      const { data: cm } = await supabase.from("match_conversation_members").select("user_id").eq("conversation_id", conversationId);
      if (cm && cm.length > 0) {
        const userIds = cm.map((m: any) => m.user_id);
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", userIds);
        const map: Record<string, any> = {};
        (profiles || []).forEach((p) => { map[p.user_id] = p; });
        setMembers(map);
      }
    };
    loadMembers();
  }, [conversationId]);

  const fetchMessages = async () => {
    if (!conversationId) return;
    const { data } = await supabase
      .from("match_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    setMessages((data as MatchMessage[]) || []);

    // Mark as read
    if (user) {
      await supabase
        .from("match_messages")
        .update({ read_at: new Date().toISOString() } as any)
        .eq("conversation_id", conversationId)
        .neq("sender_id", user.id)
        .is("read_at", null);
    }
  };

  useEffect(() => { fetchMessages(); }, [conversationId, user]);

  // Realtime
  useEffect(() => {
    if (!conversationId || !user) return;
    const channel = supabase
      .channel(`match-chat-${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "match_messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const msg = payload.new as MatchMessage;
        setMessages((prev) => [...prev, msg]);
        if (msg.sender_id !== user.id) {
          supabase.from("match_messages").update({ read_at: new Date().toISOString() } as any).eq("id", msg.id);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!user || !conversationId || !text.trim()) return;
    setSending(true);
    await supabase.from("match_messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: text.trim(),
    } as any);
    setText("");
    setSending(false);
  };

  const memberNames = Object.values(members).map((m) => m.full_name).filter((n) => n).join(", ");

  return (
    <main className="flex flex-col h-[calc(100vh-56px)] max-w-xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "rgba(43,255,136,0.1)" }}>
        <Link to={`/tournaments/${id}/match/pair`} className="p-1">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{memberNames || "Chat"}</p>
          <p className="text-xs text-muted-foreground">Match Chat</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.map((m) => {
          const isMine = m.sender_id === user?.id;
          const sender = members[m.sender_id];
          return (
            <div key={m.id}>
              {!isMine && Object.keys(members).length > 2 && (
                <p className="text-xs text-muted-foreground ml-1 mb-0.5">{sender?.full_name}</p>
              )}
              <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[75%] px-3 py-2 rounded-2xl text-sm"
                  style={isMine
                    ? { background: "hsl(var(--primary))", color: "#050708", borderBottomRightRadius: 4 }
                    : { background: "hsl(var(--card))", color: "hsl(var(--foreground))", borderBottomLeftRadius: 4, border: "1px solid hsl(var(--border))" }
                  }
                >
                  {m.content}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t flex gap-2" style={{ borderColor: "rgba(43,255,136,0.1)" }}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Mensagem..."
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none border rounded-full px-4 py-2 border-border"
        />
        <button
          onClick={handleSend}
          disabled={sending || !text.trim()}
          className="h-9 w-9 rounded-full flex items-center justify-center disabled:opacity-30 bg-primary"
        >
          <Send className="h-4 w-4 text-primary-foreground" />
        </button>
      </div>
    </main>
  );
};

export default MatchChat;
