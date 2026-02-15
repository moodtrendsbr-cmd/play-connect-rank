import { Trophy, Medal, Star } from "lucide-react";

interface PostTypeBadgeProps {
  type: string;
}

const PostTypeBadge = ({ type }: PostTypeBadgeProps) => {
  if (type === "user" || type === "manual") return null;

  const config: Record<string, { label: string; icon: typeof Trophy; bg: string; text: string }> = {
    tournament: { label: "Torneio", icon: Trophy, bg: "rgba(43, 255, 136, 0.15)", text: "#2BFF88" },
    ranking: { label: "Ranking", icon: Medal, bg: "rgba(250, 204, 21, 0.15)", text: "#FACC15" },
    highlight: { label: "Destaque", icon: Star, bg: "rgba(43, 255, 136, 0.2)", text: "#2BFF88" },
  };

  const c = config[type];
  if (!c) return null;
  const Icon = c.icon;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ background: c.bg, color: c.text }}
    >
      <Icon className="h-3 w-3" />
      {c.label}
    </span>
  );
};

export default PostTypeBadge;
