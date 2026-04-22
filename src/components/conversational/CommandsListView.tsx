import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CommandStatusBadge } from "@/components/conversational/CommandStatusBadge";
import { MessageCircle, QrCode, MousePointerClick, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  scope: "user" | "arena" | "tenant" | "global";
  scopeId?: string | null;
  title?: string;
}

interface Cmd {
  id: string;
  channel: string;
  profile_type: string;
  input_text: string;
  response_text: string | null;
  status: string;
  created_at: string;
  proposal_ids: string[] | null;
}

const channelIcon = (c: string) => {
  if (c === "qr") return <QrCode className="h-3.5 w-3.5" />;
  if (c === "dashboard_cta") return <MousePointerClick className="h-3.5 w-3.5" />;
  return <MessageCircle className="h-3.5 w-3.5" />;
};

export const CommandsListView = ({ scope, scopeId, title = "Comandos" }: Props) => {
  const { user } = useAuth();
  const [items, setItems] = useState<Cmd[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("conversational_commands")
      .select("id,channel,profile_type,input_text,response_text,status,created_at,proposal_ids")
      .order("created_at", { ascending: false })
      .limit(200);

    if (scope === "user" && (scopeId || user?.id)) q = q.eq("user_id", scopeId || user!.id);
    if (scope === "arena" && scopeId) q = q.eq("arena_id", scopeId);
    if (scope === "tenant" && scopeId) q = q.eq("tenant_id", scopeId);
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    if (channelFilter !== "all") q = q.eq("channel", channelFilter);

    const { data } = await q;
    let rows = (data as Cmd[]) || [];
    if (query.trim()) {
      const t = query.trim().toLowerCase();
      rows = rows.filter(r => r.input_text.toLowerCase().includes(t) || r.response_text?.toLowerCase().includes(t));
    }
    setItems(rows);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`cc-list-${scope}-${scopeId || "g"}`)
      .on("postgres_changes",
          { event: "*", schema: "public", table: "conversational_commands" },
          () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, scopeId, statusFilter, channelFilter]);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">
          Histórico completo de comandos enviados via WhatsApp, QR e CTAs do painel.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Buscar texto…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && load()}
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="dispatched">Sugerido</SelectItem>
              <SelectItem value="executed">Executado</SelectItem>
              <SelectItem value="failed">Falhou</SelectItem>
              <SelectItem value="no_action">Sem ação</SelectItem>
              <SelectItem value="rate_limited">Limitado</SelectItem>
              <SelectItem value="identity_required">Sem WhatsApp</SelectItem>
            </SelectContent>
          </Select>
          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger><SelectValue placeholder="Canal" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os canais</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="qr">QR</SelectItem>
              <SelectItem value="dashboard_cta">CTA do painel</SelectItem>
              <SelectItem value="api">API</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 divide-y divide-border">
          {loading && <p className="p-4 text-sm text-muted-foreground">Carregando…</p>}
          {!loading && items.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">Nenhum comando encontrado.</p>
          )}
          {items.map(c => (
            <div key={c.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    {channelIcon(c.channel)}
                    <span className="uppercase tracking-wide">{c.channel === "dashboard_cta" ? "CTA" : c.channel}</span>
                  </span>
                  <span>·</span>
                  <span>{c.profile_type}</span>
                  <span>·</span>
                  <span>{formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}</span>
                </div>
                <CommandStatusBadge status={c.status} />
              </div>
              <p className="text-sm font-medium text-foreground">{c.input_text}</p>
              {c.response_text && (
                <p className="text-sm text-muted-foreground">{c.response_text}</p>
              )}
              {c.proposal_ids && c.proposal_ids.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {c.proposal_ids.length} proposta(s) ORKYM gerada(s)
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
