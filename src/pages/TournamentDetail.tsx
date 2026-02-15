import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

const TournamentDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<any>(null);
  const [enrollmentCount, setEnrollmentCount] = useState(0);
  const [alreadyEnrolled, setAlreadyEnrolled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("tournaments").select("*").eq("id", id).single();
      setTournament(data);

      const { count } = await supabase.from("enrollments").select("*", { count: "exact", head: true }).eq("tournament_id", id!);
      setEnrollmentCount(count || 0);

      if (user) {
        const { data: enrollment } = await supabase
          .from("enrollments")
          .select("id")
          .eq("tournament_id", id!)
          .eq("user_id", user.id)
          .maybeSingle();
        setAlreadyEnrolled(!!enrollment);
      }
    };
    if (id) fetch();
  }, [id, user]);

  const handleEnroll = () => {
    if (!user) {
      navigate("/login");
      return;
    }
    navigate(`/payment/${id}`);
  };

  if (!tournament) return <div className="flex min-h-screen items-center justify-center bg-background text-foreground">Carregando...</div>;

  const available = tournament.max_slots - enrollmentCount;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-16 items-center">
          <Link to="/tournaments" className="text-2xl font-display text-primary text-glow">🏐 MOOD PLAY</Link>
        </div>
      </header>

      <main className="container max-w-2xl py-8 pb-24">
        <h1 className="text-4xl font-display text-foreground">🏐 {tournament.name}</h1>

        <div className="mt-6 space-y-3 text-foreground">
          <p>📍 {tournament.city} - {tournament.state}</p>
          <p>📅 {tournament.start_date} a {tournament.end_date}</p>
          <p>💰 R$ {Number(tournament.entry_fee).toFixed(2)}</p>
          <p>🎟 Vagas disponíveis: {available > 0 ? available : 0}</p>
        </div>

        {tournament.rules && (
          <Card className="mt-6">
            <CardContent className="pt-6">
              <h3 className="font-sans font-bold mb-2">Regulamento</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{tournament.rules}</p>
            </CardContent>
          </Card>
        )}

        <div className="mt-6 rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          Ao se inscrever, sua vaga fica reservada por {tournament.payment_deadline_days} dias.
          A confirmação acontece automaticamente após pagamento.
        </div>

        <div className="mt-8">
          {alreadyEnrolled ? (
            <Button className="w-full h-14 text-lg font-bold" asChild>
              <Link to={`/payment/${id}`}>Continuar para pagamento</Link>
            </Button>
          ) : available <= 0 ? (
            <Button disabled className="w-full h-14 text-lg">Vagas esgotadas</Button>
          ) : (
            <Button onClick={handleEnroll} className="w-full h-14 text-lg font-bold box-glow">
              🟢 Inscrever-se
            </Button>
          )}
        </div>
      </main>
    </div>
  );
};

export default TournamentDetail;
