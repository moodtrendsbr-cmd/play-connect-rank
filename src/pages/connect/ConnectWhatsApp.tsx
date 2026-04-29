import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * Generic /connect-whatsapp dispatcher — sends the user to the appropriate
 * scoped connect page based on their role and owned entity.
 */
const ConnectWhatsApp = () => {
  const { user, userRole, loading } = useAuth();
  const [target, setTarget] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setTarget("/login");
      setResolving(false);
      return;
    }
    (async () => {
      // priority: tenant_admin → arena → company → organizer
      const { data: ta } = await supabase
        .from("tenant_memberships")
        .select("tenant_id")
        .eq("user_id", user.id)
        .in("role", ["admin", "owner"])
        .limit(1)
        .maybeSingle();
      if ((ta as any)?.tenant_id) { setTarget("/tenant/connect-whatsapp"); setResolving(false); return; }

      const { data: arena } = await supabase
        .from("arenas")
        .select("id")
        .eq("owner_user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (arena?.id) { setTarget("/arena/connect-whatsapp"); setResolving(false); return; }

      const { data: company } = await supabase
        .from("companies")
        .select("id")
        .eq("owner_user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (company?.id) { setTarget("/company/connect-whatsapp"); setResolving(false); return; }

      if (userRole === "organizer") {
        setTarget("/organizer/connect-whatsapp");
        setResolving(false);
        return;
      }

      setTarget("/");
      setResolving(false);
    })();
  }, [user, userRole, loading]);

  if (loading || resolving) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050708]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!target) return null;
  return <Navigate to={target} replace />;
};

export default ConnectWhatsApp;
