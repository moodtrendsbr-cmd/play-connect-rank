import { Home, Medal, Plus, Trophy, User } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

interface FeedBottomNavProps {
  onCreatePost: () => void;
}

const navItems = [
  { icon: Home, label: "Feed", path: "/feed" },
  { icon: Medal, label: "Ranking", path: "/ranking" },
  { icon: null, label: "Criar", path: "" }, // placeholder for center button
  { icon: Trophy, label: "Torneios", path: "/tournaments" },
  { icon: User, label: "Perfil", path: "/profile" },
];

const FeedBottomNav = ({ onCreatePost }: FeedBottomNavProps) => {
  const location = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around h-16 px-2"
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
              onClick={onCreatePost}
              className="flex items-center justify-center rounded-full -mt-5 h-14 w-14 shadow-lg transition-transform active:scale-90"
              style={{
                background: "#2BFF88",
                boxShadow: "0 0 20px rgba(43, 255, 136, 0.4)",
              }}
            >
              <Plus className="h-7 w-7" style={{ color: "#050708" }} />
            </button>
          );
        }

        const isActive = location.pathname === item.path;
        const Icon = item.icon!;

        return (
          <Link
            key={item.path}
            to={item.path}
            className="flex flex-col items-center gap-0.5 py-1 px-3"
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
