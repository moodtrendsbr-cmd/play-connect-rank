import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Gift, Phone, MapPin, Calendar, MessageSquare, Truck } from "lucide-react";

const STATUSES = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendente" },
  { value: "contact_needed", label: "Contatar" },
  { value: "in_transit", label: "Em trânsito" },
  { value: "delivered", label: "Entregue" },
  { value: "closed", label: "Fechado" },
];

const statusColor = (s: string) => {
  switch (s) {
    case "pending": return "bg-yellow-500/20 text-yellow-400";
    case "contact_needed": return "bg-orange-500/20 text-orange-400";
    case "in_transit": return "bg-blue-500/20 text-blue-400";
    case "delivered": return "bg-green-500/20 text-green-400";
    case "closed": return "bg-muted text-muted-foreground";
    default: return "bg-muted text-muted-foreground";
  }
};

const AdminGifts = () => {
  const [gifts, setGifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});

  const fetchGifts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("sponsorship_giveaways")
      .select("*, tournament_sponsorships(tournament_id, company_id, tournaments(name, city), companies(name))")
      .order("created_at", { ascending: false });
    setGifts(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchGifts(); }, []);

  const filtered = tab === "all" ? gifts : gifts.filter((g) => g.status === tab);

  const updateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from("sponsorship_giveaways")
      .update({ status: newStatus } as any)
      .eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Status → ${newStatus}` });
      fetchGifts();
    }
  };

  const saveNote = async (id: string) => {
    const note = noteMap[id];
    if (!note?.trim()) return;
    const existing = gifts.find((g) => g.id === id);
    const prev = existing?.admin_notes || "";
    const updated = prev ? `${prev}\n---\n[${new Date().toLocaleDateString("pt-BR")}] ${note}` : `[${new Date().toLocaleDateString("pt-BR")}] ${note}`;
    const { error } = await supabase
      .from("sponsorship_giveaways")
      .update({ admin_notes: updated } as any)
      .eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Nota salva" });
      setNoteMap((prev) => ({ ...prev, [id]: "" }));
      fetchGifts();
    }
  };

  return (
    <div>
      <h1 className="text-4xl font-display text-foreground mb-6">BRINDES</h1>

      <Tabs value={tab} onValueChange={setTab} className="mb-6">
        <TabsList className="flex-wrap">
          {STATUSES.map((s) => (
            <TabsTrigger key={s.value} value={s.value} className="text-xs">
              {s.label}
              {s.value !== "all" && (
                <span className="ml-1 text-muted-foreground">
                  ({gifts.filter((g) => g.status === s.value).length})
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">Nenhum brinde encontrado.</p>
      ) : (
        <div className="space-y-4">
          {filtered.map((g) => {
            const sp = g.tournament_sponsorships;
            return (
              <Card key={g.id}>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Gift className="h-4 w-4 text-primary shrink-0" />
                        <span className="font-bold text-foreground text-sm">{g.item_type}</span>
                        <Badge className={`text-xs ${statusColor(g.status)}`}>{g.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {sp?.companies?.name} → {sp?.tournaments?.name} ({sp?.tournaments?.city})
                      </p>
                    </div>
                    <Select value={g.status} onValueChange={(v) => updateStatus(g.id, v)}>
                      <SelectTrigger className="w-[140px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.filter((s) => s.value !== "all").map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                    <span>Qtd: <strong className="text-foreground">{g.quantity}</strong></span>
                    {g.delivery_deadline && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {new Date(g.delivery_deadline).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                    {g.needs_refrigeration && <span>❄️ Refrigeração</span>}
                    {g.rules && <span>📋 {g.rules}</span>}
                  </div>

                  {(g.contact_name || g.contact_whatsapp || g.contact_email) && (
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3 mt-0.5" />
                      {g.contact_name && <span>{g.contact_name}</span>}
                      {g.contact_whatsapp && <span>{g.contact_whatsapp}</span>}
                      {g.contact_email && <span>{g.contact_email}</span>}
                    </div>
                  )}

                  {(g.pickup_address || g.delivery_address) && (
                    <div className="text-xs text-muted-foreground space-y-1">
                      {g.pickup_address && (
                        <p className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Retirada: {g.pickup_address}</p>
                      )}
                      {g.delivery_address && (
                        <p className="flex items-center gap-1"><Truck className="h-3 w-3" /> Entrega: {g.delivery_address}</p>
                      )}
                    </div>
                  )}

                  {g.admin_notes && (
                    <div className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground whitespace-pre-line">
                      <MessageSquare className="h-3 w-3 inline mr-1" />
                      {g.admin_notes}
                    </div>
                  )}

                  <div className="flex gap-2 items-end">
                    <Textarea
                      placeholder="Adicionar nota interna..."
                      value={noteMap[g.id] || ""}
                      onChange={(e) => setNoteMap((prev) => ({ ...prev, [g.id]: e.target.value }))}
                      className="min-h-[60px] text-xs flex-1"
                    />
                    <Button size="sm" variant="outline" onClick={() => saveNote(g.id)}>Salvar</Button>
                  </div>

                  <div className="flex gap-2">
                    {g.status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus(g.id, "contact_needed")}>
                        Marcar como contatado
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminGifts;
