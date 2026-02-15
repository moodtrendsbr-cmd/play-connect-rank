import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Plus } from "lucide-react";
import ClipViewer from "./ClipViewer";
import CreateClipDialog from "./CreateClipDialog";

interface ClipGroup {
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  clips: { id: string; media_url: string; caption: string | null; created_at: string; expires_at: string }[];
}

const ClipsBar = () => {
  const { user } = useAuth();
  const [groups, setGroups] = useState<ClipGroup[]>([]);
  const [viewingGroup, setViewingGroup] = useState<ClipGroup | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchClips = async () => {
    const { data: clips } = await supabase
      .from("clips")
      .select("*")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (!clips || clips.length === 0) { setGroups([]); return; }

    const authorIds = [...new Set(clips.map((c: any) => c.author_id))];
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", authorIds);
    const profileMap: Record<string, any> = {};
    (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p; });

    const groupMap: Record<string, ClipGroup> = {};
    clips.forEach((c: any) => {
      if (!groupMap[c.author_id]) {
        const prof = profileMap[c.author_id];
        groupMap[c.author_id] = {
          author_id: c.author_id,
          author_name: prof?.full_name || "Atleta",
          author_avatar: prof?.avatar_url || null,
          clips: [],
        };
      }
      groupMap[c.author_id].clips.push({ id: c.id, media_url: c.media_url, caption: c.caption, created_at: c.created_at, expires_at: c.expires_at });
    });

    // Put current user first
    const sorted = Object.values(groupMap);
    if (user) {
      const myIdx = sorted.findIndex((g) => g.author_id === user.id);
      if (myIdx > 0) { const [mine] = sorted.splice(myIdx, 1); sorted.unshift(mine); }
    }
    setGroups(sorted);
  };

  useEffect(() => { fetchClips(); }, [user]);

  const getInitials = (name: string) => name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <>
      <div className="flex gap-3 overflow-x-auto py-3 px-1 scrollbar-hide">
        {/* Add clip button */}
        {user && (
          <button onClick={() => setShowCreate(true)} className="shrink-0 flex flex-col items-center gap-1">
            <div
              className="h-16 w-16 rounded-full flex items-center justify-center border-2 border-dashed"
              style={{ borderColor: "rgba(43,255,136,0.4)", background: "rgba(43,255,136,0.05)" }}
            >
              <Plus className="h-6 w-6" style={{ color: "#2BFF88" }} />
            </div>
            <span className="text-[10px]" style={{ color: "#9CA3AF" }}>Seu clip</span>
          </button>
        )}

        {groups.map((group) => (
          <button key={group.author_id} onClick={() => setViewingGroup(group)} className="shrink-0 flex flex-col items-center gap-1">
            <div
              className="h-16 w-16 rounded-full p-[2px]"
              style={{
                background: "linear-gradient(135deg, #2BFF88, #00D4AA, #2BFF88)",
                animation: "pulse 2s ease-in-out infinite",
              }}
            >
              <div className="h-full w-full rounded-full overflow-hidden" style={{ background: "#050708" }}>
                {group.author_avatar ? (
                  <img src={group.author_avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-xs font-bold" style={{ color: "#2BFF88" }}>
                    {getInitials(group.author_name)}
                  </div>
                )}
              </div>
            </div>
            <span className="text-[10px] max-w-[64px] truncate" style={{ color: "#9CA3AF" }}>
              {group.author_id === user?.id ? "Você" : group.author_name.split(" ")[0]}
            </span>
          </button>
        ))}
      </div>

      {viewingGroup && (
        <ClipViewer group={viewingGroup} onClose={() => setViewingGroup(null)} />
      )}

      <CreateClipDialog open={showCreate} onOpenChange={setShowCreate} onCreated={fetchClips} />
    </>
  );
};

export default ClipsBar;
