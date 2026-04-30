import { NavLink } from "react-router-dom";
import { Rss, Trophy, Medal, MessageSquare, User } from "lucide-react";

const items = [
  { title: "Feed", url: "/athlete/feed", icon: Rss },
  { title: "Torneios", url: "/athlete/torneios", icon: Trophy },
  { title: "Ranking", url: "/athlete/ranking", icon: Medal },
  { title: "Mensagens", url: "/athlete/mensagens", icon: MessageSquare },
  { title: "Perfil", url: "/athlete/perfil", icon: User },
];

export function AthleteBottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <ul className="grid grid-cols-5">
        {items.map((it) => (
          <li key={it.url}>
            <NavLink
              to={it.url}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`
              }
            >
              <it.icon className="h-5 w-5" />
              <span>{it.title}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
