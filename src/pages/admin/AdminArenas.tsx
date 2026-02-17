import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { MapPin } from "lucide-react";

const AdminArenas = () => {
  const [arenas, setArenas] = useState<any[]>([]);

  const fetchArenas = async () => {
    const { data } = await supabase.from("arenas").select("*, courts(id)").order("created_at", { ascending: false });
    setArenas(data || []);
  };

  useEffect(() => { fetchArenas(); }, []);

  const toggleActive = async (arena: any) => {
    await supabase.from("arenas").update({ is_active: !arena.is_active }).eq("id", arena.id);
    toast({ title: arena.is_active ? "Arena suspensa" : "Arena ativada" });
    fetchArenas();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display text-foreground">Arenas</h1>

      {arenas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma arena cadastrada</p>}

      <div className="space-y-3">
        {arenas.map((a) => (
          <Card key={a.id} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-foreground">{a.name}</h3>
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{a.city}, {a.state}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{a.courts?.length || 0} quadras • slug: {a.slug}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium ${a.is_active ? "text-primary" : "text-destructive"}`}>
                    {a.is_active ? "Ativa" : "Suspensa"}
                  </span>
                  <Switch checked={a.is_active} onCheckedChange={() => toggleActive(a)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminArenas;
