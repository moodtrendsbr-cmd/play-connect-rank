import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useEntryMembers } from "@/hooks/useEntryMembers";
import AthleteAvatar from "./AthleteAvatar";

interface TabEntriesProps {
  modalityId: string;
  tournamentId: string;
  isOrganizer: boolean;
}

const Pill = ({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "primary" | "warning" }) => {
  const map = {
    muted: "bg-muted text-muted-foreground border-border",
    primary: "bg-primary/15 text-primary border-primary/30",
    warning: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${map[tone]}`}>
      {children}
    </span>
  );
};

const TabEntries = ({ modalityId, tournamentId }: TabEntriesProps) => {
  const [entries, setEntries] = useState<any[]>([]);
  const [groupMap, setGroupMap] = useState<Record<string, string>>({});
  const [statusMap, setStatusMap] = useState<Record<string, "paid" | "pending">>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data: entriesData } = await supabase
        .from("modality_entries")
        .select("*")
        .eq("modality_id", modalityId)
        .order("created_at");

      const list = entriesData || [];
      setEntries(list);

      if (list.length > 0) {
        const ids = list.map((e) => e.id);

        // Group assignments
        const { data: gms } = await supabase
          .from("modality_group_members")
          .select("entry_id, modality_groups(group_name)")
          .in("entry_id", ids);
        const gMap: Record<string, string> = {};
        (gms || []).forEach((gm: any) => {
          if (gm.modality_groups?.group_name) gMap[gm.entry_id] = gm.modality_groups.group_name;
        });
        setGroupMap(gMap);

        // Enrollment status via members → enrollments
        const { data: members } = await supabase
          .from("modality_entry_members")
          .select("entry_id, user_id")
          .in("entry_id", ids);

        const userIds = [...new Set((members || []).map((m) => m.user_id))];
        const sMap: Record<string, "paid" | "pending"> = {};
        if (userIds.length > 0) {
          const { data: enrolls } = await supabase
            .from("enrollments")
            .select("user_id, status")
            .eq("tournament_id", tournamentId)
            .in("user_id", userIds);

          const userStatus: Record<string, string> = {};
          (enrolls || []).forEach((e: any) => {
            userStatus[e.user_id] = e.status;
          });
          (members || []).forEach((m: any) => {
            const s = userStatus[m.user_id];
            if (!sMap[m.entry_id] || sMap[m.entry_id] === "pending") {
              sMap[m.entry_id] = s === "paid" ? "paid" : "pending";
            }
          });
        }
        setStatusMap(sMap);
      }

      setLoading(false);
    };
    fetch();
  }, [modalityId, tournamentId]);

  const entryIds = useMemo(() => entries.map((e) => e.id), [entries]);
  const { entryMembers, membersLoading } = useEntryMembers(entryIds);

  if (loading || membersLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>Nenhum inscrito ainda.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">
        {entries.length} {entries.length === 1 ? "equipe inscrita" : "equipes inscritas"}
      </p>
      <div className="space-y-2">
        {entries.map((entry, idx) => {
          const em = entryMembers[entry.id];
          const members = em?.members || [];
          const group = groupMap[entry.id];
          const status = statusMap[entry.id];

          return (
            <div
              key={entry.id}
              className="rounded-xl border border-border bg-card p-3 flex items-center gap-3"
            >
              <span className="w-6 text-center text-sm font-display text-muted-foreground shrink-0">
                {idx + 1}
              </span>

              <div className="flex-1 min-w-0">
                {members.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {members.map((m) => (
                      <AthleteAvatar key={m.memberId} member={m} showFullName size="h-7 w-7" />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-foreground">{entry.name || "—"}</p>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {group && <Pill>Grupo {group}</Pill>}
                {status === "paid" ? (
                  <Pill tone="primary">Confirmado</Pill>
                ) : (
                  <Pill tone="warning">Pendente</Pill>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TabEntries;
