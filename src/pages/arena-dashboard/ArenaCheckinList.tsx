import { useEffect, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCcw, Download, UserCheck } from "lucide-react";

type Checkin = {
  id: string;
  display_name: string | null;
  phone_e164: string | null;
  sport: string | null;
  source: string;
  booking_id: string | null;
  created_at: string;
};

const ArenaCheckinList = () => {
  const { arena } = useOutletContext<{ arena: any }>();
  const [items, setItems] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = async () => {
    if (!arena?.id) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("arena_checkins")
      .select("id, display_name, phone_e164, sport, source, booking_id, created_at")
      .eq("arena_id", arena.id)
      .gte("created_at", today.toISOString())
      .order("created_at", { ascending: false });
    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!arena?.id) return;
    fetchItems();
    const channel = supabase
      .channel(`arena-checkins-${arena.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "arena_checkins", filter: `arena_id=eq.${arena.id}` },
        () => fetchItems())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [arena?.id]);

  const exportCSV = () => {
    const rows = [
      ["nome", "whatsapp", "esporte", "origem", "horario"].join(","),
      ...items.map((i) => [
        (i.display_name || "").replace(/,/g, " "),
        i.phone_e164 || "",
        i.sport || "",
        i.source,
        new Date(i.created_at).toLocaleString("pt-BR"),
      ].join(",")),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `entradas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Link to="/arena/dashboard" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar ao painel
      </Link>

      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display text-foreground">Entradas de hoje</h1>
          <p className="text-sm text-muted-foreground">Quem entrou na arena via QR ou link de reserva. Atualiza em tempo real.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={fetchItems}><RefreshCcw className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={exportCSV} disabled={!items.length}><Download className="h-4 w-4 mr-1" /> CSV</Button>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0 divide-y divide-border">
          {loading && <div className="p-6 text-sm text-muted-foreground text-center">Carregando…</div>}
          {!loading && items.length === 0 && (
            <div className="p-8 text-center space-y-2">
              <UserCheck className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">Nenhuma entrada registrada hoje.</p>
              <p className="text-xs text-muted-foreground">Imprima o QR de check-in e cole na recepção.</p>
            </div>
          )}
          {items.map((i) => (
            <div key={i.id} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-foreground truncate">{i.display_name || "Visitante"}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {i.phone_e164 || "—"} · {i.sport || "—"}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {i.booking_id && <Badge variant="secondary">Reserva</Badge>}
                {i.source === "qr" && <Badge variant="outline">QR</Badge>}
                <span className="text-xs text-muted-foreground tabular-nums">
                  {new Date(i.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default ArenaCheckinList;
