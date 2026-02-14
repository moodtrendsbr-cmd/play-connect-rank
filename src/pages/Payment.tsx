import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { CheckCircle } from "lucide-react";

const Payment = () => {
  const { id } = useParams(); // tournament id
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [tournament, setTournament] = useState<any>(null);
  const [enrollment, setEnrollment] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);

  // Check if returning from Mercado Pago
  const mpStatus = searchParams.get("status");
  const mpPaymentId = searchParams.get("payment_id");

  useEffect(() => {
    const fetch = async () => {
      const { data: t } = await supabase.from("tournaments").select("*").eq("id", id).single();
      setTournament(t);

      if (user) {
        const { data: e } = await supabase
          .from("enrollments")
          .select("*")
          .eq("tournament_id", id!)
          .eq("user_id", user.id)
          .maybeSingle();
        setEnrollment(e);

        if (e?.status === "paid") setPaymentStatus("approved");
      }
    };
    if (id) fetch();
  }, [id, user]);

  useEffect(() => {
    // Handle return from Mercado Pago
    if (mpStatus === "approved" && mpPaymentId && enrollment) {
      setPaymentStatus("approved");
      // Update enrollment
      supabase
        .from("enrollments")
        .update({ status: "paid", payment_id: mpPaymentId })
        .eq("id", enrollment.id);
    } else if (mpStatus) {
      setPaymentStatus(mpStatus);
    }
  }, [mpStatus, mpPaymentId, enrollment]);

  const handlePayment = async () => {
    if (!user || !tournament || !enrollment) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("create-payment", {
        body: {
          tournament_id: tournament.id,
          tournament_name: tournament.name,
          entry_fee: tournament.entry_fee,
          enrollment_id: enrollment.id,
          user_email: user.email,
        },
      });

      if (error) throw error;

      if (data?.init_point) {
        window.location.href = data.init_point;
      } else {
        throw new Error("URL de pagamento não recebida");
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }

    setLoading(false);
  };

  if (!tournament) return <div className="flex min-h-screen items-center justify-center bg-background text-foreground">Carregando...</div>;

  if (paymentStatus === "approved") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center space-y-6 max-w-md">
          <CheckCircle className="h-20 w-20 text-primary mx-auto" />
          <h1 className="text-4xl font-display text-foreground">INSCRIÇÃO CONFIRMADA</h1>
          <p className="text-muted-foreground">Pagamento aprovado. Você está inscrito no torneio!</p>
          <div className="flex flex-col gap-3">
            <Button asChild><Link to="/feed">Ir para Feed</Link></Button>
            <Button variant="outline" asChild><Link to="/profile">Ver Perfil</Link></Button>
            <Button variant="outline" asChild><Link to={`/tournaments/${id}`}>Ver Torneio</Link></Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-16 items-center">
          <Link to="/" className="text-2xl font-display text-primary text-glow">🏐 MOOD PLAY</Link>
        </div>
      </header>

      <main className="container max-w-md py-8">
        <h1 className="mb-8 text-4xl font-display text-foreground">PAGAMENTO</h1>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Torneio:</span>
              <span className="font-bold">{tournament.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor:</span>
              <span className="text-2xl font-bold text-primary">R$ {Number(tournament.entry_fee).toFixed(2)}</span>
            </div>
            {enrollment?.expires_at && (
              <p className="text-sm text-muted-foreground">
                Sua vaga está reservada até: {new Date(enrollment.expires_at).toLocaleDateString("pt-BR")}
              </p>
            )}
          </CardContent>
        </Card>

        <Button
          onClick={handlePayment}
          disabled={loading || !enrollment}
          className="w-full mt-6 h-14 text-lg font-bold box-glow"
        >
          {loading ? "Redirecionando..." : "🟢 Pagar com Mercado Pago"}
        </Button>

        {paymentStatus === "failure" && (
          <p className="mt-4 text-center text-destructive">Pagamento falhou. Tente novamente.</p>
        )}
        {paymentStatus === "pending" && (
          <p className="mt-4 text-center text-secondary">Pagamento pendente. Aguardando confirmação.</p>
        )}
      </main>
    </div>
  );
};

export default Payment;
