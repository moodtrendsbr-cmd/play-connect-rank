import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import ModalityCard from "@/components/brackets/ModalityCard";
import ModalityDetail from "@/components/brackets/ModalityDetail";

const isValidUUID = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);

const Brackets = () => {
  const { id } = useParams();
  const { user, userRole } = useAuth();
  const [tournament, setTournament] = useState<any>(null);
  const [modalities, setModalities] = useState<any[]>([]);
  const [selectedModality, setSelectedModality] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModality, setShowAddModality] = useState(false);
  const [newModalityName, setNewModalityName] = useState("");
  const [newModalityType, setNewModalityType] = useState("dupla");

  const isOrganizer = !!(user && tournament && (tournament.organizer_id === user.id || userRole === "admin"));

  const fetchModalities = async () => {
    const { data } = await supabase
      .from("tournament_modalities")
      .select("*")
      .eq("tournament_id", id!)
      .order("created_at");

    const mods = data || [];

    // Get entry counts
    if (mods.length > 0) {
      const modIds = mods.map((m) => m.id);
      const { data: entries } = await supabase
        .from("modality_entries")
        .select("id, modality_id")
        .in("modality_id", modIds);

      const countMap: Record<string, number> = {};
      (entries || []).forEach((e) => {
        countMap[e.modality_id] = (countMap[e.modality_id] || 0) + 1;
      });

      mods.forEach((m: any) => { m.entryCount = countMap[m.id] || 0; });
    }

    setModalities(mods);
  };

  useEffect(() => {
    const fetch = async () => {
      if (!id || !isValidUUID(id)) {
        setLoading(false);
        return;
      }
      const { data: t } = await supabase.from("tournaments").select("*").eq("id", id).maybeSingle();
      setTournament(t);
      if (t) await fetchModalities();
      setLoading(false);
    };
    fetch();
  }, [id]);

  const addModality = async () => {
    if (!newModalityName.trim()) {
      toast({ title: "Erro", description: "Nome da modalidade é obrigatório.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("tournament_modalities").insert({
      tournament_id: id!,
      name: newModalityName.trim(),
      type: newModalityType,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Modalidade adicionada! 🏐" });
    setNewModalityName("");
    setShowAddModality(false);
    await fetchModalities();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <div className="container flex h-16 items-center gap-4">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-40" />
          </div>
        </header>
        <main className="container py-8">
          <Skeleton className="h-10 w-48 mb-6" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground gap-4">
        <p className="text-lg text-muted-foreground">Torneio não encontrado.</p>
        <Button asChild><Link to="/tournaments">Voltar</Link></Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-16 items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/tournaments/${id}`} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
          </Button>
          <span className="text-xl font-display text-primary text-glow">🏐 MOOD PLAY</span>
        </div>
      </header>

      <main className="container py-8">
        <AnimatePresence mode="wait">
          {selectedModality ? (
            <ModalityDetail
              key="detail"
              modality={selectedModality}
              tournamentId={id!}
              isOrganizer={isOrganizer}
              onBack={() => {
                setSelectedModality(null);
                fetchModalities();
              }}
            />
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="mb-2">
                <h1 className="text-4xl font-display text-foreground">CHAVEAMENTOS</h1>
                <p className="text-muted-foreground">{tournament.name}</p>
                {tournament.city && (
                  <p className="text-xs text-muted-foreground mt-1">
                    📍 {tournament.city}{tournament.state ? `, ${tournament.state}` : ""}
                    {tournament.start_date && ` • ${new Date(tournament.start_date).toLocaleDateString("pt-BR")}`}
                  </p>
                )}
              </div>

              {isOrganizer && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddModality(true)}
                  className="mb-6 gap-2"
                >
                  <Plus className="h-4 w-4" /> Adicionar Modalidade
                </Button>
              )}

              {modalities.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <p className="text-lg">Nenhuma modalidade cadastrada.</p>
                  {isOrganizer && (
                    <p className="text-sm mt-2">Adicione uma modalidade para começar.</p>
                  )}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {modalities.map((mod) => (
                    <ModalityCard
                      key={mod.id}
                      modality={mod}
                      onClick={() => setSelectedModality(mod)}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Dialog open={showAddModality} onOpenChange={setShowAddModality}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Nova Modalidade</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Nome</label>
              <Input
                placeholder="Ex: Dupla Mista"
                value={newModalityName}
                onChange={(e) => setNewModalityName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Tipo</label>
              <Select value={newModalityType} onValueChange={setNewModalityType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="dupla">Dupla</SelectItem>
                  <SelectItem value="trio">Trio</SelectItem>
                  <SelectItem value="equipe">Equipe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={addModality} className="w-full box-glow">
              Criar Modalidade
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Brackets;
