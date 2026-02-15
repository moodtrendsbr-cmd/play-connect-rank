import { Search, Bell, CircleUserRound, Mail } from "lucide-react";
import { Link } from "react-router-dom";

interface FeedTopBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

const FeedTopBar = ({ searchQuery, onSearchChange }: FeedTopBarProps) => {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-14"
      style={{
        background: "#050708",
        borderBottom: "1px solid rgba(43, 255, 136, 0.1)",
        boxShadow: "0 1px 20px rgba(43, 255, 136, 0.05)",
      }}
    >
      <Link to="/" className="font-display text-xl tracking-wider" style={{ color: "#2BFF88" }}>
        🏐 MOOD PLAY
      </Link>

      <div className="flex-1 mx-4 max-w-xs">
        <div
          className="flex items-center gap-2 rounded-full px-3 py-1.5"
          style={{ background: "#0B0F12" }}
        >
          <Search className="h-4 w-4" style={{ color: "#9CA3AF" }} />
          <input
            type="text"
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-transparent text-sm text-white placeholder:text-[#9CA3AF] outline-none w-full"
          />
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Link to="/messages" className="p-2">
          <Mail className="h-5 w-5" style={{ color: "#9CA3AF" }} />
        </Link>
        <button className="relative p-2">
          <Bell className="h-5 w-5" style={{ color: "#9CA3AF" }} />
        </button>
        <Link to="/profile" className="p-2">
          <CircleUserRound className="h-5 w-5" style={{ color: "#9CA3AF" }} />
        </Link>
      </div>
    </header>
  );
};

export default FeedTopBar;
