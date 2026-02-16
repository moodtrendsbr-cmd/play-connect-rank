import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useEntryMembers } from "@/hooks/useEntryMembers";
import AthleteAvatar from "./AthleteAvatar";

interface TabEntriesProps {
  modalityId: string;
  isOrganizer: boolean;
}

const TabEntries = ({ modalityId }: TabEntriesProps) => {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data: entriesData } = await supabase
        .from("modality_entries")
        .select("*")
        .eq("modality_id", modalityId);
      setEntries(entriesData || []);
      setLoading(false);
    };
    fetch();
  }, [modalityId]);

  const entryIds = useMemo(() => entries.map((e) => e.id), [entries]);
  const { entryMembers, membersLoading } = useEntryMembers(entryIds);

  if (loading || membersLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
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
      <p className="text-sm text-muted-foreground mb-4">
        {entries.length} {entries.length === 1 ? "inscrito" : "inscritos"}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => {
          const em = entryMembers[entry.id];
          const members = em?.members || [];

          return (
            <div
              key={entry.id}
              className="rounded-xl border border-border bg-card p-4"
            >
              {members.length > 0 ? (
                <div className="space-y-2">
                  {members.map((m) => (
                    <AthleteAvatar key={m.memberId} member={m} showFullName size="h-9 w-9" />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-foreground">{entry.name || "—"}</p>
              )}
              {entry.seed && (
                <span className="text-xs text-muted-foreground mt-2 block">Seed #{entry.seed}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TabEntries;
