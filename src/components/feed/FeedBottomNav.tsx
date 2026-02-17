import { useState, useEffect } from "react";
import { Home, Medal, Plus, Trophy, ShoppingBag, Building2 } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface FeedBottomNavProps {
  onCreatePost?: () => void;
}

const navItems = [
  { icon: Home, label: "Feed", path: "/feed" },
  { icon: Trophy, label: "Torneios", path: "/tournaments" },
  { icon: null, label: "Criar", path: "" },
  { icon: ShoppingBag, label: "Loja", path: "/marketplace" },
  { icon: Building2, label: "Arenas", path: "/arenas" },
];

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

        const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
        const Icon = item.icon!;

        const handleClick = (e: React.MouseEvent) => {
          if (item.path === "/feed" && isActive) {
            e.preventDefault();
            window.dispatchEvent(new Event("feed-scroll-top"));
          }
        };

        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={handleClick}
            className="flex flex-col items-center gap-0.5 py-1 px-3 relative"
          >
            <Icon className="h-5 w-5" style={{ color: isActive ? "#2BFF88" : "#9CA3AF" }} />
            <span
              className="text-[10px] font-medium"
              style={{ color: isActive ? "#2BFF88" : "#9CA3AF" }}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
};

export default FeedBottomNav;
