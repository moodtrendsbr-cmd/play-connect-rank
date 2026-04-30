import { Profile } from "./mock/tournamentData";
import { cn } from "@/lib/utils";
import { User, Building2, Trophy, Globe } from "lucide-react";

const opts: { id: Profile; label: string; icon: any }[] = [
  { id: "athlete", label: "Atleta", icon: User },
  { id: "arena", label: "Arena", icon: Building2 },
  { id: "organizer", label: "Organizador", icon: Trophy },
  { id: "public", label: "Público", icon: Globe },
];

export default function ProfileTabs({ value, onChange }: { value: Profile; onChange: (p: Profile) => void }) {
  return (
    <div className="flex items-center gap-1.5 p-1 rounded-full bg-card border border-border">
      {opts.map((o) => {
        const Icon = o.icon;
        const active = value === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all",
              active ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
