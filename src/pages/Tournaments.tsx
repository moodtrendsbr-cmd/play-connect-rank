import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const Tournaments = () => {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("tournaments")
        .select("*, enrollments(count)")
        .eq("is_public", true)
        .order("start_date", { ascending: true });
      setTournaments(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="text-2xl font-display text-primary text-glow">🏐 MOOD PLAY</Link>
          <div className="flex items-center gap-4">
            <Link to="/login"><Button variant="ghost">Entrar</Button></Link>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <h1 className="mb-8 text-4xl font-display text-foreground">TORNEIOS DISPONÍVEIS</h1>

        {loading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : tournaments.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Nenhum torneio disponível no momento.</p>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((t) => {
              const enrolled = t.enrollments?.[0]?.count || 0;
              const available = t.max_slots - enrolled;
              return (
                <Card key={t.id} className="overflow-hidden hover:border-primary/40 transition-colors">
                  <CardHeader>
                    <CardTitle className="font-sans text-xl">🏐 {t.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">📍 {t.city} - {t.state}</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm">📅 {t.start_date}</p>
                    <p className="text-sm">💰 R$ {Number(t.entry_fee).toFixed(2)}</p>
                    <p className="text-sm">🎟 Vagas disponíveis: {available > 0 ? available : 0}</p>
                    <Button className="w-full mt-4" asChild>
                      <Link to={`/tournaments/${t.id}`}>Ver detalhes</Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Tournaments;
