import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wrench, Sparkles, Zap, RefreshCw, Archive, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type BackfillItem = {
  enrollment_id: string;
  tournament_id: string;
  tournament_name: string | null;
  modality_count: number;
  bucket: "auto_linked" | "needs_category_review" | "unrecoverable_no_category";
  is_test: boolean;
};

type BackfillResult = {
  ok: boolean;
  total_processed: number;
  auto_linked: number;
  needs_category_review: number;
  unrecoverable_no_category: number;
  items: BackfillItem[];
  error?: string;
};

const bucketBadge: Record<BackfillItem["bucket"], { label: string; cls: string }> = {
  auto_linked: { label: "Vinculada", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  needs_category_review: { label: "Revisar categoria", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  unrecoverable_no_category: { label: "Irrecuperável", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
};

const INTERNAL_TOOLS_ENABLED = import.meta.env.VITE_ENABLE_INTERNAL_TOOLS === "true";

const AdminInternalTools = () => {
  if (!INTERNAL_TOOLS_ENABLED) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-display text-foreground flex items-center gap-3">
          <Wrench className="h-7 w-7 text-muted-foreground" />
          Ferramentas internas
        </h1>
        <Alert className="border-muted-foreground/40 bg-muted/30">
          <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          <AlertDescription className="text-foreground">
            Indisponível neste ambiente. Defina <code>VITE_ENABLE_INTERNAL_TOOLS=true</code> para habilitar.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const [seeding, setSeeding] = useState(false);
  const [smoking, setSmoking] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [smokeResult, setSmokeResult] = useState<any>(null);
  const [backfillResult, setBackfillResult] = useState<BackfillResult | null>(null);

  const seedPilot = async () => {
    setSeeding(true);
    const { data, error } = await supabase.functions.invoke("seed-pilot-arena", { body: {} });
    setSeeding(false);
    if (error || (data as any)?.ok === false) {
      toast.error((error?.message ?? (data as any)?.error) || "Falha ao criar piloto");
      return;
    }
    toast.success((data as any)?.message ?? "Piloto criado");
  };

  const smokeTest = async () => {
    setSmoking(true);
    setSmokeResult(null);
    const { data, error } = await supabase.functions.invoke("smoke-test-payment", { body: {} });
    setSmoking(false);
    setSmokeResult(data ?? { error: error?.message });
    if (error || (data as any)?.ok === false) {
      toast.error(`Smoke-test falhou: ${error?.message ?? (data as any)?.error ?? "erro"}`);
      return;
    }
    toast.success("Smoke-test 8/8 OK");
  };

  const runBackfill = async () => {
    setBackfilling(true);
    const { data, error } = await (supabase as any).rpc("backfill_orphan_enrollments");
    setBackfilling(false);
    const d = data as BackfillResult;
    if (error || d?.ok === false) {
      toast.error(error?.message ?? d?.error ?? "Falha no backfill");
      return;
    }
    setBackfillResult(d);
    toast.success(
      `Backfill: ${d.auto_linked} vinculadas · ${d.needs_category_review} para revisão · ${d.unrecoverable_no_category} irrecuperáveis`
    );
  };

  const archiveTest = async () => {
    if (!confirm("Arquivar inscrições órfãs originadas de smoke-tests/seed? Esta ação marca como arquivadas (não deleta).")) return;
    setArchiving(true);
    const { data, error } = await (supabase as any).rpc("archive_test_orphans");
    setArchiving(false);
    const d = data as any;
    if (error || d?.ok === false) {
      toast.error(error?.message ?? d?.error ?? "Falha ao arquivar");
      return;
    }
    toast.success(`${d.archived} inscrições de teste arquivadas`);
    runBackfill();
  };

  const checks = smokeResult?.checks ?? {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display text-foreground flex items-center gap-3">
          <Wrench className="h-7 w-7 text-primary" />
          Ferramentas internas
        </h1>
        <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-400 bg-amber-500/10">
          Ambiente interno · não exposto a clientes
        </Badge>
      </div>

      <Alert className="border-amber-500/40 bg-amber-500/10">
        <ShieldAlert className="h-4 w-4 text-amber-500" />
        <AlertDescription className="text-foreground">
          Esta área é restrita à operação interna da plataforma. Nada aqui deve ser usado em fluxos de produto para clientes.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Smoke-test */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" /> Smoke-test de pagamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Cria torneio + categoria + inscrição, força pagamento e valida toda a cadeia (entry, member, ftx, attribution).
            </p>
            <Button size="sm" onClick={smokeTest} disabled={smoking}>
              <Zap className={`h-4 w-4 mr-2 ${smoking ? "animate-spin" : ""}`} />
              {smoking ? "Executando…" : "Rodar smoke-test"}
            </Button>
            {smokeResult && (
              <div className="grid grid-cols-2 gap-1 text-xs pt-2 border-t border-border">
                {Object.entries(checks).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2">
                    <span className={v ? "text-emerald-400" : "text-red-400"}>{v ? "✓" : "✗"}</span>
                    <span className="text-muted-foreground truncate">{k}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Seed piloto */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Seed piloto arena
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Cria uma arena piloto com dados sintéticos para validação interna.
            </p>
            <Button size="sm" variant="outline" onClick={seedPilot} disabled={seeding}>
              <Sparkles className={`h-4 w-4 mr-2 ${seeding ? "animate-spin" : ""}`} />
              {seeding ? "Criando…" : "Criar piloto"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Backfill + relatório */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary" /> Inscrições órfãs — backfill e relatório
          </CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={runBackfill} disabled={backfilling}>
              <RefreshCw className={`h-4 w-4 mr-2 ${backfilling ? "animate-spin" : ""}`} />
              {backfilling ? "Processando…" : "Rodar backfill"}
            </Button>
            <Button size="sm" variant="outline" onClick={archiveTest} disabled={archiving}>
              <Archive className={`h-4 w-4 mr-2 ${archiving ? "animate-spin" : ""}`} />
              Arquivar dados de teste
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!backfillResult && (
            <p className="text-sm text-muted-foreground">
              Clique em <strong>Rodar backfill</strong> para classificar inscrições pagas sem categoria/entry.
            </p>
          )}

          {backfillResult && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Total processado</p>
                  <p className="text-2xl font-bold tabular-nums">{backfillResult.total_processed}</p>
                </div>
                <div className="rounded-lg bg-emerald-500/10 p-3">
                  <p className="text-xs text-emerald-400">Vinculadas</p>
                  <p className="text-2xl font-bold tabular-nums text-emerald-400">{backfillResult.auto_linked}</p>
                </div>
                <div className="rounded-lg bg-amber-500/10 p-3">
                  <p className="text-xs text-amber-400">Revisar categoria</p>
                  <p className="text-2xl font-bold tabular-nums text-amber-400">{backfillResult.needs_category_review}</p>
                </div>
                <div className="rounded-lg bg-red-500/10 p-3">
                  <p className="text-xs text-red-400">Irrecuperáveis</p>
                  <p className="text-2xl font-bold tabular-nums text-red-400">{backfillResult.unrecoverable_no_category}</p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Torneio</TableHead>
                    <TableHead className="text-right">Modalities</TableHead>
                    <TableHead>Bucket</TableHead>
                    <TableHead>Origem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backfillResult.items.map((it) => {
                    const b = bucketBadge[it.bucket];
                    return (
                      <TableRow key={it.enrollment_id}>
                        <TableCell className="font-medium truncate max-w-[280px]">
                          {it.tournament_name ?? it.tournament_id.slice(0, 8)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{it.modality_count}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${b.cls}`}>{b.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {it.is_test ? (
                            <Badge variant="outline" className="text-[10px] border-muted-foreground/30 text-muted-foreground">TESTE</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">PRODUÇÃO</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {backfillResult.items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Nenhuma inscrição órfã. ✓
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminInternalTools;
