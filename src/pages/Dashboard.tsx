import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Users, Clock, DollarSign, Plus, LogOut, Shield, GitBranch } from "lucide-react";

const Dashboard = () => {
  const { user, userRole, signOut } = useAuth();
  const [stats, setStats] = useState({ tournaments: 0, enrolled: 0, confirmed: 0, pending: 0, balance: 0 });
  const [tournaments, setTournaments] = useState<any[]>([]);

  useEffect(() => {
    if (!user || userRole === "admin") return;

    const fetchData = async () => {
      if (userRole === "organizer") {
        const { data: tourns } = await supabase
          .from("tournaments")
          .select("*, enrollments(*)")
          .eq("organizer_id", user.id);

        if (tourns) {
          setTournaments(tourns);
          const allEnrollments = tourns.flatMap((t: any) => t.enrollments || []);
          setStats({
            tournaments: tourns.length,
            enrolled: allEnrollments.length,
            confirmed: allEnrollments.filter((e: any) => e.status === "paid").length,
            pending: allEnrollments.filter((e: any) => e.status === "pending").length,
            balance: allEnrollments
              .filter((e: any) => e.status === "pending")
              .reduce((sum: number, e: any) => {
                const tourn = tourns.find((t: any) => t.id === e.tournament_id);
                return sum + (tourn?.entry_fee || 0);
              }, 0),
          });
        }
      } else {
        const { data: enrollments } = await supabase
          .from("enrollments")
          .select("*, tournaments(*)")
          .eq("user_id", user.id);

        if (enrollments) {
          setTournaments(enrollments.map((e: any) => ({ ...e.tournaments, enrollment: e })));
          setStats({
            tournaments: enrollments.length,
            enrolled: enrollments.length,
            confirmed: enrollments.filter((e: any) => e.status === "paid").length,
            pending: enrollments.filter((e: any) => e.status === "pending").length,
            balance: 0,
          });
        }
      }
    };

    fetchData();
  }, [user, userRole]);

  // Redirect admin to admin panel (after all hooks)
  if (userRole === "admin") return <Navigate to="/admin" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="text-2xl font-display text-primary text-glow">🏐 MOOD PLAY</Link>
          <div className="flex items-center gap-4">
            <Link to="/feed" className="text-sm text-muted-foreground hover:text-foreground">Feed</Link>
            <Link to="/ranking" className="text-sm text-muted-foreground hover:text-foreground">Ranking</Link>
            <Link to="/profile" className="text-sm text-muted-foreground hover:text-foreground">Perfil</Link>
            {userRole === "admin" && (
              <Link to="/admin" className="text-sm text-primary font-medium hover:text-primary/80 flex items-center gap-1">
                <Shield className="h-4 w-4" /> Admin
              </Link>
            )}
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-4xl font-display text-foreground">
            {userRole === "organizer" ? "DASHBOARD ORGANIZADOR" : "MEUS TORNEIOS"}
          </h1>
          {userRole === "organizer" && (
            <Button asChild>
              <Link to="/tournaments/create">
                <Plus className="mr-2 h-4 w-4" /> Criar Torneio
              </Link>
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium font-sans">Torneios</CardTitle>
              <Trophy className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.tournaments}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium font-sans">Inscritos</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.enrolled}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium font-sans">Confirmados</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.confirmed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium font-sans">
                {userRole === "organizer" ? "Saldo pendente" : "Pendentes"}
              </CardTitle>
              {userRole === "organizer" ? <DollarSign className="h-4 w-4 text-secondary" /> : <Clock className="h-4 w-4 text-secondary" />}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-secondary">
                {userRole === "organizer" ? `R$ ${stats.balance.toFixed(2)}` : stats.pending}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tournament List */}
        <h2 className="mb-4 text-2xl font-display text-foreground">
          {userRole === "organizer" ? "MEUS TORNEIOS" : "TORNEIOS INSCRITOS"}
        </h2>
        {tournaments.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              {userRole === "organizer" ? "Nenhum torneio criado ainda." : "Você ainda não está inscrito em nenhum torneio."}
            </p>
            <Button className="mt-4" asChild>
              <Link to={userRole === "organizer" ? "/tournaments/create" : "/tournaments"}>
                {userRole === "organizer" ? "Criar primeiro torneio" : "Ver torneios disponíveis"}
              </Link>
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((t: any) => (
              <Card key={t.id} className="overflow-hidden hover:border-primary/40 transition-colors">
                <CardHeader>
                  <CardTitle className="font-sans text-lg">{t.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">📍 {t.city} - {t.state}</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm">📅 {t.start_date}</p>
                  <p className="text-sm">💰 R$ {Number(t.entry_fee).toFixed(2)}</p>
                  <div className="flex gap-2 mt-2">
                    <Button className="flex-1" variant="outline" asChild>
                      <Link to={userRole === "organizer" ? `/tournaments/${t.id}/manage` : `/tournaments/${t.id}`}>
                        {userRole === "organizer" ? "Gerenciar" : "Ver detalhes"}
                      </Link>
                    </Button>
                    <Button variant="outline" size="icon" asChild title="Chaveamentos">
                      <Link to={`/tournaments/${t.id}/brackets`}>
                        <GitBranch className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
