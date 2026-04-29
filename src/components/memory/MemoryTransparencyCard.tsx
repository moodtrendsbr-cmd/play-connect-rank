import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain } from "lucide-react";
import { useMemoryContext, type MemoryRow } from "@/hooks/useMemoryContext";

const KEY_LABELS: Record<string, string> = {
  preferred_sport: "Esporte preferido",
  preferred_time_window: "Horário preferido",
  preferred_arena: "Arena frequente",
  level_category: "Categoria/nível",
  top_products: "Produtos campeões",
  recurring_students: "Alunos recorrentes",
  chronic_overdue_subscriptions: "Inadimplência crônica",
  top_instructor: "Professor mais ativo",
  low_occupancy_classes: "Turmas com baixa ocupação",
  frequent_categories: "Categorias frequentes",
  frequent_tournament_modality: "Modalidade frequente",
  top_arenas: "Arenas líderes",
  recurring_issues: "Problemas recorrentes",
};

function summarize(m: MemoryRow): string {
  const v = m.value ?? {};
  if (typeof (v as { value?: unknown }).value === "string") return String((v as { value: string }).value);
  if (Array.isArray((v as { top?: unknown[] }).top)) return `${((v as { top: unknown[] }).top).length} itens`;
  if ((v as { count?: number }).count) return `${(v as { count: number }).count} ocorrências`;
  return "—";
}

export function MemoryTransparencyCard(props: {
  title?: string;
  entity_type: "user" | "arena" | "organizer" | "company" | "tenant";
  entity_id?: string | null;
  tenant_id?: string | null;
}) {
  const { memories, loading } = useMemoryContext({
    entity_type: props.entity_type,
    entity_id: props.entity_id,
    tenant_id: props.tenant_id,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="h-4 w-4 text-[#2BFF88]" />
          {props.title ?? "Preferências percebidas"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : memories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sem padrões percebidos ainda. A ORKYM aprende conforme você usa a plataforma.
          </p>
        ) : (
          <ul className="space-y-2">
            {memories.map((m) => (
              <li key={m.key} className="flex items-center justify-between gap-2 border-b border-border/40 pb-2 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{KEY_LABELS[m.key] ?? m.key}</div>
                  <div className="text-xs text-muted-foreground truncate">{summarize(m)}</div>
                </div>
                <Badge variant="outline" className="shrink-0 text-xs">
                  {(m.confidence * 100).toFixed(0)}%
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
