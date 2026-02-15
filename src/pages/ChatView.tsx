import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Send } from "lucide-react";

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

const getInitials = (name: string) =>
  name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

const ChatView = () => {
  const { userId: otherUserId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [otherProfile, setOtherProfile] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!otherUserId) return;
    supabase.from("profiles").select("full_name, avatar_url").eq("user_id", otherUserId).single()
      .then(({ data }) => setOtherProfile(data));
  }, [otherUserId]);

  const fetchMessages = async () => {
    if (!user || !otherUserId) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
      .order("created_at", { ascending: true });
    setMessages((data as Message[]) || []);

    // Mark as read
    await supabase
      .from("messages")
      .update({ read: true } as any)
      .eq("sender_id", otherUserId)
      .eq("receiver_id", user.id)
      .eq("read", false);
  };

  useEffect(() => {
    fetchMessages();
  }, [user, otherUserId]);

  // Realtime
  useEffect(() => {
    if (!user || !otherUserId) return;
    const channel = supabase
      .channel(`chat-${otherUserId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new as Message;
        if ((msg.sender_id === user.id && msg.receiver_id === otherUserId) ||
            (msg.sender_id === otherUserId && msg.receiver_id === user.id)) {
          setMessages((prev) => [...prev, msg]);
          if (msg.sender_id === otherUserId) {
            supabase.from("messages").update({ read: true } as any).eq("id", msg.id);
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, otherUserId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!user || !otherUserId || !text.trim()) return;
    setSending(true);
    await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: otherUserId,
      content: text.trim(),
    } as any);
    setText("");
    setSending(false);
  };

  return (
    <main className="flex flex-col h-[calc(100vh-56px)] max-w-xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "rgba(43,255,136,0.1)" }}>
        <Link to="/messages" className="p-1">
          <ArrowLeft className="h-5 w-5 text-white" />
        </Link>
        {otherProfile?.avatar_url ? (
          <img src={otherProfile.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "rgba(43,255,136,0.15)", color: "#2BFF88" }}>
            {getInitials(otherProfile?.full_name || "U")}
          </div>
        )}
        <span className="text-sm font-semibold text-white">{otherProfile?.full_name || "..."}</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.map((m) => {
          const isMine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className="max-w-[75%] px-3 py-2 rounded-2xl text-sm"
                style={isMine
                  ? { background: "#2BFF88", color: "#050708", borderBottomRightRadius: 4 }
                  : { background: "#1a1f25", color: "#fff", borderBottomLeftRadius: 4 }
                }
              >
                {m.content}
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
          className="flex-1 bg-transparent text-sm text-white placeholder:text-[#9CA3AF] outline-none border rounded-full px-4 py-2"
          style={{ borderColor: "rgba(43,255,136,0.2)" }}
        />
        <button
          onClick={handleSend}
          disabled={sending || !text.trim()}
          className="h-9 w-9 rounded-full flex items-center justify-center disabled:opacity-30"
          style={{ background: "#2BFF88" }}
        >
          <Send className="h-4 w-4" style={{ color: "#050708" }} />
        </button>
      </div>
    </main>
  );
};

export default ChatView;
