import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink } from "lucide-react";

interface Arena {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  is_active: boolean;
  mp_connected: boolean;
}

const OrganizerArenas = () => {
  const { tenant } = useTenant();
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!tenant) return;
      setLoading(true);
      const { data } = await supabase
        .from("arenas")
        .select("id, name, slug, city, state, is_active, mp_connected")
        .eq("tenant_id", tenant.id)
        .order("name");
      setArenas((data as Arena[]) ?? []);
      setLoading(false);
    })();
  }, [tenant?.id]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Arenas</h1>
        <p className="text-sm text-muted-foreground">Arenas vinculadas a este organizador</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Lista ({arenas.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : arenas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhuma arena vinculada ainda.</p>
          ) : (
            <div className="space-y-2">
              {arenas.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-md border border-border">
                  <div className="min-w-0">
                    <p className="font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.city}, {a.state}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.is_active ? <Badge variant="default">Ativa</Badge> : <Badge variant="secondary">Inativa</Badge>}
                    {a.mp_connected && <Badge variant="outline">MP</Badge>}
                    <Link to={`/arenas/${a.slug}`} className="text-muted-foreground hover:text-foreground">
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OrganizerArenas;
