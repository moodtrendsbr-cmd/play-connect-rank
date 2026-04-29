import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Wallet, AlertCircle } from "lucide-react";
import ProfileHeader from "@/components/profile/ProfileHeader";
import { PostData } from "@/components/feed/PostCard";
import PostSkeleton from "@/components/feed/PostSkeleton";
import PostGrid from "@/components/profile/PostGrid";
import TournamentMemories from "@/components/profile/TournamentMemories";
import GamificationPanel from "@/components/gamification/GamificationPanel";
import { SocialPrivacyToggle } from "@/components/social/SocialPrivacyToggle";
import { WaIdentityPanel } from "@/components/conversational/WaIdentityPanel";

const Profile = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name: "", city: "", state: "", whatsapp: "", bio: "", team: "", arena: "", titles: "", show_contact: false, link: "", gender: "", social_instagram: "", social_facebook: "", social_youtube: "", social_tiktok: "", social_linkedin: "", social_x: "" });
  const [activeTab, setActiveTab] = useState<"posts" | "salvos">("posts");
  const [posts, setPosts] = useState<PostData[]>([]);
  const [savedPosts, setSavedPosts] = useState<PostData[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postsCount, setPostsCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Organizer fields
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [mpCollectorId, setMpCollectorId] = useState("");
  const [savingMp, setSavingMp] = useState(false);
  const [balance, setBalance] = useState(0);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [withdrawDialog, setWithdrawDialog] = useState(false);
  const [withdrawPixKey, setWithdrawPixKey] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);

  const enrichPostsSimple = useCallback(async (rawPosts: any[]): Promise<PostData[]> => {
    if (rawPosts.length === 0) return [];
    const postIds = rawPosts.map((p) => p.id);
    const authorIds = [...new Set(rawPosts.map((p) => p.author_id))];

    const [profilesRes, mediaRes, likesRes, commentsRes, myLikesRes, mySavesRes] = await Promise.all([
      supabase.from("profiles_public").select("user_id, full_name, avatar_url").in("user_id", authorIds),
      supabase.from("post_media").select("*").in("post_id", postIds).order("order_index"),
      supabase.from("likes").select("post_id").in("post_id", postIds),
      supabase.from("comments").select("post_id").in("post_id", postIds),
      user ? supabase.from("likes").select("post_id").in("post_id", postIds).eq("user_id", user.id) : Promise.resolve({ data: [] }),
      user ? supabase.from("post_saves").select("post_id").in("post_id", postIds).eq("user_id", user.id) : Promise.resolve({ data: [] }),
    ]);

    const profileMap: Record<string, any> = {};
    (profilesRes.data || []).forEach((p) => { profileMap[p.user_id] = p; });
    const mediaMap: Record<string, any[]> = {};
    (mediaRes.data || []).forEach((m) => { if (!mediaMap[m.post_id]) mediaMap[m.post_id] = []; mediaMap[m.post_id].push(m); });
    const likesCount: Record<string, number> = {};
    (likesRes.data || []).forEach((l: any) => { likesCount[l.post_id] = (likesCount[l.post_id] || 0) + 1; });
    const commentsCount: Record<string, number> = {};
    (commentsRes.data || []).forEach((c: any) => { commentsCount[c.post_id] = (commentsCount[c.post_id] || 0) + 1; });
    const myLikedSet = new Set((myLikesRes.data || []).map((l: any) => l.post_id));
    const mySavedSet = new Set((mySavesRes.data || []).map((s: any) => s.post_id));

      return rawPosts.map((p) => {
        const prof = profileMap[p.author_id];
        return {
          id: p.id, author_id: p.author_id, author_name: prof?.full_name || "Atleta", author_avatar: prof?.avatar_url || null,
          content: p.content, type: p.type, created_at: p.created_at, media: mediaMap[p.id] || [],
          likes_count: likesCount[p.id] || 0, comments_count: commentsCount[p.id] || 0, top_comments: [],
          liked_by_me: myLikedSet.has(p.id), saved_by_me: mySavedSet.has(p.id),
          pinned_at: (p as any).pinned_at || null,
        };
      });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: p } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
      if (p) {
        setProfile(p);
        setForm({
          full_name: p.full_name || "", city: p.city || "", state: p.state || "", whatsapp: p.whatsapp || "",
          bio: (p as any).bio || "", team: (p as any).team || "", arena: (p as any).arena || "", titles: (p as any).titles || "", show_contact: (p as any).show_contact || false,
          link: (p as any).link || "", gender: (p as any).gender || "",
          social_instagram: (p as any).social_instagram || "", social_facebook: (p as any).social_facebook || "",
          social_youtube: (p as any).social_youtube || "", social_tiktok: (p as any).social_tiktok || "",
          social_linkedin: (p as any).social_linkedin || "", social_x: (p as any).social_x || "",
        });
        setMpCollectorId((p as any).mp_collector_id || "");
      }

      const [followersRes, followingRes, postsCountRes] = await Promise.all([
        supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", user.id),
        supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", user.id),
        supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", user.id),
      ]);
      setFollowersCount(followersRes.count || 0);
      setFollowingCount(followingRes.count || 0);
      setPostsCount(postsCountRes.count || 0);

      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const orgRole = roles?.some((r) => r.role === "organizer");
      setIsOrganizer(!!orgRole);

      if (orgRole) {
        const { data: balances } = await supabase.from("organizer_balances").select("amount").eq("organizer_id", user.id).eq("status", "paid");
        const totalBal = (balances || []).reduce((sum: number, b: any) => sum + Number(b.amount), 0);
        const { data: pendingW } = await supabase.from("withdrawal_requests").select("amount").eq("organizer_id", user.id).in("status", ["pending", "approved"]);
        const pendingTotal = (pendingW || []).reduce((sum: number, w: any) => sum + Number(w.amount), 0);
        setBalance(totalBal - pendingTotal);
        const { data: wList } = await supabase.from("withdrawal_requests").select("*").eq("organizer_id", user.id).order("created_at", { ascending: false });
        setWithdrawals(wList || []);
      }
    };
    fetchData();
  }, [user]);

  // Fetch posts/saved posts when tab changes
  useEffect(() => {
    if (!user) return;
    const fetchTabPosts = async () => {
      setLoadingPosts(true);
      if (activeTab === "posts") {
        const { data } = await supabase.from("posts").select("*").eq("author_id", user.id).order("pinned_at" as any, { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(50);
        const enriched = await enrichPostsSimple(data || []);
        setPosts(enriched);
      } else {
        const { data: saves } = await supabase.from("post_saves").select("post_id").eq("user_id", user.id).order("created_at", { ascending: false });
        if (saves && saves.length > 0) {
          const postIds = saves.map((s) => s.post_id);
          const { data: rawPosts } = await supabase.from("posts").select("*").in("id", postIds);
          const enriched = await enrichPostsSimple(rawPosts || []);
          setSavedPosts(enriched);
        } else {
          setSavedPosts([]);
        }
      }
      setLoadingPosts(false);
    };
    fetchTabPosts();
  }, [user, activeTab, enrichPostsSimple]);

  const handleSave = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update(form as any).eq("user_id", user.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Perfil atualizado!" });
      setProfile({ ...profile, ...form });
      setEditing(false);
    }
  };

  const handleSaveMp = async () => {
    if (!user) return;
    setSavingMp(true);
    const { error } = await supabase.from("profiles").update({ mp_collector_id: mpCollectorId || null } as any).eq("user_id", user.id);
    setSavingMp(false);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else toast({ title: mpCollectorId ? "Conta Mercado Pago vinculada!" : "Conta MP removida." });
  };

  const handleWithdraw = async () => {
    if (!withdrawPixKey || !withdrawAmount) return;
    setWithdrawing(true);
    try {
      const { data, error } = await supabase.functions.invoke("request-withdrawal", { body: { pix_key: withdrawPixKey, amount: Number(withdrawAmount) } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Solicitação de saque enviada!" });
      setWithdrawDialog(false);
      setWithdrawPixKey("");
      setWithdrawAmount("");
      setBalance((prev) => prev - Number(withdrawAmount));
      setWithdrawals((prev) => [{ ...data.withdrawal, status: "pending" }, ...prev]);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setWithdrawing(false);
  };

  const handleLike = async (postId: string) => {
    if (!user) return;
    const allPosts = activeTab === "posts" ? posts : savedPosts;
    const setter = activeTab === "posts" ? setPosts : setSavedPosts;
    const post = allPosts.find((p) => p.id === postId);
    if (!post) return;
    setter((prev) => prev.map((p) => p.id === postId ? { ...p, liked_by_me: !p.liked_by_me, likes_count: p.liked_by_me ? p.likes_count - 1 : p.likes_count + 1 } : p));
    if (post.liked_by_me) await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", user.id);
    else await supabase.from("likes").insert({ user_id: user.id, post_id: postId });
  };

  const handleSavePost = async (postId: string) => {
    if (!user) return;
    const allPosts = activeTab === "posts" ? posts : savedPosts;
    const setter = activeTab === "posts" ? setPosts : setSavedPosts;
    const post = allPosts.find((p) => p.id === postId);
    if (!post) return;
    setter((prev) => prev.map((p) => p.id === postId ? { ...p, saved_by_me: !p.saved_by_me } : p));
    if (post.saved_by_me) await supabase.from("post_saves").delete().eq("post_id", postId).eq("user_id", user.id);
    else await supabase.from("post_saves").insert({ user_id: user.id, post_id: postId });
  };

  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login", { replace: true });
    }
  }, [authLoading, user, navigate]);

  if (authLoading || !user || !profile) return <div className="flex min-h-screen items-center justify-center text-white">Carregando...</div>;

  const statusColors: Record<string, string> = {
    pending: "bg-secondary/20 text-secondary",
    approved: "bg-primary/20 text-primary",
    paid: "bg-primary/20 text-primary",
    rejected: "bg-destructive/20 text-destructive",
  };

  const currentPosts = activeTab === "posts" ? posts : savedPosts;

  return (
    <main className="px-4 py-6 pb-20 max-w-xl mx-auto space-y-6">
      {/* Sign out */}
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={signOut} style={{ color: "#9CA3AF" }}>Sair</Button>
      </div>

      <ProfileHeader
        profileUserId={user!.id}
        currentUserId={user?.id}
        fullName={profile.full_name}
        avatarUrl={profile.avatar_url}
        city={profile.city}
        state={profile.state}
        bio={profile.bio}
        team={profile.team}
        arena={(profile as any).arena}
        titles={profile.titles}
        whatsapp={profile.whatsapp}
        link={profile.link}
        socialLinks={{
          instagram: profile.social_instagram,
          facebook: profile.social_facebook,
          youtube: profile.social_youtube,
          tiktok: profile.social_tiktok,
          linkedin: profile.social_linkedin,
          x: profile.social_x,
        }}
        showContact={profile.show_contact || false}
        postsCount={postsCount}
        followersCount={followersCount}
        followingCount={followingCount}
        isFollowing={false}
        isOwnProfile={true}
        onFollowToggle={() => {}}
        onEditClick={() => setEditing(true)}
        onAvatarUpdate={(url) => setProfile({ ...profile, avatar_url: url })}
      />

      {/* WhatsApp da ORKYM (Phase 12) */}
      <WaIdentityPanel userId={user!.id} />

      {/* Edit form */}
      {editing && (
        <div className="space-y-4 p-4 rounded-xl" style={{ background: "#0B0F12", border: "1px solid rgba(43,255,136,0.1)" }}>
          <div><Label style={{ color: "#9CA3AF" }}>Nome</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="mt-1" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label style={{ color: "#9CA3AF" }}>Cidade</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="mt-1" /></div>
            <div><Label style={{ color: "#9CA3AF" }}>Estado</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="mt-1" /></div>
          </div>
          <div><Label style={{ color: "#9CA3AF" }}>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className="mt-1" /></div>
          <div><Label style={{ color: "#9CA3AF" }}>Bio / Mensagem</Label><Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="mt-1 bg-transparent border-[#9CA3AF]/20 text-white" placeholder="Fale sobre você..." /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label style={{ color: "#9CA3AF" }}>Time</Label><Input value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })} className="mt-1" placeholder="Ex: Estrelas FC" /></div>
            <div><Label style={{ color: "#9CA3AF" }}>Arena</Label><Input value={form.arena} onChange={(e) => setForm({ ...form, arena: e.target.value })} className="mt-1" placeholder="Ex: Arena X" /></div>
          </div>
          <div><Label style={{ color: "#9CA3AF" }}>Títulos conquistados</Label><Input value={form.titles} onChange={(e) => setForm({ ...form, titles: e.target.value })} className="mt-1" placeholder="Ex: Campeão Municipal 2025" /></div>
          <div>
            <Label style={{ color: "#9CA3AF" }}>Gênero <span className="text-xs font-normal">(usado para relatórios)</span></Label>
            <select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Selecione</option>
              <option value="masculino">Masculino</option>
              <option value="feminino">Feminino</option>
              <option value="outro">Outro</option>
              <option value="prefiro_nao_informar">Prefiro não informar</option>
            </select>
          </div>
          <div><Label style={{ color: "#9CA3AF" }}>Link</Label><Input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} className="mt-1" placeholder="https://seusite.com" /></div>
          
          {/* Social Media */}
          <div className="pt-2">
            <Label className="text-sm font-semibold" style={{ color: "#2BFF88" }}>Redes Sociais</Label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label style={{ color: "#9CA3AF" }}>Instagram</Label><Input value={form.social_instagram} onChange={(e) => setForm({ ...form, social_instagram: e.target.value })} className="mt-1" placeholder="@seuusuario" /></div>
            <div><Label style={{ color: "#9CA3AF" }}>Facebook</Label><Input value={form.social_facebook} onChange={(e) => setForm({ ...form, social_facebook: e.target.value })} className="mt-1" placeholder="facebook.com/voce" /></div>
            <div><Label style={{ color: "#9CA3AF" }}>YouTube</Label><Input value={form.social_youtube} onChange={(e) => setForm({ ...form, social_youtube: e.target.value })} className="mt-1" placeholder="youtube.com/@canal" /></div>
            <div><Label style={{ color: "#9CA3AF" }}>TikTok</Label><Input value={form.social_tiktok} onChange={(e) => setForm({ ...form, social_tiktok: e.target.value })} className="mt-1" placeholder="@seuusuario" /></div>
            <div><Label style={{ color: "#9CA3AF" }}>LinkedIn</Label><Input value={form.social_linkedin} onChange={(e) => setForm({ ...form, social_linkedin: e.target.value })} className="mt-1" placeholder="linkedin.com/in/voce" /></div>
            <div><Label style={{ color: "#9CA3AF" }}>X (Twitter)</Label><Input value={form.social_x} onChange={(e) => setForm({ ...form, social_x: e.target.value })} className="mt-1" placeholder="@seuusuario" /></div>
          </div>

          <div className="flex items-center justify-between">
            <Label style={{ color: "#9CA3AF" }}>Mostrar contato no perfil</Label>
            <Switch checked={form.show_contact} onCheckedChange={(v) => setForm({ ...form, show_contact: v })} />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} style={{ background: "#2BFF88", color: "#050708" }}>Salvar</Button>
            <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Gamification */}
      {user && (
        <div>
          <h2 className="text-lg font-display text-white mb-3">Gamificação</h2>
          <GamificationPanel athleteId={user.id} />
        </div>
      )}

      {/* Tournament memories */}
      {user && (
        <div>
          <h2 className="text-lg font-display text-white mb-3">Memórias de torneios</h2>
          <TournamentMemories athleteId={user.id} />
        </div>
      )}

      {/* Social privacy */}
      {user && <SocialPrivacyToggle userId={user.id} />}

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: "rgba(43,255,136,0.1)" }}>
        <button
          className="flex-1 py-3 text-sm font-semibold text-center transition-colors"
          style={{ color: activeTab === "posts" ? "#2BFF88" : "#9CA3AF", borderBottom: activeTab === "posts" ? "2px solid #2BFF88" : "none" }}
          onClick={() => setActiveTab("posts")}
        >
          Posts
        </button>
        <button
          className="flex-1 py-3 text-sm font-semibold text-center transition-colors"
          style={{ color: activeTab === "salvos" ? "#2BFF88" : "#9CA3AF", borderBottom: activeTab === "salvos" ? "2px solid #2BFF88" : "none" }}
          onClick={() => setActiveTab("salvos")}
        >
          Salvos
        </button>
      </div>

      {/* Posts */}
      {loadingPosts ? (
        <><PostSkeleton /><PostSkeleton /></>
      ) : currentPosts.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: "#9CA3AF" }}>
          {activeTab === "posts" ? "Nenhum post ainda" : "Nenhum post salvo"}
        </p>
      ) : (
        <PostGrid posts={currentPosts} userId={user?.id} onLike={handleLike} onSave={handleSavePost} onRefresh={() => {}} />
      )}

      {/* Organizer Section */}
      {isOrganizer && (
        <div className="space-y-4">
          <h2 className="text-2xl font-display text-white">💰 ÁREA DO ORGANIZADOR</h2>

          <Card style={{ background: "#0B0F12", borderColor: "rgba(43,255,136,0.1)" }}>
            <CardHeader><CardTitle className="font-sans text-base flex items-center gap-2 text-white"><Wallet className="h-4 w-4" /> Conta Mercado Pago</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {!mpCollectorId && (
                <div className="flex items-start gap-2 rounded-md p-3 text-sm" style={{ background: "rgba(43,255,136,0.05)", color: "#9CA3AF" }}>
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <p>Vincule sua conta Mercado Pago para receber pagamentos automaticamente. Caso não tenha conta, você pode solicitar saque via PIX.</p>
                </div>
              )}
              <div><Label className="text-xs" style={{ color: "#9CA3AF" }}>Collector ID</Label><Input value={mpCollectorId} onChange={(e) => setMpCollectorId(e.target.value)} placeholder="Ex: 123456789" className="mt-1" /></div>
              <Button size="sm" onClick={handleSaveMp} disabled={savingMp}>{savingMp ? "Salvando..." : "Salvar conta Mercado Pago"}</Button>
            </CardContent>
          </Card>

          <Card style={{ background: "#0B0F12", borderColor: "rgba(43,255,136,0.1)" }}>
            <CardHeader><CardTitle className="font-sans text-base text-white">Saldo disponível</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-3xl font-bold" style={{ color: "#2BFF88" }}>R$ {balance.toFixed(2)}</p>
              {!mpCollectorId && balance > 0 && (
                <div className="flex items-start gap-2 rounded-md p-3 text-sm" style={{ background: "rgba(255,193,7,0.08)", color: "#FFC107" }}>
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <p>Sem conta Mercado Pago vinculada. Solicite saque via PIX abaixo.</p>
                </div>
              )}
              {balance > 0 && (
                <Dialog open={withdrawDialog} onOpenChange={setWithdrawDialog}>
                  <DialogTrigger asChild><Button>Solicitar Saque via PIX</Button></DialogTrigger>
                  <DialogContent><DialogHeader><DialogTitle>Solicitar Saque via PIX</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div><Label>Valor (máx R$ {balance.toFixed(2)})</Label><Input type="number" max={balance} value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="0.00" className="mt-1" /></div>
                      <div><Label>Chave PIX</Label><Input value={withdrawPixKey} onChange={(e) => setWithdrawPixKey(e.target.value)} placeholder="CPF, email, telefone ou chave aleatória" className="mt-1" /></div>
                      <Button onClick={handleWithdraw} disabled={withdrawing} className="w-full">{withdrawing ? "Enviando..." : "Confirmar Saque"}</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardContent>
          </Card>

          {withdrawals.length > 0 && (
            <Card style={{ background: "#0B0F12", borderColor: "rgba(43,255,136,0.1)" }}>
              <CardHeader><CardTitle className="font-sans text-base text-white">Histórico de saques</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {withdrawals.map((w) => (
                  <div key={w.id} className="flex items-center justify-between rounded-lg p-3" style={{ borderWidth: 1, borderColor: "rgba(43,255,136,0.1)" }}>
                    <div><p className="text-sm font-medium text-white">R$ {Number(w.amount).toFixed(2)}</p><p className="text-xs" style={{ color: "#9CA3AF" }}>{new Date(w.created_at).toLocaleDateString("pt-BR")}</p></div>
                    <Badge className={statusColors[w.status] || ""}>{w.status === "pending" ? "Pendente" : w.status === "approved" ? "Aprovado" : w.status === "paid" ? "Pago" : "Rejeitado"}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </main>
  );
};

export default Profile;
