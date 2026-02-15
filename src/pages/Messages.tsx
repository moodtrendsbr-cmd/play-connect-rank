import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Mail } from "lucide-react";

interface Conversation {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  lastMessage: string;
  lastAt: string;
  unread: number;
}

const getInitials = (name: string) =>
  name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

const Messages = () => {
  const { user } = useAuth();
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (!msgs || msgs.length === 0) { setConvos([]); setLoading(false); return; }

      // Group by other user
      const map: Record<string, { msgs: any[] }> = {};
      msgs.forEach((m: any) => {
        const otherId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
        if (!map[otherId]) map[otherId] = { msgs: [] };
        map[otherId].msgs.push(m);
      });

      const otherIds = Object.keys(map);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", otherIds);

      const profileMap: Record<string, any> = {};
      (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p; });

      const result: Conversation[] = otherIds.map((uid) => {
        const latest = map[uid].msgs[0];
        const unread = map[uid].msgs.filter((m: any) => m.receiver_id === user.id && !m.read).length;
        const p = profileMap[uid];
        return {
          userId: uid,
          fullName: p?.full_name || "Usuário",
          avatarUrl: p?.avatar_url || null,
          lastMessage: latest.content,
          lastAt: latest.created_at,
          unread,
        };
      });
      result.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
      setConvos(result);
      setLoading(false);
    };
    fetch();
  }, [user]);

  return (
    <main className="px-4 py-6 pb-24 max-w-xl mx-auto">
      <h1 className="text-xl font-display text-white mb-4 flex items-center gap-2">
        <Mail className="h-5 w-5" style={{ color: "#2BFF88" }} /> Mensagens
      </h1>
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg animate-pulse" style={{ background: "rgba(43,255,136,0.05)" }} />
          ))}
        </div>
      ) : convos.length === 0 ? (
        <p className="text-sm text-center py-12" style={{ color: "#9CA3AF" }}>Nenhuma conversa ainda</p>
      ) : (
        <div className="space-y-2">
          {convos.map((c) => (
            <Link
              key={c.userId}
              to={`/messages/${c.userId}`}
              className="flex items-center gap-3 px-3 py-3 rounded-lg transition-colors hover:bg-white/5"
              style={{ background: c.unread > 0 ? "rgba(43,255,136,0.05)" : "transparent" }}
            >
              {c.avatarUrl ? (
                <img src={c.avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
              ) : (
                <div className="h-11 w-11 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "rgba(43,255,136,0.15)", color: "#2BFF88" }}>
                  {getInitials(c.fullName)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">{c.fullName}</span>
                  {c.unread > 0 && (
                    <span className="h-5 min-w-[20px] rounded-full flex items-center justify-center text-[10px] font-bold px-1" style={{ background: "#2BFF88", color: "#050708" }}>
                      {c.unread}
                    </span>
                  )}
                </div>
                <p className="text-xs truncate" style={{ color: "#9CA3AF" }}>{c.lastMessage}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
};

export default Messages;
