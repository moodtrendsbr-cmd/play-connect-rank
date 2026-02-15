import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Mail, Filter } from "lucide-react";

interface PoolEntry {
  id: string;
  user_id: string;
  match_type: string;
  category: string;
  level: string;
  position: string | null;
  availability: string | null;
  bio: string | null;
  status: string;
  profile?: { full_name: string; avatar_url: string | null };
}

const TournamentMatch = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [myEntry, setMyEntry] = useState<any>(null);
  const [pool, setPool] = useState<PoolEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [tournament, setTournament] = useState<any>(null);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  // Filters
  const [filterType, setFilterType] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const [form, setForm] = useState({
    match_type: "dupla",
    category: "misto",
    level: "iniciante",
    position: "",
    availability: "",
    bio: "",
  });

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      const { data: t } = await supabase.from("tournaments").select("*").eq("id", id).single();
      setTournament(t);

      if (user) {
        const { data: entry } = await supabase
          .from("tournament_match_pool")
          .select("*")
          .eq("tournament_id", id)
          .eq("user_id", user.id)
          .maybeSingle();
        setMyEntry(entry);

        const { data: reqs } = await supabase
          .from("match_requests")
          .select("to_user_id")
          .eq("tournament_id", id)
          .eq("from_user_id", user.id)
          .eq("status", "pending");
        setSentRequests(new Set((reqs || []).map((r: any) => r.to_user_id)));
      }

      // Fetch pool
      const { data: poolData } = await supabase
        .from("tournament_match_pool")
        .select("*")
        .eq("tournament_id", id)
        .eq("status", "looking");

      if (poolData && poolData.length > 0) {
        const userIds = poolData.map((p: any) => p.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", userIds);
        const profileMap: Record<string, any> = {};
        (profiles || []).forEach((p) => { profileMap[p.user_id] = p; });
        setPool(
          poolData
            .filter((p: any) => p.user_id !== user?.id)
            .map((p: any) => ({ ...p, profile: profileMap[p.user_id] }))
        );
      } else {
        setPool([]);
      }
      setLoading(false);
    };
    load();
  }, [id, user]);

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;
    setCreating(true);
    const { error } = await supabase.from("tournament_match_pool").insert({
      tournament_id: id,
      user_id: user.id,
      match_type: form.match_type,
      category: form.category,
      level: form.level,
      position: form.position || null,
      availability: form.availability || null,
      bio: form.bio || null,
    } as any);
    setCreating(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Perfil criado!" });
      window.location.reload();
    }
  };

  const handleInvite = async (toUserId: string) => {
    if (!user || !id) return;
    const { error } = await supabase.from("match_requests").insert({
      tournament_id: id,
      from_user_id: user.id,
      to_user_id: toUserId,
    } as any);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setSentRequests((prev) => new Set(prev).add(toUserId));
      toast({ title: "Convite enviado!" });
    }
  };

  const getInitials = (name: string) =>
    name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  const filteredPool = pool.filter((p) => {
    if (filterType && p.match_type !== filterType) return false;
    if (filterLevel && p.level !== filterLevel) return false;
    if (filterCategory && p.category !== filterCategory) return false;
    return true;
  });

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background text-foreground">Carregando...</div>;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <Link to={`/tournaments/${id}`} className="p-1">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </Link>
        <h1 className="text-lg font-display text-foreground">MATCH</h1>
        <div className="ml-auto">
          <Link to={`/tournaments/${id}/match/requests`}>
            <Button variant="ghost" size="sm" className="text-primary">
              <Mail className="h-4 w-4 mr-1" /> Convites
            </Button>
          </Link>
        </div>
      </div>

      <main className="max-w-xl mx-auto px-4 py-6">
        {!myEntry ? (
          <>
            <h2 className="text-xl font-display text-foreground mb-4">Criar seu perfil de Match</h2>
            <form onSubmit={handleCreateProfile} className="space-y-4">
              <div>
                <Label>Tipo de Match</Label>
                <Select value={form.match_type} onValueChange={(v) => setForm({ ...form, match_type: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dupla">Dupla</SelectItem>
                    <SelectItem value="trio">Trio</SelectItem>
                    <SelectItem value="quarteto">Quarteto</SelectItem>
                    <SelectItem value="time">Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Categoria</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masc">Masculino</SelectItem>
                      <SelectItem value="fem">Feminino</SelectItem>
                      <SelectItem value="misto">Misto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nível</Label>
                  <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="iniciante">Iniciante</SelectItem>
                      <SelectItem value="intermediario">Intermediário</SelectItem>
                      <SelectItem value="avancado">Avançado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Posição (opcional)</Label>
                <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className="mt-1" placeholder="Ex: Levantador, Líbero..." />
              </div>
              <div>
                <Label>Disponibilidade</Label>
                <Input value={form.availability} onChange={(e) => setForm({ ...form, availability: e.target.value })} className="mt-1" placeholder="Ex: Sábados de manhã" />
              </div>
              <div>
                <Label>Bio (opcional)</Label>
                <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="mt-1" rows={3} placeholder="Fale sobre você..." />
              </div>
              <Button type="submit" disabled={creating} className="w-full h-12 text-lg font-bold">
                {creating ? "Criando..." : "🟢 Entrar no Match"}
              </Button>
            </form>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Filtros:</span>
            </div>
            <div className="flex gap-2 mb-6 flex-wrap">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dupla">Dupla</SelectItem>
                  <SelectItem value="trio">Trio</SelectItem>
                  <SelectItem value="quarteto">Quarteto</SelectItem>
                  <SelectItem value="time">Time</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterLevel} onValueChange={setFilterLevel}>
                <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Nível" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="iniciante">Iniciante</SelectItem>
                  <SelectItem value="intermediario">Intermediário</SelectItem>
                  <SelectItem value="avancado">Avançado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="masc">Masculino</SelectItem>
                  <SelectItem value="fem">Feminino</SelectItem>
                  <SelectItem value="misto">Misto</SelectItem>
                </SelectContent>
              </Select>
              {(filterType || filterLevel || filterCategory) && (
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setFilterType(""); setFilterLevel(""); setFilterCategory(""); }}>
                  Limpar
                </Button>
              )}
            </div>

            <h2 className="text-lg font-display text-foreground mb-4">
              Atletas procurando parceiros ({filteredPool.length})
            </h2>

            {filteredPool.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Nenhum atleta encontrado.</p>
            ) : (
              <div className="space-y-3">
                {filteredPool.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-xl p-4 border border-border bg-card"
                    style={{ boxShadow: "0 0 12px rgba(43,255,136,0.05)" }}
                  >
                    <div className="flex items-start gap-3">
                      {entry.profile?.avatar_url ? (
                        <img src={entry.profile.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                      ) : (
                        <div className="h-12 w-12 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "rgba(43,255,136,0.15)", color: "hsl(var(--primary))" }}>
                          {getInitials(entry.profile?.full_name || "A")}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{entry.profile?.full_name || "Atleta"}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{entry.match_type}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{entry.level}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{entry.category}</span>
                          {entry.position && <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{entry.position}</span>}
                        </div>
                        {entry.bio && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{entry.bio}</p>}
                      </div>
                      <Button
                        size="sm"
                        disabled={sentRequests.has(entry.user_id)}
                        onClick={() => handleInvite(entry.user_id)}
                        className="shrink-0"
                      >
                        {sentRequests.has(entry.user_id) ? "Enviado" : "Convidar"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default TournamentMatch;
