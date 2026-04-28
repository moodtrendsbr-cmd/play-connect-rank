import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowDownLeft, ArrowUpRight, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Message {
  id: string;
  direction: string;
  wa_phone: string;
  body: string | null;
  message_type: string;
  delivery_status: string;
  initiated_by: string | null;
  created_at: string;
  failure_reason: string | null;
}

interface Props {
  scope: "arena" | "tenant" | "organizer" | "company";
  scopeId?: string | null;
  title?: string;
}

const statusColor = (s: string) => {
  if (s === "delivered" || s === "read") return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
  if (s === "sent") return "bg-blue-500/15 text-blue-700 border-blue-500/30";
  if (s === "failed") return "bg-destructive/15 text-destructive border-destructive/30";
  return "bg-muted text-muted-foreground border-border";
};

export const ScopedMessages = ({ scope, scopeId, title }: Props) => {
  const [items, setItems] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState<string>("all");

  const load = async () => {
    if (!scopeId) { setItems([]); setLoading(false); return; }
    setLoading(true);
    let q = supabase
      .from("whatsapp_messages")
      .select("id,direction,wa_phone,body,message_type,delivery_status,initiated_by,created_at,failure_reason")
      .order("created_at", { ascending: false })
      .limit(100);
    if (scope === "arena") q = q.eq("arena_id", scopeId);
    else if (scope === "tenant") q = q.eq("tenant_id", scopeId);
    if (direction !== "all") q = q.eq("direction", direction);
    const { data } = await q;
    setItems((data as Message[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [scopeId, direction]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display text-glow">{title ?? "Mensagens WhatsApp"}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tráfego inbound e outbound deste {scope === "arena" ? "estabelecimento" : "escopo"}.
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Últimos 100 eventos</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={direction} onValueChange={setDirection}>
              <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="inbound">Recebidas</SelectItem>
                <SelectItem value="outbound">Enviadas</SelectItem>
              </SelectContent>
            </Select>
            <Button size="icon" variant="ghost" onClick={load} className="h-8 w-8">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma mensagem registrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Direção</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Conteúdo</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Quando</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      {m.direction === "inbound" ? (
                        <Badge variant="outline" className="gap-1">
                          <ArrowDownLeft className="h-3 w-3" /> Recebida
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <ArrowUpRight className="h-3 w-3" /> Enviada
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">+{m.wa_phone}</TableCell>
                    <TableCell className="max-w-xs">
                      <p className="text-sm truncate">{m.body || `(${m.message_type})`}</p>
                      {m.failure_reason && (
                        <p className="text-[11px] text-destructive mt-0.5">{m.failure_reason}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">{m.initiated_by || "—"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColor(m.delivery_status)}>
                        {m.delivery_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ScopedMessages;
