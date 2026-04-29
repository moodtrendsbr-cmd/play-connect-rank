import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { MessagePerformanceRow } from "@/hooks/useRevenueKpis";

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);

export function MessagePerformanceCard({ rows, loading }: { rows: MessagePerformanceRow[]; loading?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">Performance por tipo de mensagem</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-32 animate-pulse rounded bg-muted" />
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">Sem dados no período.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Enviadas</TableHead>
                  <TableHead className="text-right">Entregues</TableHead>
                  <TableHead className="text-right">Respondidas</TableHead>
                  <TableHead className="text-right">Convertidas</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Taxa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.trigger_type}>
                    <TableCell className="font-medium">{r.trigger_type}</TableCell>
                    <TableCell className="text-right">{r.sent}</TableCell>
                    <TableCell className="text-right">{r.delivered}</TableCell>
                    <TableCell className="text-right">{r.responded}</TableCell>
                    <TableCell className="text-right text-[#2BFF88]">{r.converted}</TableCell>
                    <TableCell className="text-right">{fmtBRL(Number(r.revenue))}</TableCell>
                    <TableCell className="text-right">{(Number(r.conversion_rate) * 100).toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
