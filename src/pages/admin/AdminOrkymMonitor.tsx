import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, CheckCircle2, AlertTriangle, Clock, Zap } from "lucide-react";
import { format } from "date-fns";

interface CallRow {
  id: string;
  request_id: string;
  domain: string;
  action: string;
  status: string;
  http_status: number | null;
  duration_ms: number | null;
  tenant_id: string | null;
  arena_id: string | null;
  error_message: string | null;
  retried_count: number;
  created_at: string;
}

const STATUS_COLOR: Record<string, string> = {
  success:      "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  failed:       "bg-destructive/15 text-destructive border-destructive/30",
  timeout:      "bg-amber-500/15  text-amber-400  border-amber-500/30",
  degraded:     "bg-muted         text-muted-foreground border-border",
  rate_limited: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  deduped:      "bg-blue-500/15   text-blue-400   border-blue-500/30",
};

const AdminOrkymMonitor = () => {
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [domain, setDomain] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("orkym_api_calls")
      .select("id,request_id,domain,action,status,http_status,duration_ms,tenant_id,arena_id,error_message,retried_count,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (domain !== "all") q = q.eq("domain", domain);
    if (status !== "all") q = q.eq("status", status);
    const { data } = await q;
    setCalls((data || []) as CallRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [domain, status]);

  const metrics = useMemo(() => {
    const total = calls.length;
    const success = calls.filter((c) => c.status === "success").length;
    const failed = calls.filter((c) => ["failed", "timeout"].includes(c.status)).length;
    const successCalls = calls.filter((c) => c.status === "success" && c.duration_ms);
    const avgDuration = successCalls.length
      ? Math.round(successCalls.reduce((s, c) => s + (c.duration_ms || 0), 0) / successCalls.length)
      : 0;
    return { total, success, failed, avgDuration, rate: total ? Math.round((success / total) * 100) : 0 };
  }, [calls]);

  const cards = [
    { label: "Chamadas (100 últimas)", value: metrics.total, icon: Bot,           color: "text-primary" },
    { label: "Taxa de sucesso",         value: `${metrics.rate}%`, icon: CheckCircle2, color: "text-emerald-400" },
    { label: "Falhas/Timeouts",         value: metrics.failed,    icon: AlertTriangle, color: "text-destructive" },
    { label: "Latência média (ms)",     value: metrics.avgDuration, icon: Clock,      color: "text-blue-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bot className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-display text-foreground">Monitor ORKYM</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => (
          <Card key={c.label} className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <c.icon className={`h-7 w-7 ${c.color}`} />
              <div>
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="text-xl font-bold text-foreground">{c.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base font-medium">Chamadas recentes</CardTitle>
          <div className="flex gap-2">
            <Select value={domain} onValueChange={setDomain}>
              <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os domínios</SelectItem>
                <SelectItem value="arena_operations">arena_operations</SelectItem>
                <SelectItem value="finance">finance</SelectItem>
                <SelectItem value="tournaments">tournaments</SelectItem>
                <SelectItem value="growth">growth</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="success">success</SelectItem>
                <SelectItem value="failed">failed</SelectItem>
                <SelectItem value="timeout">timeout</SelectItem>
                <SelectItem value="degraded">degraded</SelectItem>
                <SelectItem value="rate_limited">rate_limited</SelectItem>
                <SelectItem value="deduped">deduped</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!loading && calls.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma chamada registrada ainda.</p>
          )}
          {calls.map((c) => (
            <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 text-xs">
              <Badge variant="outline" className={STATUS_COLOR[c.status] || ""}>{c.status}</Badge>
              <span className="font-mono text-foreground shrink-0">{c.domain}.{c.action}</span>
              <span className="text-muted-foreground">{c.duration_ms ?? "—"}ms</span>
              {c.retried_count > 0 && <span className="text-amber-400 inline-flex items-center gap-1"><Zap className="h-3 w-3" />{c.retried_count}</span>}
              {c.error_message && <span className="text-destructive truncate max-w-[280px]">{c.error_message}</span>}
              <span className="text-muted-foreground ml-auto">{format(new Date(c.created_at), "dd/MM HH:mm:ss")}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminOrkymMonitor;
