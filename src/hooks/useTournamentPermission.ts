import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface TournamentPermission {
  canView: boolean;
  canManage: boolean;
  loading: boolean;
  reason?: string;
}

export const useTournamentPermission = (tournamentId?: string | null): TournamentPermission => {
  const { user, userRole, loading: authLoading } = useAuth();
  const [state, setState] = useState<TournamentPermission>({
    canView: false,
    canManage: false,
    loading: true,
  });

  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (authLoading) return;
      if (!tournamentId) {
        if (alive) setState({ canView: false, canManage: false, loading: false });
        return;
      }

      const { data: t } = await supabase
        .from("tournaments")
        .select("organizer_id, arena_id, tenant_id, is_public")
        .eq("id", tournamentId)
        .maybeSingle();

      if (!t) {
        if (alive) setState({ canView: false, canManage: false, loading: false, reason: "not_found" });
        return;
      }

      const canView = !!t.is_public || !!user;

      if (!user) {
        if (alive) setState({ canView, canManage: false, loading: false });
        return;
      }

      // Admin
      if (userRole === "admin") {
        if (alive) setState({ canView: true, canManage: true, loading: false });
        return;
      }

      // Organizer (owner of tournament)
      if (t.organizer_id === user.id) {
        if (alive) setState({ canView: true, canManage: true, loading: false });
        return;
      }

      // Arena owner
      if (t.arena_id) {
        const { data: arena } = await supabase
          .from("arenas")
          .select("id")
          .eq("id", t.arena_id)
          .eq("owner_user_id", user.id)
          .maybeSingle();
        if (arena) {
          if (alive) setState({ canView: true, canManage: true, loading: false });
          return;
        }
      }

      // Tenant admin/owner
      if (t.tenant_id) {
        const { data: tm } = await supabase
          .from("tenant_memberships")
          .select("role")
          .eq("tenant_id", t.tenant_id)
          .eq("user_id", user.id)
          .in("role", ["owner", "admin"])
          .maybeSingle();
        if (tm) {
          if (alive) setState({ canView: true, canManage: true, loading: false });
          return;
        }
      }

      if (alive) setState({ canView, canManage: false, loading: false });
    };
    run();
    return () => { alive = false; };
  }, [tournamentId, user?.id, userRole, authLoading]);

  return state;
};
