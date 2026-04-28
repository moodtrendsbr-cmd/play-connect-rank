import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface Lead {
  id: string;
  wa_phone: string;
  status: string;
  message_count: number;
  last_inbound_text: string | null;
  last_seen_at: string;
  tenant_hint: string | null;
  arena_hint: string | null;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  new: "secondary", engaged: "default", converted: "outline", blocked: "destructive",
};

export default function AdminWhatsAppLeads() {
  const [items, setItems] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("wa_leads")
        .select("id, wa_phone, status, message_count, last_inbound_text, last_seen_at, tenant_hint, arena_hint")
        .order("last_seen_at", { ascending: false })
        .limit(200);
      setItems((data ?? []) as Lead[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Leads de WhatsApp</h1>
        <p className="text-muted-foreground">Visitantes desconhecidos que falaram com a ORKYM mas ainda não vincularam conta.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Últimos 200 leads</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Loader2 className="animate-spin" /> : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum lead registrado.</p>
          ) : (
            <div className="space-y-2">
              {items.map((l) => (
                <div key={l.id} className="border rounded-lg p-3 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">+{l.wa_phone}</span>
                      <Badge variant={STATUS_VARIANT[l.status] ?? "secondary"}>{l.status}</Badge>
                      <span className="text-xs text-muted-foreground">{l.message_count} msg</span>
                    </div>
                    {l.last_inbound_text && (
                      <p className="text-sm text-muted-foreground line-clamp-2">"{l.last_inbound_text}"</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(l.last_seen_at).toLocaleString("pt-BR")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
