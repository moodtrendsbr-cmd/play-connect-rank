import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Layers } from "lucide-react";
import { useEntryMembers } from "@/hooks/useEntryMembers";
import AthleteAvatar from "./AthleteAvatar";

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

  // Collect all entry IDs from group members
  const allEntryIds = useMemo(() => {
    const ids: string[] = [];
    groups.forEach((g) => {
      g.members?.forEach((m: any) => {
        if (m.entry_id) ids.push(m.entry_id);
      });
    });
    return [...new Set(ids)];
  }, [groups]);

  const { entryMembers, membersLoading } = useEntryMembers(allEntryIds);

  if (loading || membersLoading) {
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
          <div className="space-y-3">
            {group.members.map((gm: any) => {
              const em = entryMembers[gm.entry_id];
              const members = em?.members || [];

              return (
                <div key={gm.id} className="border-b border-border/50 pb-2 last:border-0">
                  {members.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {members.map((m) => (
                        <AthleteAvatar key={m.memberId} member={m} showFullName={false} size="h-7 w-7" />
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-foreground">{gm.modality_entries?.name || "—"}</span>
                  )}
                </div>
              );
            })}
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
