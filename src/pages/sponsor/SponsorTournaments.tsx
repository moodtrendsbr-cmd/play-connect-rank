import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { MapPin, Calendar, Users, Trophy, Search } from "lucide-react";
import SponsorTournamentDialog from "@/components/sponsorship/SponsorTournamentDialog";

const SponsorTournaments = () => {
  const { company } = useOutletContext<{ company: any }>();
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedTournament, setSelectedTournament] = useState<any>(null);
  const [enrollmentCounts, setEnrollmentCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: tourneys } = await supabase
        .from("tournaments")
        .select("*")
        .eq("is_public", true)
        .order("start_date", { ascending: true });
      setTournaments(tourneys || []);

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
  }, []);

  const today = new Date().toISOString().split("T")[0];

  const filtered = tournaments.filter((t) => {
    const q = search.toLowerCase();
    const matchSearch =
      t.name.toLowerCase().includes(q) ||
      t.city.toLowerCase().includes(q) ||
      (t.arena || "").toLowerCase().includes(q);

    let matchStatus = true;
    if (statusFilter === "upcoming") matchStatus = t.start_date > today;
    else if (statusFilter === "ongoing") matchStatus = t.start_date <= today && t.end_date >= today;
    else if (statusFilter === "finished") matchStatus = t.end_date < today;

    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl text-foreground">TORNEIOS DISPONÍVEIS</h1>
        <p className="text-muted-foreground text-sm mt-1">Escolha torneios para patrocinar sua marca</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cidade, nome ou arena..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="upcoming">Próximos</SelectItem>
            <SelectItem value="ongoing">Em andamento</SelectItem>
            <SelectItem value="finished">Finalizados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Carregando torneios...</p>
      ) : filtered.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="p-8 text-center">
            <Trophy className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Nenhum torneio encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => {
            const enrolled = enrollmentCounts[t.id] || 0;
            const isOngoing = t.start_date <= today && t.end_date >= today;
            const isFinished = t.end_date < today;
            return (
              <Card key={t.id} className="border-border bg-card hover:border-primary/20 transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-xl text-foreground truncate">{t.name}</h3>
                        {isOngoing && <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">Em andamento</Badge>}
                        {isFinished && <Badge variant="secondary" className="text-[10px]">Finalizado</Badge>}
                      </div>
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
                      {t.modality && (
                        <Badge variant="outline" className="text-xs mt-2">{t.modality}</Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    className="w-full mt-4 h-11 font-bold box-glow"
                    onClick={() => setSelectedTournament(t)}
                  >
                    <Trophy className="h-4 w-4 mr-2" />
                    Patrocinar
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

export default SponsorTournaments;
