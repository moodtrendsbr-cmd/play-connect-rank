import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface FollowListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  type: "followers" | "following";
  currentUserId: string | undefined;
}

interface FollowUser {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  isFollowing: boolean;
}

const getInitials = (name: string) =>
  name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

const FollowListDialog = ({ open, onOpenChange, userId, type, currentUserId }: FollowListDialogProps) => {
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    const fetchList = async () => {
      setLoading(true);
      let targetIds: string[] = [];

      if (type === "followers") {
        const { data } = await supabase.from("follows").select("follower_id").eq("following_id", userId);
        targetIds = (data || []).map((f: any) => f.follower_id);
      } else {
        const { data } = await supabase.from("follows").select("following_id").eq("follower_id", userId);
        targetIds = (data || []).map((f: any) => f.following_id);
      }

      if (targetIds.length === 0) { setUsers([]); setLoading(false); return; }

      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", targetIds);

      // Check which ones the current user follows
      let myFollowingSet = new Set<string>();
      if (currentUserId) {
        const { data: myFollows } = await supabase.from("follows").select("following_id").eq("follower_id", currentUserId).in("following_id", targetIds);
        myFollowingSet = new Set((myFollows || []).map((f: any) => f.following_id));
      }

      setUsers(
        (profiles || []).map((p) => ({
          user_id: p.user_id,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          isFollowing: myFollowingSet.has(p.user_id),
        }))
      );
      setLoading(false);
    };
    fetchList();
  }, [open, userId, type, currentUserId]);

  const toggleFollow = async (targetId: string) => {
    if (!currentUserId) return;
    const u = users.find((u) => u.user_id === targetId);
    if (!u) return;

    setUsers((prev) => prev.map((x) => x.user_id === targetId ? { ...x, isFollowing: !x.isFollowing } : x));

    if (u.isFollowing) {
      await supabase.from("follows").delete().eq("follower_id", currentUserId).eq("following_id", targetId);
    } else {
      await supabase.from("follows").insert({ follower_id: currentUserId, following_id: targetId });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-0" style={{ background: "#0B0F12", color: "white" }}>
        <DialogHeader>
          <DialogTitle style={{ color: "#2BFF88" }}>
            {type === "followers" ? "Seguidores" : "Seguindo"}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto space-y-2">
          {loading ? (
            <p className="text-center py-4 text-sm" style={{ color: "#9CA3AF" }}>Carregando...</p>
          ) : users.length === 0 ? (
            <p className="text-center py-4 text-sm" style={{ color: "#9CA3AF" }}>Nenhum usuário</p>
          ) : (
            users.map((u) => (
              <div key={u.user_id} className="flex items-center justify-between py-2 px-2 rounded-lg" style={{ background: "rgba(43,255,136,0.03)" }}>
                <Link to={`/profile/${u.user_id}`} className="flex items-center gap-3 flex-1" onClick={() => onOpenChange(false)}>
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "rgba(43,255,136,0.15)", color: "#2BFF88" }}>
                      {getInitials(u.full_name)}
                    </div>
                  )}
                  <span className="text-sm text-white font-medium">{u.full_name}</span>
                </Link>
                {currentUserId && u.user_id !== currentUserId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleFollow(u.user_id)}
                    className="text-xs h-7 px-3"
                    style={u.isFollowing ? { color: "#9CA3AF" } : { color: "#2BFF88" }}
                  >
                    {u.isFollowing ? "Seguindo" : "Seguir"}
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FollowListDialog;
