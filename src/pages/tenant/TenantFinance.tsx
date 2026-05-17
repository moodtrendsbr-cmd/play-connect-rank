import { useEffect, useMemo, useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, ArrowUpRight, ArrowDownRight, Download, Filter } from "lucide-react";
import { EmptyState } from "@/components/tenant/EmptyState";

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const ENTRY_LABELS: Record<string, string> = {
  enrollment: "Inscrição (torneio)",
  sponsorship: "Patrocínio",
  boost: "Ativação / Boost",
  marketplace: "Produtos próprios",
  booking: "Reserva de quadra",
  featured: "Destaque",
  fee: "Taxa de plataforma",
};

const EXIT_LABELS: Record<string, string> = {
  payout: "Repasse",
  withdrawal: "Saque",
  refund: "Estorno",
  prize: "Premiação",
  gateway: "Taxa de gateway",
  marketing: "Marketing",
  operational: "Operacional",
};

export default function TenantFinance() {
  const { tenant } = useTenant();
  const [txs, setTxs] = useState<any[]>([]);
  const [arenas, setArenas] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // filtros
  const [period, setPeriod] = useState<"7" | "30" | "90" | "365">("30");
  const [arenaId, setArenaId] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  useEffect(() => {
    if (!tenant?.id) return;
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - parseInt(period) * 86400000).toISOString();
      const [tx, ar] = await Promise.all([
        supabase
          .from("financial_transactions")
          .select("id, total_amount, status, source_type, source_id, paid_at, created_at, arena_id, metadata")
          .eq("tenant_id", tenant.id)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.from("arenas").select("id, name").eq("tenant_id", tenant.id),
      ]);
      setTxs((tx.data ?? []) as any[]);
      setArenas((ar.data ?? []) as any[]);
      setLoading(false);
    })();
  }, [tenant?.id, period]);

  const filtered = useMemo(() => {
    return txs.filter((t) => {
      if (arenaId !== "all" && t.arena_id !== arenaId) return false;
      if (sourceFilter !== "all" && t.source_type !== sourceFilter) return false;
      return true;
    });
  }, [txs, arenaId, sourceFilter]);

  const entries = filtered.filter((t) => ENTRY_LABELS[t.source_type] && t.status === "paid");
  const exits = filtered.filter((t) => EXIT_LABELS[t.source_type]);

  const totalsBySource = (list: any[]) => {
    const m = new Map<string, number>();
    list.forEach((t) => m.set(t.source_type, (m.get(t.source_type) ?? 0) + Number(t.total_amount || 0)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  const totalEntries = entries.reduce((s, t) => s + Number(t.total_amount || 0), 0);
  const totalExits = exits.reduce((s, t) => s + Number(t.total_amount || 0), 0);
  const net = totalEntries - totalExits;

  const exportCsv = () => {
    const header = "data,tipo,fonte,arena,status,valor\n";
    const rows = filtered.map((t) => {
      const arena = arenas.find((a) => a.id === t.arena_id)?.name ?? "";
      const kind = ENTRY_LABELS[t.source_type] ? "entrada" : "saida";
      return [t.created_at, kind, t.source_type, arena.replace(/,/g, " "), t.status, t.total_amount].join(",");
    }).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `tenant-financeiro-${period}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl text-foreground flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" /> Financeiro da rede
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Entradas e saídas consolidadas. Filtre por período, arena e tipo.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="mr-2 h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Período</Label>
            <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="365">Último ano</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Arena</Label>
            <Select value={arenaId} onValueChange={setArenaId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as arenas</SelectItem>
                {arenas.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Tipo</Label>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {Object.entries({ ...ENTRY_LABELS, ...EXIT_LABELS }).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Totais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" /> Entradas</span>
            </div>
            <p className="text-2xl font-semibold text-emerald-500 tabular-nums">{fmtBRL(totalEntries)}</p>
          </CardContent>
        </Card>
        <Card className="border-rose-500/30 bg-rose-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><ArrowDownRight className="h-3.5 w-3.5 text-rose-500" /> Saídas</span>
            </div>
            <p className="text-2xl font-semibold text-rose-500 tabular-nums">{fmtBRL(totalExits)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Saldo líquido</span>
            </div>
            <p className={`text-2xl font-semibold tabular-nums ${net >= 0 ? "text-foreground" : "text-rose-500"}`}>{fmtBRL(net)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Quebra por tipo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Entradas por tipo</CardTitle></CardHeader>
          <CardContent>
            {totalsBySource(entries).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem entradas no período.</p>
            ) : (
              <ul className="divide-y divide-border">
                {totalsBySource(entries).map(([k, v]) => (
                  <li key={k} className="flex items-center justify-between py-2">
                    <span className="text-sm">{ENTRY_LABELS[k] ?? k}</span>
                    <span className="text-sm font-semibold tabular-nums text-emerald-500">{fmtBRL(v)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Saídas por tipo</CardTitle></CardHeader>
          <CardContent>
            {totalsBySource(exits).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem saídas no período.</p>
            ) : (
              <ul className="divide-y divide-border">
                {totalsBySource(exits).map(([k, v]) => (
                  <li key={k} className="flex items-center justify-between py-2">
                    <span className="text-sm">{EXIT_LABELS[k] ?? k}</span>
                    <span className="text-sm font-semibold tabular-nums text-rose-500">{fmtBRL(v)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lista detalhada */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Filter className="h-4 w-4" /> Movimentações</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-24 bg-muted/30 animate-pulse rounded" />
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma movimentação com os filtros atuais.</p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.slice(0, 50).map((t) => {
                const isEntry = !!ENTRY_LABELS[t.source_type];
                const arena = arenas.find((a) => a.id === t.arena_id)?.name;
                return (
                  <li key={t.id} className="flex items-center justify-between py-2 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {ENTRY_LABELS[t.source_type] ?? EXIT_LABELS[t.source_type] ?? t.source_type}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {new Date(t.created_at).toLocaleDateString("pt-BR")} {arena ? `· ${arena}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-[10px]">{t.status}</Badge>
                      <span className={`text-sm font-semibold tabular-nums ${isEntry ? "text-emerald-500" : "text-rose-500"}`}>
                        {isEntry ? "+" : "−"}{fmtBRL(Number(t.total_amount || 0))}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
