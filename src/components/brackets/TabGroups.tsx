import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Layers } from "lucide-react";

interface TabGroupsProps {
  modalityId: string;
}

const TabGroups = ({ modalityId }: TabGroupsProps) => {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data: groupsData } = await supabase
        .from("modality_groups")
        .select("*")
        .eq("modality_id", modalityId)
        .order("group_name");

      const gList = groupsData || [];

      if (gList.length > 0) {
        const groupIds = gList.map((g) => g.id);
        const { data: members } = await supabase
          .from("modality_group_members")
          .select("*, modality_entries(*)")
          .in("group_id", groupIds);

        const enriched = gList.map((g) => ({
          ...g,
          members: (members || []).filter((m) => m.group_id === g.id),
        }));
        setGroups(enriched);
      } else {
        setGroups([]);
      }
      setLoading(false);
    };
    fetch();
  }, [modalityId]);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Layers className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>Nenhum grupo definido para esta modalidade.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {groups.map((group) => (
        <div key={group.id} className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-display text-primary mb-3">
            Grupo {group.group_name}
          </h3>
          <div className="space-y-2">
            {group.members.map((gm: any) => (
              <div key={gm.id} className="flex items-center justify-between text-sm border-b border-border/50 pb-2 last:border-0">
                <span className="text-foreground">{gm.modality_entries?.name || "—"}</span>
              </div>
            ))}
            {group.members.length === 0 && (
              <p className="text-xs text-muted-foreground">Sem participantes</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TabGroups;
