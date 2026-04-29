import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useGrowthDashboard, type GrowthScope } from "@/hooks/useGrowthDashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Zap, ShieldOff, TrendingUp } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  tournament_boost: "Boost de torneio",
  send_proactive_message: "Mensagem proativa",
  create_campaign: "Campanha",
  recommend_product: "Recomendação de produto",
  reactivation_message: "Reativação",
  fill_idle_slots: "Preencher horários ociosos",
  upsell_plan: "Upsell de plano",
};

const SOURCE_LABELS: Record<string, string> = {
  guardrail_block: "Guardrail",
  kill_switch: "Kill switch",
  tier_no_auto: "Plano",
  tier_domain_block: "Plano",
  quota_auto: "Cota",
  quota_suggestions: "Cota",
};

interface Props {
  scope: GrowthScope;
}

const fmtBrl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);

export function GrowthDashboardPanel({ scope }: Props) {
  const { totals, budgets, loading, error } = useGrowthDashboard(scope);

  if (loading) {
    return (
      <div className="grid gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }
  if (error) {
    return <p className="text-sm text-destructive">Não foi possível carregar growth: {error}</p>;
  }

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="font-display text-2xl tracking-wide">Autonomous Growth</h2>
        <span className="text-xs text-muted-foreground">Últimos 30 dias</span>
      </header>

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi icon={<Sparkles className="h-4 w-4" />} label="Sugeridas" value={totals.suggested} />
        <Kpi icon={<Zap className="h-4 w-4 text-primary" />} label="Auto-executadas" value={totals.auto} />
        <Kpi icon={<ShieldOff className="h-4 w-4 text-destructive" />} label="Bloqueadas" value={totals.blocked} />
        <Kpi icon={<TrendingUp className="h-4 w-4 text-primary" />} label="Receita atribuída" value={fmtBrl(totals.revenue)} />
      </div>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Ações por tipo</h3>
        {totals.byActionType.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem atividade nos últimos 30 dias.</p>
        ) : (
          <div className="space-y-2">
            {totals.byActionType.map(row => (
              <div key={row.action_type} className="flex items-center justify-between text-sm border-b border-border/40 pb-2 last:border-0">
                <div>
                  <div className="font-medium">{ACTION_LABELS[row.action_type] ?? row.action_type}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.total} total · {row.auto} auto · {row.blocked} bloqueadas
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{fmtBrl(row.revenue)}</div>
                  <div className="text-xs text-muted-foreground">receita</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Orçamentos ativos</h3>
        {budgets.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum orçamento configurado para este escopo.</p>
        ) : (
          <div className="space-y-3">
            {budgets.map(b => {
              const pct = b.budget_brl > 0 ? Math.min(100, (Number(b.spent_brl) / Number(b.budget_brl)) * 100) : 0;
              return (
                <div key={b.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">{b.scope_type}</Badge>
                      <span className="capitalize text-muted-foreground">{b.period}</span>
                    </div>
                    <span className="font-medium">
                      {fmtBrl(Number(b.spent_brl))} / {fmtBrl(Number(b.budget_brl))}
                    </span>
                  </div>
                  <Progress value={pct} />
                  {b.boost_count_limit !== null && (
                    <p className="text-xs text-muted-foreground">
                      Boosts: {b.boost_count_used} / {b.boost_count_limit}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </section>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        {icon} {label}
      </div>
      <div className="font-display text-2xl tracking-wide">{value}</div>
    </Card>
  );
}
