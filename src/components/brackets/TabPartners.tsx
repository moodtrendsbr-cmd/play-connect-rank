import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { Handshake } from "lucide-react";

interface TabPartnersProps {
  tournamentId: string;
}

const TabPartners = ({ tournamentId }: TabPartnersProps) => {
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data: partnerData } = await supabase
        .from("tournament_partners")
        .select("*, companies(id, name, logo_url)")
        .eq("tournament_id", tournamentId)
        .order("position_order");

      setPartners(partnerData || []);
      setLoading(false);
    };
    fetch();
  }, [tournamentId]);

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-40 rounded-xl shrink-0" />
        ))}
      </div>
    );
  }

  if (partners.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Handshake className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>Nenhum parceiro cadastrado.</p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {partners.map((p) => {
        const company = p.companies;
        return (
          <Link
            key={p.id}
            to={`/marketplace/company/${company?.id}`}
            className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 min-w-[140px] shrink-0 hover:border-primary/30 transition-colors"
          >
            {company?.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
                {(company?.name || "?")[0]}
              </div>
            )}
            <span className="text-xs text-foreground text-center truncate max-w-full">
              {company?.name || "Parceiro"}
            </span>
          </Link>
        );
      })}
    </div>
  );
};

export default TabPartners;
