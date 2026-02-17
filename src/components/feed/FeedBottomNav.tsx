import { useState, useEffect } from "react";
import { Home, Plus, Trophy, ShoppingBag, Building2 } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface FeedBottomNavProps {
  onCreatePost?: () => void;
}

const FeedBottomNav = ({ onCreatePost }: FeedBottomNavProps) => {
  const location = useLocation();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .eq("read", false);
      setUnreadCount(count || 0);
    };
    fetchUnread();

    const channel = supabase
      .channel("unread-badge")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => fetchUnread())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const isTorneios = location.pathname === "/tournaments" || location.pathname.startsWith("/tournaments/");
  const isRanking = location.pathname === "/ranking";
  const isTorneiosRankingActive = isTorneios || isRanking;

  // Toggle between tournaments and ranking
  const torneiosRankingPath = isTorneios ? "/ranking" : "/tournaments";

  const navItems = [
    { icon: Home, label: "Feed", path: "/feed" },
    { icon: Trophy, label: isTorneios ? "Ranking" : isRanking ? "Torneios" : "Torneios", path: torneiosRankingPath, sublabel: isTorneios ? "Torneios" : isRanking ? "Ranking" : "Ranking", isCombo: true },
    { icon: null, label: "Criar", path: "" },
    { icon: Building2, label: "Arenas", path: "/arenas" },
    { icon: ShoppingBag, label: "Loja", path: "/marketplace" },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around h-14 px-2"
      style={{
        background: "#050708",
        borderTop: "1px solid rgba(43, 255, 136, 0.1)",
      }}
    >
      {navItems.map((item, i) => {
        if (i === 2) {
          return (
            <button
              key="create"
              onClick={() => onCreatePost?.()}
              className="flex items-center justify-center rounded-full -mt-4 h-11 w-11 shadow-lg transition-transform active:scale-90"
              style={{
                background: "#2BFF88",
                boxShadow: "0 0 16px rgba(43, 255, 136, 0.4)",
              }}
            >
              <Plus className="h-5 w-5" style={{ color: "#050708" }} />
            </button>
          );
        }

        const isActive = item.isCombo
          ? isTorneiosRankingActive
          : location.pathname === item.path || location.pathname.startsWith(item.path + "/");
        const Icon = item.icon!;

        const handleClick = (e: React.MouseEvent) => {
          if (item.path === "/feed" && isActive) {
            e.preventDefault();
            window.dispatchEvent(new Event("feed-scroll-top"));
          }
        };

        return (
          <Link
            key={item.path + item.label}
            to={item.path}
            onClick={handleClick}
            className="flex flex-col items-center gap-0.5 py-1 px-3 relative"
          >
            <Icon className="h-5 w-5" style={{ color: isActive ? "#2BFF88" : "#9CA3AF" }} />
            {item.isCombo ? (
              <div className="flex flex-col items-center leading-none">
                <span
                  className="text-[10px] font-medium"
                  style={{ color: isActive ? "#2BFF88" : "#9CA3AF" }}
                >
                  {isTorneiosRankingActive ? (isTorneios ? "Torneios" : "Ranking") : "Torneios"}
                </span>
                <span
                  className="text-[7px]"
                  style={{ color: isActive ? "rgba(43,255,136,0.6)" : "rgba(156,163,175,0.6)" }}
                >
                  {isTorneiosRankingActive ? (isTorneios ? "► Ranking" : "► Torneios") : "/ Ranking"}
                </span>
              </div>
            ) : (
              <span
                className="text-[10px] font-medium"
                style={{ color: isActive ? "#2BFF88" : "#9CA3AF" }}
              >
                {item.label}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
};

export default FeedBottomNav;
