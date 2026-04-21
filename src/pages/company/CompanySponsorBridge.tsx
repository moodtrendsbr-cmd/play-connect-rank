import { useEffect, useState } from "react";
import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * Bridge: provides `company` via Outlet context so legacy Sponsor screens
 * (SponsorDashboard, SponsorTournaments) can be reused inside CompanyShell.
 */
const CompanySponsorBridge = () => {
  const { user } = useAuth();
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from("companies")
        .select("*")
        .eq("owner_user_id", user.id)
        .maybeSingle();
      setCompany(data);
      setLoading(false);
    })();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!company) return <Navigate to="/marketplace/register" replace />;

  return <Outlet context={{ company }} />;
};

export default CompanySponsorBridge;
