import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AthleteActivities from "@/components/profile/AthleteActivities";
import {
  Trophy,
  Calendar,
  CheckCircle2,
  Swords,
  Medal,
  History,
  Compass,
  ChevronRight,
  Sun,
  MapPin,
  Rss,
  ShoppingBag,
  Flame,
  Clock,
} from "lucide-react";
import { OperationModeBanner } from "@/components/conversational/OperationModeBanner";
import { CommandExamplesCard } from "@/components/conversational/CommandExamplesCard";
import { CommandHistoryCard } from "@/components/conversational/CommandHistoryCard";
import { QrEntryCard } from "@/components/conversational/QrEntryCard";
import { COMMANDS } from "@/lib/conversationalCommands";

// ----- Helpers locais -----
const SectionHeader = ({
  icon: Icon,
  title,
  subtitle,
  action,
  id,
}: {
  icon: any;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  id?: string;
}) => (
  <div id={id} className="flex items-end justify-between gap-3 scroll-mt-20">
    <div className="flex items-center gap-3">
      <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <h2 className="text-lg font-semibold leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

const KpiPill = ({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: any;
}) => (
  <div className="rounded-lg border bg-card p-3 flex flex-col gap-1">
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      <span className="text-[10px] font-medium uppercase tracking-wide">{label}</span>
    </div>
    <span className="text-xl font-bold leading-none">{value}</span>
  </div>
);

const ShortcutLink = ({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: any;
  label: string;
}) => (
  <Link
    to={to}
    className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 hover:bg-muted/50 transition-colors"
  >
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <span className="text-sm font-medium">{label}</span>
    </div>
    <ChevronRight className="h-4 w-4 text-muted-foreground" />
  </Link>
);

const TournamentRow = ({
  id,
  name,
  startDate,
  status,
  paid,
}: {
  id: string;
  name: string;
  startDate?: string | null;
  status?: string | null;
  paid?: boolean;
}) => (
  <Link
    to={`/tournaments/${id}`}
    className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 hover:bg-muted/50 transition-colors"
  >
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium truncate">{name}</p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
        {startDate && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(startDate).toLocaleDateString("pt-BR")}
          </span>
        )}
        {status && (
          <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">
            {status}
          </Badge>
        )}
        {paid && (
          <Badge className="text-[10px] py-0 px-1.5 h-4 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 border-emerald-500/20">
            Inscrito
          </Badge>
        )}
      </div>
    </div>
    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
  </Link>
);

interface AthleteData {
  fullName: string;
  nickname: string | null;
  avatarUrl: string | null;
  city: string | null;
  team: string | null;
  arena: string | null;
}

interface KpiData {
  tournamentsCount: number;
  wins: number;
  checkinsDone: number;
  rankingPosition: number | null;
}

interface EnrollmentRow {
  id: string;
  status: string | null;
  payment_status?: string | null;
  checked_in_at?: string | null;
  tournament_id: string;
  tournaments: {
    id: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
    status: string | null;
  } | null;
}

const AthleteDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [athlete, setAthlete] = useState<AthleteData | null>(null);
  const [kpis, setKpis] = useState<KpiData>({
    tournamentsCount: 0,
    wins: 0,
    checkinsDone: 0,
    rankingPosition: null,
  });
  const [upcomingEnrollments, setUpcomingEnrollments] = useState<EnrollmentRow[]>([]);
  const [activeEnrollments, setActiveEnrollments] = useState<EnrollmentRow[]>([]);
  const [pendingCheckins, setPendingCheckins] = useState<EnrollmentRow[]>([]);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [openTournaments, setOpenTournaments] = useState<any[]>([]);
  const [nearbyArenas, setNearbyArenas] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchAll = async () => {
      setLoading(true);

      // 1. Profile
      const { data: profile } = await (supabase as any)
        .from("profiles")
        .select("full_name, nickname, avatar_url, city, state, team, arena")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile) {
        setAthlete({
          fullName: profile.full_name || "Atleta",
          nickname: profile.nickname,
          avatarUrl: profile.avatar_url,
          city: profile.city ? `${profile.city}${profile.state ? `, ${profile.state}` : ""}` : null,
          team: profile.team,
          arena: profile.arena,
        });
      }

      // 2. Enrollments + tournaments
      const { data: enrolls } = await supabase
        .from("enrollments")
        .select("id, status, payment_status, checked_in_at, tournament_id, tournaments(id, name, start_date, end_date, status)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      const enrollments = (enrolls as unknown as EnrollmentRow[]) || [];
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const upcoming = enrollments.filter((e) => {
        if (!e.tournaments?.start_date) return false;
        const start = new Date(e.tournaments.start_date);
        return start >= now && start <= sevenDaysFromNow;
      });

      const active = enrollments.filter((e) => {
        if (!e.tournaments?.start_date || !e.tournaments?.end_date) return false;
        const start = new Date(e.tournaments.start_date);
        const end = new Date(e.tournaments.end_date);
        return start <= now && end >= now;
      });

      const pendingCi = enrollments.filter((e) => {
        if (!e.tournaments?.start_date) return false;
        const start = new Date(e.tournaments.start_date);
        const isUpcoming = start >= now && start <= sevenDaysFromNow;
        return isUpcoming && !e.checked_in_at && (e.payment_status === "paid" || e.status === "confirmed");
      });

      setUpcomingEnrollments(upcoming.slice(0, 3));
      setActiveEnrollments(active.slice(0, 3));
      setPendingCheckins(pendingCi.slice(0, 3));

      const checkinsCount = enrollments.filter((e) => !!e.checked_in_at).length;

      // 3. Wins via match_results
      const { data: matches } = await supabase
        .from("match_results")
        .select("winner_id")
        .eq("winner_id", user.id);
      const winsCount = matches?.length || 0;

      // 4. Ranking position (count distinct winners with more wins)
      const { data: allWinners } = await supabase
        .from("match_results")
        .select("winner_id")
        .not("winner_id", "is", null);
      let position: number | null = null;
      if (allWinners) {
        const counts: Record<string, number> = {};
        allWinners.forEach((m: any) => {
          if (m.winner_id) counts[m.winner_id] = (counts[m.winner_id] || 0) + 1;
        });
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const idx = sorted.findIndex(([uid]) => uid === user.id);
        if (idx !== -1) position = idx + 1;
      }

      setKpis({
        tournamentsCount: enrollments.length,
        wins: winsCount,
        checkinsDone: checkinsCount,
        rankingPosition: position,
      });

      // 5. Recent matches (won or lost) — via match_results
      const { data: lastMatches } = await (supabase as any)
        .from("match_results")
        .select("id, winner_id, loser_id, score, created_at, modality_id")
        .or(`winner_id.eq.${user.id},loser_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(5);
      setRecentMatches(lastMatches || []);

      // 6. Discovery — open tournaments
      const { data: openT } = await supabase
        .from("tournaments")
        .select("id, name, start_date, city, state")
        .gte("end_date", now.toISOString())
        .order("start_date", { ascending: true })
        .limit(4);
      setOpenTournaments(openT || []);

      // 7. Discovery — arenas
      const { data: arenas } = await (supabase as any)
        .from("arenas_public")
        .select("id, name, slug, city, state, cover_image_url")
        .limit(4);
      setNearbyArenas(arenas || []);

      setLoading(false);
    };

    fetchAll();
  }, [user]);

  const initials = (athlete?.fullName || "A")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="h-32 rounded-lg bg-muted/40 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-muted/40 animate-pulse" />
          ))}
        </div>
        <div className="h-48 rounded-lg bg-muted/40 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-8 max-w-5xl mx-auto">
      {/* BLOCO 1 — ATHLETE HERO */}
      <section className="space-y-4">
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
          <CardContent className="p-5 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <Avatar className="h-20 w-20 md:h-24 md:w-24 border-4 border-primary/20">
                <AvatarImage src={athlete?.avatarUrl || undefined} alt={athlete?.fullName} />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl md:text-3xl font-bold leading-tight truncate">
                  {athlete?.fullName}
                </h1>
                {athlete?.nickname && (
                  <p className="text-sm text-muted-foreground">@{athlete.nickname}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
                  {athlete?.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {athlete.city}
                    </span>
                  )}
                  {athlete?.team && <span>· {athlete.team}</span>}
                  {athlete?.arena && <span>· {athlete.arena}</span>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-5">
              <KpiPill label="Torneios" value={kpis.tournamentsCount} icon={Trophy} />
              <KpiPill label="Vitórias" value={kpis.wins} icon={Flame} />
              <KpiPill label="Check-ins" value={kpis.checkinsDone} icon={CheckCircle2} />
              <KpiPill
                label="Ranking"
                value={kpis.rankingPosition ? `#${kpis.rankingPosition}` : "—"}
                icon={Medal}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
              <Button asChild className="w-full" size="lg">
                <Link to="/athlete/torneios">
                  <Trophy className="h-4 w-4" />
                  Ver torneios
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full" size="lg">
                <Link to="/athlete/meu-dia">
                  <CheckCircle2 className="h-4 w-4" />
                  Check-in
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full" size="lg">
                <Link to="/athlete/jogos">
                  <Swords className="h-4 w-4" />
                  Meus jogos
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* CAMADA CONVERSACIONAL */}
      <OperationModeBanner profile="athlete" />
      <div className="grid md:grid-cols-2 gap-4">
        <CommandExamplesCard
          title="Pedir pelo WhatsApp"
          subtitle="Atalhos rápidos para sua vida esportiva"
          examples={COMMANDS.athlete}
        />
        <QrEntryCard
          title="Check-in por QR"
          subtitle="Aponte a câmera no QR da arena para confirmar presença"
          ctaTo="/arena/checkin"
          ctaLabel="Abrir scanner"
        />
      </div>
      {user?.id && (
        <CommandHistoryCard
          scope="user"
          scopeId={user.id}
          seeAllHref="/athlete/comandos"
        />
      )}

      {/* BLOCO 2 — MEU ESPORTE HOJE */}
      <section className="space-y-3">
        <SectionHeader
          id="hoje"
          icon={Sun}
          title="Meu dia"
          subtitle="Próximos compromissos esportivos"
        />

        {pendingCheckins.length === 0 && upcomingEnrollments.length === 0 && activeEnrollments.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Nenhum compromisso nos próximos 7 dias. Que tal{" "}
              <Link to="/athlete/torneios" className="text-primary underline underline-offset-2">
                buscar um torneio
              </Link>
              ?
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2">
            {pendingCheckins.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                  <Clock className="h-3.5 w-3.5" />
                  Check-ins pendentes
                </p>
                <div className="space-y-2">
                  {pendingCheckins.map((e) =>
                    e.tournaments ? (
                      <TournamentRow
                        key={e.id}
                        id={e.tournaments.id}
                        name={e.tournaments.name}
                        startDate={e.tournaments.start_date}
                        status="check-in pendente"
                      />
                    ) : null
                  )}
                </div>
              </div>
            )}

            {upcomingEnrollments.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
                  Próximos torneios (7d)
                </p>
                <div className="space-y-2">
                  {upcomingEnrollments.map((e) =>
                    e.tournaments ? (
                      <TournamentRow
                        key={e.id}
                        id={e.tournaments.id}
                        name={e.tournaments.name}
                        startDate={e.tournaments.start_date}
                        paid={e.payment_status === "paid"}
                      />
                    ) : null
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* BLOCO 3 — TORNEIOS E JOGOS */}
      <section className="space-y-3">
        <SectionHeader
          id="jogos"
          icon={Swords}
          title="Torneios e jogos"
          subtitle="Sua vida competitiva"
        />

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                Em andamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {activeEnrollments.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center">
                  Nenhum torneio em andamento.
                </p>
              ) : (
                activeEnrollments.map((e) =>
                  e.tournaments ? (
                    <TournamentRow
                      key={e.id}
                      id={e.tournaments.id}
                      name={e.tournaments.name}
                      startDate={e.tournaments.start_date}
                      status={e.tournaments.status || undefined}
                    />
                  ) : null
                )
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Swords className="h-4 w-4 text-primary" />
                Partidas recentes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentMatches.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center">
                  Nenhuma partida registrada.
                </p>
              ) : (
                recentMatches.map((m) => {
                  const won = m.winner_id === user?.id;
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          className={
                            won
                              ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 border-emerald-500/20"
                              : "bg-muted text-muted-foreground hover:bg-muted"
                          }
                        >
                          {won ? "Vitória" : "Derrota"}
                        </Badge>
                        {m.score && <span className="font-mono">{m.score}</span>}
                      </div>
                      <span className="text-muted-foreground">
                        {new Date(m.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <ShortcutLink to="/athlete/torneios" icon={Trophy} label="Todos os torneios" />
          <ShortcutLink to="/athlete/feed" icon={Rss} label="Feed esportivo" />
        </div>
      </section>

      {/* BLOCO 4 — RANKING E HISTÓRICO */}
      <section className="space-y-3">
        <SectionHeader
          id="historico"
          icon={Medal}
          title="Ranking e histórico"
          subtitle="Sua progressão esportiva"
        />

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Medal className="h-4 w-4 text-primary" />
                Ranking atual
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">
                    {kpis.rankingPosition ? `#${kpis.rankingPosition}` : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {kpis.wins} {kpis.wins === 1 ? "vitória" : "vitórias"}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link to="/athlete/ranking">
                    Ver ranking
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                Atividades recentes
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-72 overflow-y-auto">
              {user && <AthleteActivities athleteId={user.id} />}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* BLOCO 5 — DISCOVERY */}
      <section className="space-y-3">
        <SectionHeader
          id="descobrir"
          icon={Compass}
          title="Descobrir"
          subtitle="Arenas, torneios e atletas"
        />

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                Torneios abertos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {openTournaments.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center">
                  Nenhum torneio aberto agora.
                </p>
              ) : (
                openTournaments.map((t) => (
                  <TournamentRow
                    key={t.id}
                    id={t.id}
                    name={t.name}
                    startDate={t.start_date}
                  />
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Arenas em destaque
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {nearbyArenas.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center">
                  Nenhuma arena disponível.
                </p>
              ) : (
                nearbyArenas.map((a) => (
                  <Link
                    key={a.id}
                    to={`/arenas/${a.slug}`}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{a.name}</p>
                      {(a.city || a.state) && (
                        <p className="text-xs text-muted-foreground truncate">
                          {[a.city, a.state].filter(Boolean).join(", ")}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <ShortcutLink to="/athlete/descobrir" icon={Compass} label="Explorar tudo" />
          <ShortcutLink to="/athlete/feed" icon={Rss} label="Feed" />
          <ShortcutLink to="/marketplace" icon={ShoppingBag} label="Marketplace" />
        </div>
      </section>
    </div>
  );
};

export default AthleteDashboard;
