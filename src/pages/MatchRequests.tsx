import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Check, X } from "lucide-react";

interface RequestWithProfile {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: string;
  profile?: { full_name: string; avatar_url: string | null };
}

const MatchRequests = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [received, setReceived] = useState<RequestWithProfile[]>([]);
  const [sent, setSent] = useState<RequestWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const getInitials = (name: string) =>
    name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  useEffect(() => {
    if (!user || !id) return;
    const load = async () => {
      setLoading(true);
      const [recRes, sentRes] = await Promise.all([
        supabase.from("match_requests").select("*").eq("tournament_id", id).eq("to_user_id", user.id),
        supabase.from("match_requests").select("*").eq("tournament_id", id).eq("from_user_id", user.id),
      ]);

      const allUserIds = new Set<string>();
      (recRes.data || []).forEach((r: any) => allUserIds.add(r.from_user_id));
      (sentRes.data || []).forEach((r: any) => allUserIds.add(r.to_user_id));

      let profileMap: Record<string, any> = {};
      if (allUserIds.size > 0) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", Array.from(allUserIds));
        (profiles || []).forEach((p) => { profileMap[p.user_id] = p; });
      }

      setReceived((recRes.data || []).map((r: any) => ({ ...r, profile: profileMap[r.from_user_id] })));
      setSent((sentRes.data || []).map((r: any) => ({ ...r, profile: profileMap[r.to_user_id] })));
      setLoading(false);
    };
    load();
  }, [user, id]);

  const handleAccept = async (request: RequestWithProfile) => {
    if (!user || !id) return;
    try {
      // 1. Update request
      await supabase.from("match_requests").update({ status: "accepted" } as any).eq("id", request.id);

      // 2. Create pair
      const { data: pair } = await supabase.from("match_pairs").insert({ tournament_id: id, match_type: "dupla" } as any).select().single();
      if (!pair) throw new Error("Erro ao criar parceria");

      // 3. Add members
      await supabase.from("match_pair_members").insert([
        { pair_id: pair.id, user_id: user.id },
        { pair_id: pair.id, user_id: request.from_user_id },
      ] as any);

      // 4. Update pool status
      await supabase.from("tournament_match_pool").update({ status: "matched" } as any).eq("tournament_id", id).eq("user_id", user.id);
      await supabase.from("tournament_match_pool").update({ status: "matched" } as any).eq("tournament_id", id).eq("user_id", request.from_user_id);

      // 5. Create conversation
      const { data: conv } = await supabase.from("match_conversations").insert({ pair_id: pair.id, tournament_id: id } as any).select().single();
      if (conv) {
        await supabase.from("match_conversation_members").insert([
          { conversation_id: conv.id, user_id: user.id },
          { conversation_id: conv.id, user_id: request.from_user_id },
        ] as any);
      }

      toast({ title: "Parceria formada! 🎉" });
      navigate(`/tournaments/${id}/match/pair`);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleReject = async (requestId: string) => {
    await supabase.from("match_requests").update({ status: "rejected" } as any).eq("id", requestId);
    setReceived((prev) => prev.map((r) => r.id === requestId ? { ...r, status: "rejected" } : r));
    toast({ title: "Convite recusado" });
  };

  const statusLabel = (s: string) => {
    if (s === "pending") return <span className="text-xs text-yellow-400">Pendente</span>;
    if (s === "accepted") return <span className="text-xs text-primary">Aceito</span>;
    return <span className="text-xs text-destructive">Recusado</span>;
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background text-foreground">Carregando...</div>;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <Link to={`/tournaments/${id}/match`} className="p-1">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </Link>
        <h1 className="text-lg font-display text-foreground">CONVITES</h1>
      </div>

      <main className="max-w-xl mx-auto px-4 py-4">
        <Tabs defaultValue="received">
          <TabsList className="w-full">
            <TabsTrigger value="received" className="flex-1">Recebidos ({received.length})</TabsTrigger>
            <TabsTrigger value="sent" className="flex-1">Enviados ({sent.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="received" className="mt-4 space-y-3">
            {received.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Nenhum convite recebido.</p>
            ) : received.map((r) => (
              <div key={r.id} className="rounded-xl p-4 border border-border bg-card flex items-center gap-3">
                {r.profile?.avatar_url ? (
                  <img src={r.profile.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "rgba(43,255,136,0.15)", color: "hsl(var(--primary))" }}>
                    {getInitials(r.profile?.full_name || "A")}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{r.profile?.full_name || "Atleta"}</p>
                  {statusLabel(r.status)}
                </div>
                {r.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="icon" variant="ghost" className="text-primary" onClick={() => handleAccept(r)}>
                      <Check className="h-5 w-5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleReject(r.id)}>
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </TabsContent>

          <TabsContent value="sent" className="mt-4 space-y-3">
            {sent.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Nenhum convite enviado.</p>
            ) : sent.map((r) => (
              <div key={r.id} className="rounded-xl p-4 border border-border bg-card flex items-center gap-3">
                {r.profile?.avatar_url ? (
                  <img src={r.profile.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "rgba(43,255,136,0.15)", color: "hsl(var(--primary))" }}>
                    {getInitials(r.profile?.full_name || "A")}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{r.profile?.full_name || "Atleta"}</p>
                  {statusLabel(r.status)}
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default MatchRequests;
