import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { MapPin, Calendar, Users, Trophy, Search } from "lucide-react";
import SponsorTournamentDialog from "@/components/sponsorship/SponsorTournamentDialog";

const MarketplaceTournaments = () => {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTournament, setSelectedTournament] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [enrollmentCounts, setEnrollmentCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Fetch company owned by user
      if (user) {
        const { data: comp } = await supabase
          .from("companies")
          .select("*")
          .eq("owner_user_id", user.id)
          .eq("status", "approved")
          .maybeSingle();
        setCompany(comp);
      }

      // Fetch tournaments (future + active)
      const today = new Date().toISOString().split("T")[0];
      const { data: tourneys } = await supabase
        .from("tournaments")
        .select("*")
        .gte("end_date", today)
        .eq("is_public", true)
        .order("start_date", { ascending: true });

      setTournaments(tourneys || []);

      // Fetch enrollment counts
      if (tourneys && tourneys.length > 0) {
        const ids = tourneys.map((t) => t.id);
        const { data: enrollments } = await supabase
          .from("enrollments")
          .select("tournament_id")
          .in("tournament_id", ids);

        const counts: Record<string, number> = {};
        (enrollments || []).forEach((e) => {
          counts[e.tournament_id] = (counts[e.tournament_id] || 0) + 1;
        });
        setEnrollmentCounts(counts);
      }

      setLoading(false);
    };
    fetchData();
  }, [user]);

  const filtered = tournaments.filter((t) => {
    const q = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.city.toLowerCase().includes(q) ||
      t.state.toLowerCase().includes(q) ||
      (t.arena || "").toLowerCase().includes(q)
    );
  });

  if (!company) {
    return (
      <div className="container max-w-2xl py-8">
        <h1 className="text-4xl font-display text-foreground mb-4">PATROCINAR TORNEIOS</h1>
        <p className="text-muted-foreground">
          Você precisa ter uma empresa aprovada para patrocinar torneios.
        </p>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-8 pb-24">
      <h1 className="text-4xl font-display text-foreground mb-2">🏆 PATROCINAR TORNEIOS</h1>
      <p className="text-muted-foreground mb-6">
        Escolha torneios e aumente a visibilidade da sua marca
      </p>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por cidade, nome ou arena..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando torneios...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">Nenhum torneio disponível no momento.</p>
      ) : (
        <div className="space-y-4">
          {filtered.map((t) => {
            const enrolled = enrollmentCounts[t.id] || 0;
            return (
              <Card key={t.id} className="overflow-hidden border-border hover:border-primary/30 transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display text-xl text-foreground truncate">{t.name}</h3>
                      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                        <p className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          {t.arena ? `${t.arena} — ` : ""}{t.city}/{t.state}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 shrink-0" />
                          {t.start_date} a {t.end_date}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 shrink-0" />
                          {enrolled}/{t.max_slots} atletas
                        </p>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          R$ {Number(t.entry_fee).toFixed(2)}
                        </Badge>
                        {t.modality && (
                          <Badge variant="outline" className="text-xs">{t.modality}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    className="w-full mt-4 h-11 font-bold box-glow"
                    onClick={() => setSelectedTournament(t)}
                  >
                    <Trophy className="h-4 w-4 mr-2" />
                    Patrocinar este torneio
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {selectedTournament && company && (
        <SponsorTournamentDialog
          open={!!selectedTournament}
          onOpenChange={(open) => !open && setSelectedTournament(null)}
          tournament={selectedTournament}
          company={company}
          onSuccess={() => {
            setSelectedTournament(null);
            toast({ title: "Patrocínio solicitado!", description: "Aguarde aprovação do administrador." });
          }}
        />
      )}
    </div>
  );
};

export default MarketplaceTournaments;
