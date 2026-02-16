import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MemberProfile {
  memberId: string;
  userId: string;
  fullName: string;
  firstName: string;
  avatarUrl: string | null;
}

export interface EntryWithMembers {
  entryId: string;
  entryName: string;
  members: MemberProfile[];
}

/**
 * Given an array of entry IDs, fetches all members + their profiles.
 * Returns a map: entryId -> EntryWithMembers
 */
export const useEntryMembers = (entryIds: string[]) => {
  const [data, setData] = useState<Record<string, EntryWithMembers>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (entryIds.length === 0) {
      setData({});
      return;
    }

    const uniqueIds = [...new Set(entryIds.filter(Boolean))];
    if (uniqueIds.length === 0) return;

    const fetch = async () => {
      setLoading(true);

      // Fetch entries
      const { data: entriesData } = await supabase
        .from("modality_entries")
        .select("id, name")
        .in("id", uniqueIds);

      // Fetch members
      const { data: membersData } = await supabase
        .from("modality_entry_members")
        .select("id, entry_id, user_id")
        .in("entry_id", uniqueIds);

      const userIds = [...new Set((membersData || []).map((m) => m.user_id))];

      let profilesMap: Record<string, { full_name: string; avatar_url: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", userIds);
        (profiles || []).forEach((p) => {
          profilesMap[p.user_id] = { full_name: p.full_name, avatar_url: p.avatar_url };
        });
      }

      const result: Record<string, EntryWithMembers> = {};
      (entriesData || []).forEach((entry) => {
        const members = (membersData || [])
          .filter((m) => m.entry_id === entry.id)
          .map((m) => {
            const p = profilesMap[m.user_id];
            const fullName = p?.full_name || "Atleta";
            return {
              memberId: m.id,
              userId: m.user_id,
              fullName,
              firstName: fullName.split(" ")[0],
              avatarUrl: p?.avatar_url || null,
            };
          });

        result[entry.id] = {
          entryId: entry.id,
          entryName: entry.name,
          members,
        };
      });

      setData(result);
      setLoading(false);
    };

    fetch();
  }, [entryIds.join(",")]);

  return { entryMembers: data, membersLoading: loading };
};
