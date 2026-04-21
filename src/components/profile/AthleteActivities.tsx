import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Users, Calendar, Award } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AthleteActivitiesProps {
  athleteId: string;
}

const ICONS: Record<string, any> = {
  "tournament.match_won": Trophy,
  "tournament.match_lost": Trophy,
  "tournament.enrolled": Users,
  "tournament.checked_in": Calendar,
  "tournament.placed": Award,
  "class.attended": Calendar,
};

const LABELS: Record<string, string> = {
  "tournament.match_won": "Venceu uma partida",
  "tournament.match_lost": "Disputou uma partida",
  "tournament.enrolled": "Inscreveu-se em torneio",
  "tournament.checked_in": "Fez check-in em torneio",
  "tournament.placed": "Pódio",
  "class.attended": "Compareceu a uma aula",
};

const AthleteActivities = ({ athleteId }: AthleteActivitiesProps) => {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("athlete_activities" as any)
        .select("*")
        .eq("athlete_id", athleteId)
        .in("activity_type", ["tournament.match_won", "tournament.checked_in", "tournament.placed", "class.attended", "tournament.enrolled"])
        .order("created_at", { ascending: false })
        .limit(20);
      setActivities((data as any[]) || []);
      setLoading(false);
    };
    fetch();
  }, [athleteId]);

  if (loading) return <p className="text-sm text-muted-foreground">Carregando atividades…</p>;
  if (activities.length === 0) return <p className="text-sm text-muted-foreground">Nenhuma atividade recente.</p>;

  return (
    <div className="space-y-2">
      {activities.map((a) => {
        const Icon = ICONS[a.activity_type] || Trophy;
        return (
          <div key={a.id} className="flex items-center gap-3 rounded-lg p-3" style={{ background: "#0B0F12", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="rounded-full p-2" style={{ background: "rgba(43,255,136,0.1)" }}>
              <Icon className="h-4 w-4" style={{ color: "#2BFF88" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">{LABELS[a.activity_type] || a.activity_type}</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AthleteActivities;
