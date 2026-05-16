import { useEffect, useState, useMemo } from "react";
import { useParams, Link, Navigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import {
  AlertCircle, ArrowLeft, ChevronDown, Pencil,
  Share2, Users, CheckCircle2, Layers, Gamepad2, Trophy, Medal, Trash2,
} from "lucide-react";
import EditTournamentForm from "@/components/tournament/EditTournamentForm";
import TabCheckin from "@/components/tournament/TabCheckin";
import TabInscritos from "@/components/tournament/TabInscritos";
import StageProgress from "@/components/tournament/StageProgress";
import ModalityPicker from "@/components/tournament/ModalityPicker";
import EmptyState from "@/components/tournament/EmptyState";
import TabGroups from "@/components/brackets/TabGroups";
import TabMatches from "@/components/brackets/TabMatches";
import TabBracketView from "@/components/brackets/TabBracketView";
import TabPlacements from "@/components/brackets/TabPlacements";
import { dashboardPathFor } from "@/lib/dashboardPath";
import {
  deriveStage, nextActionFor, type NextAction,
} from "@/lib/tournamentStage";
import TabResumo from "@/components/tournament/TabResumo";
import { useTournamentPermission } from "@/hooks/useTournamentPermission";

const MOOD_COMMISSION_PERCENT = 10;
const isValidUUID = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

type TabKey = "resumo" | "inscritos" | "checkin" | "grupos" | "jogos" | "chave" | "podio";

const ManageTournament = () => {
  const { id } = useParams();
  const { user, userRole, loading: authLoading } = useAuth();
  const perm = useTournamentPermission(id);
  const canManage = perm.canManage;
  const [params, setParams] = useSearchParams();
  const backPath = dashboardPathFor(userRole);

  const [tournament, setTournament] = useState<any>(null);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [hasMpAccount, setHasMpAccount] = useState(false);
  const [hasEntries, setHasEntries] = useState(false);
  const [hasGroups, setHasGroups] = useState(false);
  const [hasMatches, setHasMatches] = useState(false);
  const [hasChampion, setHasChampion] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const tab = (params.get("tab") as TabKey) || "resumo";
  const setTab = (t: TabKey) => setParams((prev) => {
    const p = new URLSearchParams(prev);
    p.set("tab", t);
    return p;
  });

  const loadOps = async (tid: string) => {
    // Modalities of this tournament
    const { data: mods } = await supabase
      .from("tournament_modalities")
      .select("id")
      .eq("tournament_id", tid);
    const modIds = (mods || []).map((m: any) => m.id);

    if (modIds.length === 0) {
      setHasEntries(false); setHasGroups(false); setHasMatches(false); setHasChampion(false);
      return;
    }
    const [entriesRes, groupsRes, matchesRes, placeRes] = await Promise.all([
      supabase.from("modality_entries").select("id", { count: "exact", head: true }).in("modality_id", modIds),
      supabase.from("modality_groups").select("id", { count: "exact", head: true }).in("modality_id", modIds),
      supabase.from("modality_matches").select("id", { count: "exact", head: true }).in("modality_id", modIds),
      supabase.from("modality_placements").select("id", { count: "exact", head: true }).in("modality_id", modIds).eq("position", 1),
    ]);
    setHasEntries((entriesRes.count || 0) > 0);
    setHasGroups((groupsRes.count || 0) > 0);
    setHasMatches((matchesRes.count || 0) > 0);
    setHasChampion((placeRes.count || 0) > 0);
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!id || !isValidUUID(id)) { setDataLoaded(true); setTournament(null); return; }
      const { data: t } = await supabase.from("tournaments").select("*").eq("id", id).maybeSingle();
      setTournament(t);
      setDataLoaded(true);
      if (!t) return;

      const [enrollRes, profileRes] = await Promise.all([
        supabase.from("enrollments").select("id, status, amount_paid, modality_id, checked_in_at, archived_at").eq("tournament_id", id!),
        supabase.from("profiles").select("mp_collector_id").eq("user_id", t.organizer_id).single(),
      ]);
      setEnrollments(enrollRes.data || []);
      setHasMpAccount(!!(profileRes.data as any)?.mp_collector_id);

      await loadOps(id!);
    };
    if (id && user) fetchData();
  }, [id, user]);

  const paid = enrollments.filter((e) => e.status === "paid");
  const pending = enrollments.filter((e) => e.status === "pending");
  const orphansCount = enrollments.filter((e: any) => e.status === "paid" && !e.modality_id && !e.archived_at).length;
  const notCheckedInCount = enrollments.filter((e: any) => e.status === "paid" && e.modality_id && !e.checked_in_at && !e.archived_at).length;

  const stageInfo = useMemo(() => {
    if (!tournament) return null;
    const inputs = {
      status: tournament.status,
      startDate: tournament.start_date,
      endDate: tournament.end_date,
      paidCount: paid.length,
      maxSlots: Number(tournament.max_slots) || 0,
      hasEntries, hasGroups, hasMatches,
      hasFinishedFinal: hasChampion,
      hasOrphans: orphansCount > 0,
    };
    const sid = deriveStage(inputs);
    return { id: sid, next: nextActionFor(sid, inputs) as NextAction };
  }, [tournament, paid.length, hasEntries, hasGroups, hasMatches, hasChampion, orphansCount]);

  const shareTournament = async () => {
    if (!tournament) return;
    const url = `${window.location.origin}/tournaments/${tournament.id}`;
    const text = `Confira ${tournament.name} no MoodPlay: ${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: tournament.name, text, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copiado", description: url });
      }
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copiado", description: url });
      } catch {}
    }
  };

  const handleAction = (a: NextAction) => {
    if (a.action === "share") return shareTournament();
    if (a.goToTab) return setTab(a.goToTab);
  };

  if (authLoading || perm.loading) return <div className="flex min-h-screen items-center justify-center bg-background text-foreground">Carregando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (dataLoaded && !tournament) return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground gap-4">
      <p className="text-lg text-muted-foreground">Torneio não encontrado.</p>
      <Button asChild><Link to={backPath}>Voltar</Link></Button>
    </div>
  );
  if (!tournament) return <div className="flex min-h-screen items-center justify-center bg-background text-foreground">Carregando...</div>;

  // Permission gate: must be admin / organizer owner / arena owner / tenant admin
  if (!canManage) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground gap-4 px-6 text-center">
        <p className="text-lg font-semibold text-foreground">Esta é a Central do organizador.</p>
        <p className="text-sm text-muted-foreground max-w-md">
          Você está vendo como atleta. Apenas o organizador do torneio pode gerenciar inscrições, grupos e resultados.
        </p>
        <div className="flex gap-2">
          <Button asChild><Link to={`/tournaments/${tournament.id}`}>Ver página pública</Link></Button>
          <Button variant="outline" asChild><Link to={backPath}>Voltar</Link></Button>
        </div>
      </div>
    );
  }

  const available = Math.max(0, Number(tournament.max_slots || 0) - paid.length - pending.length);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-14 items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to={backPath} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
          </Button>
          <Link to={backPath} className="text-xl font-display text-primary text-glow">🏐 MOOD PLAY</Link>
        </div>
      </header>

      <main className="container max-w-4xl py-6 pb-20 space-y-5">
        {/* Title block */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Central do torneio</p>
            <h1 className="text-3xl sm:text-4xl font-display text-foreground leading-tight">{tournament.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {tournament.city ? `${tournament.city}${tournament.state ? ", " + tournament.state : ""} · ` : ""}
              {tournament.start_date} {tournament.end_date && tournament.end_date !== tournament.start_date ? `→ ${tournament.end_date}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={shareTournament} className="gap-1.5">
              <Share2 className="h-4 w-4" /> Divulgar
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/tournaments/${tournament.id}`}>Ver página</Link>
            </Button>
          </div>
        </div>

        {/* Stage progress + next action */}
        {stageInfo && (
          <StageProgress
            current={stageInfo.id}
            nextAction={stageInfo.next}
            onAction={handleAction}
          />
        )}

        {/* KPIs */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          <Card><CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{tournament.max_slots ?? "—"}</p>
            <p className="text-xs text-muted-foreground">Vagas</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-primary">{paid.length}</p>
            <p className="text-xs text-muted-foreground">Confirmados</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-secondary">{pending.length}</p>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{available}</p>
            <p className="text-xs text-muted-foreground">Disponíveis</p>
          </CardContent></Card>
        </div>

        {/* Financial summary */}
        {Number(tournament.entry_fee) > 0 && (() => {
          const totalRevenue = paid.length * Number(tournament.entry_fee);
          const commission = Math.round(totalRevenue * MOOD_COMMISSION_PERCENT) / 100;
          const net = totalRevenue - commission;
          return (
            <Card>
              <CardContent className="pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Arrecadado ({paid.length})</span>
                  <span className="font-medium">R$ {totalRevenue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Comissão MoodPlay ({MOOD_COMMISSION_PERCENT}%)</span>
                  <span className="text-destructive">- R$ {commission.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2">
                  <span className="font-medium">Líquido</span>
                  <span className="font-bold text-primary">R$ {net.toFixed(2)}</span>
                </div>
                {!hasMpAccount && (
                  <div className="flex items-start gap-2 rounded-md bg-secondary/10 p-3 text-xs text-secondary mt-2">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <p>Conta Mercado Pago não vinculada. <Link to="/profile" className="underline font-medium">Vincular agora</Link></p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* Edit collapsible */}
        <Collapsible open={editOpen} onOpenChange={setEditOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between gap-2 h-11">
              <span className="flex items-center gap-2">
                <Pencil className="h-4 w-4" />
                Editar configurações
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${editOpen ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <Card><CardContent className="pt-6">
              <EditTournamentForm
                tournament={tournament}
                userId={user.id}
                onSaved={(updated: any) => { setTournament(updated); setEditOpen(false); }}
              />
            </CardContent></Card>
          </CollapsibleContent>
        </Collapsible>

        {/* Operational tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto bg-card border border-border h-auto flex-wrap">
            <TabsTrigger value="resumo" className="gap-1.5">Resumo</TabsTrigger>
            <TabsTrigger value="inscritos" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Inscritos</TabsTrigger>
            <TabsTrigger value="checkin" className="gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Check-in</TabsTrigger>
            <TabsTrigger value="grupos" className="gap-1.5"><Layers className="h-3.5 w-3.5" /> Grupos</TabsTrigger>
            <TabsTrigger value="jogos" className="gap-1.5"><Gamepad2 className="h-3.5 w-3.5" /> Jogos</TabsTrigger>
            <TabsTrigger value="chave" className="gap-1.5"><Trophy className="h-3.5 w-3.5" /> Chave</TabsTrigger>
            <TabsTrigger value="podio" className="gap-1.5"><Medal className="h-3.5 w-3.5" /> Pódio</TabsTrigger>
          </TabsList>

          <TabsContent value="resumo" className="mt-4">
            <TabResumo
              tournamentId={id!}
              stageLabel={stageInfo?.id}
              hasModalities={true}
              orphansCount={orphansCount}
              pendingResultsCount={enrollments.length ? 0 : 0}
              completePaidCount={paid.length - orphansCount}
              notCheckedInCount={notCheckedInCount}
              hasGroups={hasGroups}
              hasMatches={hasMatches}
              onGoTab={(t) => setTab(t as TabKey)}
              onEditConfig={() => setEditOpen(true)}
            />
          </TabsContent>

          <TabsContent value="inscritos" className="mt-4">
            <TabInscritos
              tournamentId={id!}
              canManage={canManage}
              onDivulgar={shareTournament}
            />
          </TabsContent>

          <TabsContent value="checkin" className="mt-4">
            <TabCheckin tournamentId={id!} />
          </TabsContent>

          <TabsContent value="grupos" className="mt-4">
            <ModalityPicker
              tournamentId={id!}
              emptyTitle="Cadastre as categorias primeiro."
              emptyDescription="Use 'Editar configurações' para adicionar categorias ao torneio."
            >
              {(m) => (
                <TabGroups modalityId={m.id} numGroups={m.num_groups || 0} canManage={canManage} />
              )}
            </ModalityPicker>
          </TabsContent>

          <TabsContent value="checkin" className="mt-4">
            <TabCheckin tournamentId={id!} />
          </TabsContent>

          <TabsContent value="grupos" className="mt-4">
            <ModalityPicker
              tournamentId={id!}
              emptyTitle="Cadastre as categorias primeiro."
              emptyDescription="Use 'Editar configurações' para adicionar categorias ao torneio."
            >
              {(m) => (
                <TabGroups modalityId={m.id} numGroups={m.num_groups || 0} canManage={true} />
              )}
            </ModalityPicker>
          </TabsContent>

          <TabsContent value="jogos" className="mt-4">
            <ModalityPicker
              tournamentId={id!}
              emptyTitle="Os jogos ainda não foram gerados."
              emptyDescription="Sorteie os grupos primeiro para que os jogos sejam criados."
              emptyCtaLabel="Ir para Grupos"
              onEmptyCta={() => setTab("grupos")}
            >
              {(m) => (
                <TabMatches modalityId={m.id} tournamentId={id!} isOrganizer={canManage} />
              )}
            </ModalityPicker>
          </TabsContent>

          <TabsContent value="chave" className="mt-4">
            <ModalityPicker
              tournamentId={id!}
              emptyTitle="O chaveamento aparece quando os jogos forem criados."
            >
              {(m) => (
                <TabBracketView modalityId={m.id} isOrganizer={canManage} />
              )}
            </ModalityPicker>
          </TabsContent>

          <TabsContent value="podio" className="mt-4">
            <ModalityPicker
              tournamentId={id!}
              emptyTitle="O pódio aparece quando a final terminar."
            >
              {(m) => (
                <div className="space-y-3">
                  <TabPlacements modalityId={m.id} />
                  <Button variant="outline" size="sm" onClick={shareTournament} className="gap-1.5">
                    <Share2 className="h-4 w-4" /> Compartilhar resultado
                  </Button>
                </div>
              )}
            </ModalityPicker>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default ManageTournament;
