import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageCircle, CreditCard } from "lucide-react";

const MatchPair = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pair, setPair] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [tournament, setTournament] = useState<any>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const getInitials = (name: string) =>
    name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  useEffect(() => {
    if (!user || !id) return;
    const load = async () => {
      setLoading(true);

      // Find pair for this user in this tournament
      const { data: myMemberships } = await supabase.from("match_pair_members").select("pair_id").eq("user_id", user.id);
      if (!myMemberships || myMemberships.length === 0) { setLoading(false); return; }

      const pairIds = myMemberships.map((m: any) => m.pair_id);
      const { data: pairs } = await supabase.from("match_pairs").select("*").in("id", pairIds).eq("tournament_id", id);
      if (!pairs || pairs.length === 0) { setLoading(false); return; }

      const myPair = pairs[0];
      setPair(myPair);

      // Get members
      const { data: pairMembers } = await supabase.from("match_pair_members").select("user_id").eq("pair_id", myPair.id);
      const userIds = (pairMembers || []).map((m: any) => m.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", userIds);
      setMembers(profiles || []);

      // Get tournament
      const { data: t } = await supabase.from("tournaments").select("name, city, state, start_date, entry_fee").eq("id", id).single();
      setTournament(t);

      // Get conversation
      const { data: convs } = await supabase.from("match_conversations").select("id").eq("pair_id", myPair.id);
      if (convs && convs.length > 0) setConversationId(convs[0].id);

      setLoading(false);
    };
    load();
  }, [user, id]);

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background text-foreground">Carregando...</div>;

  if (!pair) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <p className="text-muted-foreground mb-4">Você ainda não tem uma parceria neste torneio.</p>
        <Button asChild><Link to={`/tournaments/${id}/match`}>Ir para o Match</Link></Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <Link to={`/tournaments/${id}/match`} className="p-1">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </Link>
        <h1 className="text-lg font-display text-foreground">PARCERIA</h1>
      </div>

      <main className="max-w-xl mx-auto px-4 py-6 space-y-6">
        {tournament && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="font-display text-foreground text-lg">🏐 {tournament.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">📍 {tournament.city} - {tournament.state}</p>
            <p className="text-sm text-muted-foreground">📅 {tournament.start_date}</p>
            <p className="text-sm text-muted-foreground">💰 R$ {Number(tournament.entry_fee).toFixed(2)}</p>
          </div>
        )}

        <div>
          <h3 className="font-display text-foreground mb-3">Membros da parceria</h3>
          <div className="space-y-3">
            {members.map((m) => (
              <div key={m.user_id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "rgba(43,255,136,0.15)", color: "hsl(var(--primary))" }}>
                    {getInitials(m.full_name || "A")}
                  </div>
                )}
                <p className="font-semibold text-foreground">{m.full_name}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {conversationId && (
            <Button className="w-full h-12" variant="outline" onClick={() => navigate(`/tournaments/${id}/match/chat/${conversationId}`)}>
              <MessageCircle className="h-5 w-5 mr-2" /> Chat da parceria
            </Button>
          )}
          <Button className="w-full h-14 text-lg font-bold" onClick={() => navigate(`/payment/${id}`)}>
            <CreditCard className="h-5 w-5 mr-2" /> Inscrever dupla/time
          </Button>
        </div>
      </main>
    </div>
  );
};

export default MatchPair;
