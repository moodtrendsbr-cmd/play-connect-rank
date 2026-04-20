import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, Clock, UserCheck } from "lucide-react";
import { format } from "date-fns";

interface Props {
  tournamentId: string;
}

const TabCheckin = ({ tournamentId }: Props) => {
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("enrollments")
      .select("*")
      .eq("tournament_id", tournamentId)
      .eq("status", "paid")
      .order("created_at");
    const list = data || [];
    setEnrollments(list);

    const userIds = list.map((e) => e.user_id).filter(Boolean);
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      const map: Record<string, any> = {};
      (profiles || []).forEach((p) => { map[p.user_id] = p; });
      setProfileMap(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [tournamentId]);

  const toggleCheckin = async (e: any) => {
    const newValue = e.checked_in_at ? null : new Date().toISOString();
    const { error } = await supabase
      .from("enrollments")
      .update({ checked_in_at: newValue })
      .eq("id", e.id);
    if (error) { toast.error(error.message); return; }
    toast.success(newValue ? "Check-in confirmado" : "Check-in revertido");
    load();
  };

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>;
  }

  if (enrollments.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <UserCheck className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>Nenhuma inscrição paga.</p>
      </div>
    );
  }

  const checkedIn = enrollments.filter((e) => e.checked_in_at).length;

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Presença confirmada</p>
            <p className="text-2xl font-bold text-foreground">
              {checkedIn} <span className="text-sm text-muted-foreground">/ {enrollments.length}</span>
            </p>
          </div>
          <CheckCircle2 className="h-8 w-8 text-primary" />
        </CardContent>
      </Card>

      <div className="space-y-2">
        {enrollments.map((e) => {
          const name = profileMap[e.user_id]?.full_name || e.athlete_name || "Atleta";
          const isChecked = !!e.checked_in_at;
          return (
            <div key={e.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{name}</p>
                {isChecked && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" />
                    {format(new Date(e.checked_in_at), "dd/MM HH:mm")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isChecked ? (
                  <Badge className="bg-primary/20 text-primary">Presente</Badge>
                ) : (
                  <Badge variant="outline">Ausente</Badge>
                )}
                <Button size="sm" variant={isChecked ? "ghost" : "default"} onClick={() => toggleCheckin(e)}>
                  {isChecked ? "Reverter" : "Check-in"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TabCheckin;
