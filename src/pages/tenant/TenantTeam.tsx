import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";

const TenantTeam = () => {
  const { tenant } = useTenant();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    if (!tenant?.id) return;
    (async () => {
      const { data: arenas } = await supabase.from("arenas").select("id, name").eq("tenant_id", tenant.id);
      const ids = (arenas || []).map((a) => a.id);
      if (!ids.length) return;
      const { data: staff } = await (supabase as any)
        .from("arena_staff")
        .select("arena_id, is_active")
        .in("arena_id", ids);
      const map = new Map<string, { name: string; active: number; total: number }>();
      (arenas || []).forEach((a) => map.set(a.id, { name: a.name, active: 0, total: 0 }));
      (staff || []).forEach((s: any) => {
        const e = map.get(s.arena_id);
        if (!e) return;
        e.total++;
        if (s.is_active) e.active++;
      });
      setRows(Array.from(map, ([id, v]) => ({ id, ...v })));
    })();
  }, [tenant?.id]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display text-foreground">Equipe — visão da rede</h1>
        <p className="text-sm text-muted-foreground">Quem opera cada arena da rede.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rows.map((r) => (
          <Card key={r.id} className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="h-6 w-6 text-primary" />
              <div className="flex-1">
                <p className="font-semibold">{r.name}</p>
                <p className="text-xs text-muted-foreground">{r.active} ativo{r.active !== 1 ? "s" : ""} · {r.total} total</p>
              </div>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center col-span-full">Nenhuma arena na rede.</p>}
      </div>
    </div>
  );
};

export default TenantTeam;
