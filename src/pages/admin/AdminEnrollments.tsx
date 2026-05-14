import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

type ViewMode = "by_tournament" | "needs_review" | "archived";

const isTestName = (n?: string | null) =>
  !!n && (/^\[SMOKE\]/i.test(n) || /seed/i.test(n) || /test/i.test(n));

const AdminEnrollments = () => {
  const [view, setView] = useState<ViewMode>("by_tournament");
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [selectedTournament, setSelectedTournament] = useState("");
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [modalitiesByTournament, setModalitiesByTournament] = useState<Record<string, any[]>>({});
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    supabase.from("tournaments").select("id, name").order("created_at", { ascending: false }).then(({ data }) => {
      setTournaments(data || []);
    });
  }, []);

  const enrichWithProfiles = useCallback(async (rows: any[]) => {
    const userIds = rows.map((e) => e.user_id).filter(Boolean);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", userIds.length ? userIds : ["none"]);
    const nameMap: Record<string, string> = {};
    (profiles || []).forEach((p: any) => { nameMap[p.user_id] = p.full_name; });
    const tIds = Array.from(new Set(rows.map((e) => e.tournament_id).filter(Boolean)));
    const { data: tns } = await supabase.from("tournaments").select("id, name").in("id", tIds.length ? tIds : ["none"]);
    const tMap: Record<string, string> = {};
    (tns || []).forEach((t: any) => { tMap[t.id] = t.name; });
    return rows.map((e) => ({
      ...e,
      profile_name: nameMap[e.user_id || ""] || e.athlete_name || "—",
      tournament_name: tMap[e.tournament_id] || "—",
    }));
  }, []);

  const ensureModalities = useCallback(async (tournamentId: string) => {
    if (modalitiesByTournament[tournamentId]) return;
    const { data } = await supabase
      .from("tournament_modalities")
      .select("id, name, gender, category")
      .eq("tournament_id", tournamentId);
    setModalitiesByTournament((prev) => ({ ...prev, [tournamentId]: data || [] }));
  }, [modalitiesByTournament]);

  // Fetch by view
  useEffect(() => {
    const run = async () => {
      if (view === "by_tournament") {
        if (!selectedTournament) { setEnrollments([]); return; }
        const { data } = await supabase
          .from("enrollments")
          .select("*")
          .eq("tournament_id", selectedTournament)
          .order("created_at", { ascending: false });
        setEnrollments(await enrichWithProfiles(data || []));
        return;
      }
      if (view === "needs_review") {
        const { data } = await supabase
          .from("enrollments")
          .select("*")
          .eq("needs_category_review", true)
          .is("archived_at", null)
          .order("created_at", { ascending: false });
        const enriched = await enrichWithProfiles(data || []);
        setEnrollments(enriched);
        // preload modalities for each tournament involved
        Array.from(new Set(enriched.map((e) => e.tournament_id))).forEach((tid) => ensureModalities(tid as string));
        return;
      }
      // archived
      const { data } = await supabase
        .from("enrollments")
        .select("*")
        .not("archived_at", "is", null)
        .order("archived_at", { ascending: false })
        .limit(500);
      setEnrollments(await enrichWithProfiles(data || []));
    };
    run();
  }, [view, selectedTournament, refreshTick, enrichWithProfiles, ensureModalities]);

  const refetch = () => setRefreshTick((n) => n + 1);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("enrollments").update({ status: status as any }).eq("id", id);
    toast({ title: `Inscrição atualizada para ${status}` });
    refetch();
  };

  const deleteEnrollment = async (id: string) => {
    if (!confirm("Excluir esta inscrição?")) return;
    await supabase.from("enrollments").delete().eq("id", id);
    toast({ title: "Inscrição excluída" });
    refetch();
  };

  const setCategory = async (enrollmentId: string, modalityId: string) => {
    const { error } = await supabase
      .from("enrollments")
      .update({
        modality_id: modalityId,
        needs_category_review: false,
        orphan_reason: null,
      } as any)
      .eq("id", enrollmentId);
    if (error) {
      toast({ title: "Erro ao definir categoria", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Categoria definida" });
    refetch();
  };

  const statusColor = (s: string) => s === "paid" ? "default" : s === "pending" ? "secondary" : "outline";

  return (
    <div>
      <h1 className="mb-6 text-4xl font-display text-foreground">GERENCIAR INSCRIÇÕES</h1>

      <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)} className="mb-6">
        <TabsList>
          <TabsTrigger value="by_tournament">Por torneio</TabsTrigger>
          <TabsTrigger value="needs_review">Precisam revisão</TabsTrigger>
          <TabsTrigger value="archived">Arquivadas</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === "by_tournament" && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="font-sans text-lg">Selecione um Torneio</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedTournament} onValueChange={setSelectedTournament}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Escolha o torneio..." />
              </SelectTrigger>
              <SelectContent>
                {tournaments.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {(view !== "by_tournament" || selectedTournament) && (
        <Card>
          <CardHeader>
            <CardTitle className="font-sans text-lg">
              {view === "needs_review" && `Precisam revisão de categoria (${enrollments.length})`}
              {view === "archived" && `Arquivadas (${enrollments.length})`}
              {view === "by_tournament" && `Inscrições (${enrollments.length})`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Atleta</TableHead>
                  {view !== "by_tournament" && <TableHead>Torneio</TableHead>}
                  <TableHead>Status</TableHead>
                  {view === "needs_review" && <TableHead>Definir categoria</TableHead>}
                  {view === "archived" && <TableHead>Motivo</TableHead>}
                  <TableHead>Data</TableHead>
                  {view === "by_tournament" && <TableHead>Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollments.map((e) => {
                  const mods = modalitiesByTournament[e.tournament_id] || [];
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.profile_name}</TableCell>
                      {view !== "by_tournament" && (
                        <TableCell className="max-w-[260px] truncate">
                          <span>{e.tournament_name}</span>
                          {isTestName(e.tournament_name) && (
                            <Badge variant="outline" className="ml-2 text-[10px] border-muted-foreground/40 text-muted-foreground">TESTE</Badge>
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge variant={statusColor(e.status)}>{e.status}</Badge>
                      </TableCell>
                      {view === "needs_review" && (
                        <TableCell>
                          <Select onValueChange={(v) => setCategory(e.id, v)}>
                            <SelectTrigger className="h-8 w-[220px]">
                              <SelectValue placeholder={mods.length ? "Escolher…" : "Carregando…"} />
                            </SelectTrigger>
                            <SelectContent>
                              {mods.map((m: any) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {[m.name, m.gender, m.category].filter(Boolean).join(" · ")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      )}
                      {view === "archived" && (
                        <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">
                          {e.orphan_reason || "—"}
                        </TableCell>
                      )}
                      <TableCell className="text-xs">
                        {new Date(e.archived_at || e.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      {view === "by_tournament" && (
                        <TableCell>
                          <div className="flex gap-1">
                            {e.status !== "paid" && (
                              <Button size="sm" variant="outline" onClick={() => updateStatus(e.id, "paid")}>
                                Confirmar
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteEnrollment(e.id)}>
                              Excluir
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                {enrollments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      {view === "needs_review" ? "Nenhuma inscrição precisa de revisão. ✓" : "Nenhuma inscrição encontrada."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminEnrollments;
