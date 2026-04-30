import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";

const TenantArenaProfiles = () => {
  const { tenant } = useTenant();
  const [arenas, setArenas] = useState<any[]>([]);

  useEffect(() => {
    if (!tenant?.id) return;
    (async () => {
      const { data } = await supabase
        .from("arenas")
        .select("id, name, slug, description, modalities, is_public, cover_image_url")
        .eq("tenant_id", tenant.id)
        .order("name");
      setArenas(data || []);
    })();
  }, [tenant?.id]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display text-foreground">Perfis das arenas</h1>
        <p className="text-sm text-muted-foreground">Como cada arena da rede aparece no MoodPlay.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {arenas.map((a) => {
          const complete = !!a.description && Array.isArray(a.modalities) && a.modalities.length > 0;
          return (
            <Card key={a.id} className="bg-card border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    {complete ? <CheckCircle2 className="h-3.5 w-3.5 text-[#2BFF88]" /> : <AlertCircle className="h-3.5 w-3.5 text-amber-500" />}
                    {complete ? "Perfil completo" : "Perfil incompleto"}
                    {!a.is_public && " · Privado"}
                  </p>
                </div>
                {a.slug && (
                  <Link to={`/arenas/${a.slug}`} className="text-xs text-primary inline-flex items-center gap-1">
                    Ver <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </CardContent>
            </Card>
          );
        })}
        {arenas.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center col-span-full">Nenhuma arena cadastrada nesta rede.</p>}
      </div>
    </div>
  );
};

export default TenantArenaProfiles;
