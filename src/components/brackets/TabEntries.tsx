import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface TabEntriesProps {
  modalityId: string;
  isOrganizer: boolean;
}

const TabEntries = ({ modalityId }: TabEntriesProps) => {
  const [entries, setEntries] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data: entriesData } = await supabase
        .from("modality_entries")
        .select("*")
        .eq("modality_id", modalityId);

      const eList = entriesData || [];
      const entryIds = eList.map((e) => e.id);

      if (entryIds.length > 0) {
        const { data: members } = await supabase
          .from("modality_entry_members")
          .select("*")
          .in("entry_id", entryIds);

        const userIds = (members || []).map((m) => m.user_id);
        if (userIds.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("user_id, full_name, avatar_url")
            .in("user_id", userIds);
          const map: Record<string, any> = {};
          (profs || []).forEach((p) => { map[p.user_id] = p; });
          setProfiles(map);
        }

        const entriesWithMembers = eList.map((e) => ({
          ...e,
          members: (members || []).filter((m) => m.entry_id === e.id),
        }));
        setEntries(entriesWithMembers);
      } else {
        setEntries([]);
      }
      setLoading(false);
    };
    fetch();
  }, [modalityId]);

  if (loading) {
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
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex -space-x-2">
              {entry.members.map((m: any) => {
                const p = profiles[m.user_id];
                return (
                  <Avatar key={m.id} className="h-9 w-9 border-2 border-background">
                    <AvatarImage src={p?.avatar_url} />
                    <AvatarFallback className="text-xs bg-muted">
                      {(p?.full_name || "?")[0]}
                    </AvatarFallback>
                  </Avatar>
                );
              })}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {entry.name || entry.members.map((m: any) => profiles[m.user_id]?.full_name || "—").join(" / ")}
              </p>
              {entry.seed && (
                <span className="text-xs text-muted-foreground">Seed #{entry.seed}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TabEntries;
