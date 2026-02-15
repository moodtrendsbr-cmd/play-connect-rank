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
    <main className="px-4 py-6 pb-20 max-w-3xl mx-auto">
      <h1 className="mb-6 text-3xl font-display" style={{ color: "#fff" }}>TORNEIOS DISPONÍVEIS</h1>

      {loading ? (
        <p style={{ color: "#9CA3AF" }}>Carregando...</p>
      ) : tournaments.length === 0 ? (
        <Card className="p-8 text-center" style={{ background: "#0B0F12", borderColor: "rgba(43,255,136,0.1)" }}>
          <p style={{ color: "#9CA3AF" }}>Nenhum torneio disponível no momento.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {tournaments.map((t) => {
            const enrolled = t.enrollments?.[0]?.count || 0;
            const available = t.max_slots - enrolled;
            return (
              <Card key={t.id} className="overflow-hidden" style={{ background: "#0B0F12", borderColor: "rgba(43,255,136,0.1)" }}>
                <CardHeader>
                  <CardTitle className="font-sans text-lg" style={{ color: "#fff" }}>🏐 {t.name}</CardTitle>
                  <p className="text-sm" style={{ color: "#9CA3AF" }}>📍 {t.city} - {t.state}</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm" style={{ color: "#9CA3AF" }}>📅 {t.start_date}</p>
                  <p className="text-sm" style={{ color: "#9CA3AF" }}>💰 R$ {Number(t.entry_fee).toFixed(2)}</p>
                  <p className="text-sm" style={{ color: "#9CA3AF" }}>🎟 Vagas: {available > 0 ? available : 0}</p>
                  <Button className="w-full mt-3" asChild>
                    <Link to={`/tournaments/${t.id}`}>Ver detalhes</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
};

export default Tournaments;
