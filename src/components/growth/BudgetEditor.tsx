import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";

export type BudgetScope =
  | { type: "global" }
  | { type: "tenant"; id: string }
  | { type: "arena"; id: string }
  | { type: "company"; id: string };

interface Props {
  scope: BudgetScope;
  title?: string;
}

interface Row {
  id: string;
  scope_type: string;
  scope_id: string | null;
  period: string;
  budget_brl: number;
  spent_brl: number;
  boost_count_limit: number | null;
  active: boolean;
}

const PERIODS = ["daily", "weekly", "monthly"];

export function BudgetEditor({ scope, title = "Orçamentos de growth" }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("monthly");
  const [budget, setBudget] = useState("");
  const [count, setCount] = useState("");
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    let q = supabase.from("growth_budgets").select("*").eq("scope_type", scope.type);
    if (scope.type !== "global") q = q.eq("scope_id", (scope as any).id);
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    else setRows((data ?? []) as Row[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [scope.type, (scope as any).id]);

  const create = async () => {
    const value = parseFloat(budget);
    if (!Number.isFinite(value) || value <= 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }
    const payload: any = {
      scope_type: scope.type,
      scope_id: scope.type === "global" ? null : (scope as any).id,
      period,
      budget_brl: value,
      boost_count_limit: count ? parseInt(count, 10) : null,
      active: true,
    };
    const { error } = await supabase.from("growth_budgets").insert(payload);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    setBudget(""); setCount("");
    toast({ title: "Orçamento criado" });
    load();
  };

  const toggle = async (id: string, next: boolean) => {
    const { error } = await supabase.from("growth_budgets").update({ active: next }).eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("growth_budgets").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else load();
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Badge variant="outline" className="capitalize">{scope.type}</Badge>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        <div>
          <Label className="text-xs">Período</Label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIODS.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Orçamento (R$)</Label>
          <Input type="number" min={0} step={1} value={budget} onChange={e => setBudget(e.target.value)} placeholder="0,00" />
        </div>
        <div>
          <Label className="text-xs">Limite de boosts</Label>
          <Input type="number" min={0} value={count} onChange={e => setCount(e.target.value)} placeholder="opcional" />
        </div>
        <div className="flex items-end">
          <Button onClick={create} className="w-full">Adicionar</Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum orçamento configurado.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map(r => (
            <li key={r.id} className="flex items-center justify-between text-sm border border-border/40 rounded-md px-3 py-2">
              <div>
                <div className="font-medium capitalize">{r.period} · R$ {Number(r.budget_brl).toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">
                  Gasto: R$ {Number(r.spent_brl).toFixed(2)}
                  {r.boost_count_limit !== null ? ` · Limite ${r.boost_count_limit} boosts` : ""}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={r.active} onCheckedChange={(v) => toggle(r.id, v)} />
                <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
