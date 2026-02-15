import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { DollarSign, TrendingUp, AlertTriangle } from "lucide-react";

const AdminFinances = () => {
  const [balances, setBalances] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [totals, setTotals] = useState({ revenue: 0, orgPending: 0, withdrawalsPending: 0, subRevenue: 0, mkRevenue: 0 });

  const fetchData = async () => {
    const [balRes, wdRes, profiles, ledgerRes] = await Promise.all([
      supabase.from("organizer_balances").select("*").order("created_at", { ascending: false }),
      supabase.from("withdrawal_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, full_name"),
      supabase.from("financial_ledger").select("*, companies(name)").order("created_at", { ascending: false }).limit(50),
    ]);

    const nameMap: Record<string, string> = {};
    (profiles.data || []).forEach((p) => { nameMap[p.user_id] = p.full_name; });

    const bals = (balRes.data || []).map((b) => ({ ...b, organizer_name: nameMap[b.organizer_id] || "—" }));
    const wds = (wdRes.data || []).map((w) => ({ ...w, organizer_name: nameMap[w.organizer_id] || "—" }));

    const revenue = bals.reduce((s, b) => s + Number(b.commission), 0);
    const orgPending = bals.filter((b) => b.status === "pending").reduce((s, b) => s + Number(b.amount), 0);
    const wdPending = wds.filter((w) => w.status === "pending").reduce((s, w) => s + Number(w.amount), 0);

    const ledgerData = ledgerRes.data || [];
    const subRevenue = ledgerData.filter((l: any) => l.source === "subscription").reduce((s: number, l: any) => s + Number(l.amount), 0);
    const mkRevenue = ledgerData.filter((l: any) => l.source === "marketplace_order").reduce((s: number, l: any) => s + Number(l.mood_share), 0);

    setBalances(bals);
    setWithdrawals(wds);
    setLedger(ledgerData);
    setTotals({ revenue, orgPending, withdrawalsPending: wdPending, subRevenue, mkRevenue });
  };

  useEffect(() => { fetchData(); }, []);

  const handleWithdrawal = async (id: string, action: "approved" | "rejected") => {
    await supabase.from("withdrawal_requests").update({ status: action, processed_at: new Date().toISOString() }).eq("id", id);
    toast({ title: `Saque ${action === "approved" ? "aprovado" : "rejeitado"}` });
    fetchData();
  };

  return (
    <div>
      <h1 className="mb-6 text-4xl font-display text-foreground">FINANCEIRO</h1>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium font-sans">Receita Mood</CardTitle>
            <TrendingUp className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">R$ {totals.revenue.toFixed(2)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium font-sans">Saldo Org. Pendente</CardTitle>
            <DollarSign className="h-5 w-5 text-secondary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-secondary">R$ {totals.orgPending.toFixed(2)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium font-sans">Saques Pendentes</CardTitle>
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">R$ {totals.withdrawalsPending.toFixed(2)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium font-sans">Receita Assinaturas</CardTitle>
            <TrendingUp className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">R$ {totals.subRevenue.toFixed(2)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium font-sans">Receita Marketplace</CardTitle>
            <DollarSign className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">R$ {totals.mkRevenue.toFixed(2)}</div></CardContent>
        </Card>
      </div>

      {/* Withdrawal Requests */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-sans text-lg">Solicitações de Saque</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organizador</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Chave PIX</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {withdrawals.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium">{w.organizer_name}</TableCell>
                  <TableCell>R$ {Number(w.amount).toFixed(2)}</TableCell>
                  <TableCell className="text-xs">{w.pix_key}</TableCell>
                  <TableCell>
                    <Badge variant={w.status === "pending" ? "secondary" : w.status === "approved" ? "default" : "outline"}>
                      {w.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{new Date(w.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>
                    {w.status === "pending" && (
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => handleWithdrawal(w.id, "approved")}>Aprovar</Button>
                        <Button size="sm" variant="outline" onClick={() => handleWithdrawal(w.id, "rejected")}>Rejeitar</Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {withdrawals.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhuma solicitação.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Balances */}
      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-lg">Saldos por Organizador</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organizador</TableHead>
                <TableHead>Valor Org.</TableHead>
                <TableHead>Comissão Mood</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {balances.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.organizer_name}</TableCell>
                  <TableCell>R$ {Number(b.amount).toFixed(2)}</TableCell>
                  <TableCell>R$ {Number(b.commission).toFixed(2)}</TableCell>
                  <TableCell><Badge variant="outline">{b.status}</Badge></TableCell>
                  <TableCell className="text-xs">{new Date(b.created_at).toLocaleDateString("pt-BR")}</TableCell>
                </TableRow>
              ))}
              {balances.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum registro.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminFinances;
