import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, ArrowRight, RefreshCw, QrCode, MousePointerClick, ArrowDownLeft, ArrowUpRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommandStatusBadge } from "./CommandStatusBadge";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  scope: "user" | "arena" | "tenant" | "global";
  scopeId?: string | null;
  seeAllHref?: string;
  limit?: number;
  title?: string;
}

interface Command {
  id: string;
  channel: string;
  input_text: string;
  status: string;
  response_text: string | null;
  created_at: string;
  direction: string | null;
  initiated_by: string | null;
  whatsapp_instance_id: string | null;
}

const channelIcon = (c: string) => {
  if (c === "qr") return <QrCode className="h-3 w-3" />;
  if (c === "dashboard_cta") return <MousePointerClick className="h-3 w-3" />;
  if (c === "api") return <Sparkles className="h-3 w-3" />;
  return <MessageCircle className="h-3 w-3" />;
};

export const CommandHistoryCard = ({
  scope,
  scopeId,
  seeAllHref,
  limit = 5,
  title = "Últimos comandos",
}: Props) => {
  const [items, setItems] = useState<Command[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("conversational_commands")
      .select("id,channel,input_text,status,response_text,created_at,direction,initiated_by,whatsapp_instance_id")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (scope === "user" && scopeId) q = q.eq("user_id", scopeId);
    if (scope === "arena" && scopeId) q = q.eq("arena_id", scopeId);
    if (scope === "tenant" && scopeId) q = q.eq("tenant_id", scopeId);

    const { data } = await q;
    setItems((data as Command[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!scopeId && scope !== "global") return;
    const channelName = `cc-${scope}-${scopeId || "all"}`;
    const ch = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversational_commands" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, scopeId]);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-emerald-600" />
          {title}
          {items.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 text-xs">{items.length}</Badge>
          )}
        </CardTitle>
        <Button size="icon" variant="ghost" onClick={load} disabled={loading} className="h-8 w-8">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {!loading && items.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum comando ainda. Use o WhatsApp ou um QR para começar.</p>
        )}
        {items.map((c) => (
          <div key={c.id} className="p-3 rounded-lg bg-muted/30 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground flex-wrap">
                {c.direction === "outbound" ? (
                  <Badge variant="outline" className="h-4 px-1 gap-0.5 text-[9px]">
                    <ArrowUpRight className="h-2.5 w-2.5" /> ORKYM
                  </Badge>
                ) : c.initiated_by === "orkym" ? (
                  <Badge variant="outline" className="h-4 px-1 gap-0.5 text-[9px] border-emerald-500/30 text-emerald-700">
                    <Sparkles className="h-2.5 w-2.5" /> ORKYM
                  </Badge>
                ) : (
                  <Badge variant="outline" className="h-4 px-1 gap-0.5 text-[9px]">
                    <ArrowDownLeft className="h-2.5 w-2.5" /> User
                  </Badge>
                )}
                {channelIcon(c.channel)}
                <span className="uppercase tracking-wide">{c.channel === "dashboard_cta" ? "CTA" : c.channel}</span>
                <span>·</span>
                <span>{formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}</span>
              </div>
              <CommandStatusBadge status={c.status} />
            </div>
            <p className="text-sm font-medium text-foreground line-clamp-1">{c.input_text}</p>
            {c.response_text && (
              <p className="text-xs text-muted-foreground line-clamp-2">{c.response_text}</p>
            )}
          </div>
        ))}
        {seeAllHref && items.length > 0 && (
          <Link
            to={seeAllHref}
            className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
          >
            Ver todos os comandos <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
};
