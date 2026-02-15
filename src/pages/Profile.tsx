import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Wallet, AlertCircle } from "lucide-react";

const Profile = () => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ tournaments: 0, wins: 0, rank: 0 });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name: "", city: "", state: "", whatsapp: "" });

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

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: p } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
      if (p) {
        setProfile(p);
        setForm({ full_name: p.full_name || "", city: p.city || "", state: p.state || "", whatsapp: p.whatsapp || "" });
        setMpCollectorId((p as any).mp_collector_id || "");
      }

      const { count: tourns } = await supabase.from("enrollments").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "paid");
      const { count: wins } = await supabase.from("match_results").select("*", { count: "exact", head: true }).eq("winner_id", user.id);
      setStats({ tournaments: tourns || 0, wins: wins || 0, rank: 0 });

      // Check if organizer
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const orgRole = roles?.some((r) => r.role === "organizer");
      setIsOrganizer(!!orgRole);

      if (orgRole) {
        // Fetch balance
        const { data: balances } = await supabase
          .from("organizer_balances")
          .select("amount")
          .eq("organizer_id", user.id)
          .eq("status", "paid");
        const totalBal = (balances || []).reduce((sum: number, b: any) => sum + Number(b.amount), 0);

        // Subtract pending withdrawals
        const { data: pendingW } = await supabase
          .from("withdrawal_requests")
          .select("amount")
          .eq("organizer_id", user.id)
          .in("status", ["pending", "approved"]);
        const pendingTotal = (pendingW || []).reduce((sum: number, w: any) => sum + Number(w.amount), 0);

        setBalance(totalBal - pendingTotal);

        // Fetch withdrawal history
        const { data: wList } = await supabase
          .from("withdrawal_requests")
          .select("*")
          .eq("organizer_id", user.id)
          .order("created_at", { ascending: false });
        setWithdrawals(wList || []);
      }
    };
    fetchData();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update(form).eq("user_id", user.id);
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
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: mpCollectorId ? "Conta Mercado Pago vinculada!" : "Conta MP removida." });
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawPixKey || !withdrawAmount) return;
    setWithdrawing(true);
    try {
      const { data, error } = await supabase.functions.invoke("request-withdrawal", {
        body: { pix_key: withdrawPixKey, amount: Number(withdrawAmount) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Solicitação de saque enviada!" });
      setWithdrawDialog(false);
      setWithdrawPixKey("");
      setWithdrawAmount("");
      // Refresh
      setBalance((prev) => prev - Number(withdrawAmount));
      setWithdrawals((prev) => [{ ...data.withdrawal, status: "pending" }, ...prev]);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setWithdrawing(false);
  };

  if (!profile) return <div className="flex min-h-screen items-center justify-center bg-background text-foreground">Carregando...</div>;

  const statusColors: Record<string, string> = {
    pending: "bg-secondary/20 text-secondary",
    approved: "bg-primary/20 text-primary",
    paid: "bg-primary/20 text-primary",
    rejected: "bg-destructive/20 text-destructive",
  };

  return (
    <main className="px-4 py-6 pb-20 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-display" style={{ color: "#fff" }}>{profile.full_name || "Atleta"}</h1>
        <Button variant="ghost" onClick={signOut} style={{ color: "#9CA3AF" }}>Sair</Button>
      </div>
      {profile.city && <p className="text-sm mb-4" style={{ color: "#9CA3AF" }}>📍 {profile.city} - {profile.state}</p>}

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card style={{ background: "#0B0F12", borderColor: "rgba(43,255,136,0.1)" }}><CardContent className="pt-4 text-center"><p className="text-2xl font-bold" style={{ color: "#fff" }}>#{stats.rank || "—"}</p><p className="text-xs" style={{ color: "#9CA3AF" }}>Ranking</p></CardContent></Card>
        <Card style={{ background: "#0B0F12", borderColor: "rgba(43,255,136,0.1)" }}><CardContent className="pt-4 text-center"><p className="text-2xl font-bold" style={{ color: "#fff" }}>{stats.tournaments}</p><p className="text-xs" style={{ color: "#9CA3AF" }}>Torneios</p></CardContent></Card>
        <Card style={{ background: "#0B0F12", borderColor: "rgba(43,255,136,0.1)" }}><CardContent className="pt-4 text-center"><p className="text-2xl font-bold" style={{ color: "#2BFF88" }}>{stats.wins}</p><p className="text-xs" style={{ color: "#9CA3AF" }}>Vitórias</p></CardContent></Card>
      </div>

      {editing ? (
        <div className="space-y-4">
          <div><Label style={{ color: "#9CA3AF" }}>Nome</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="mt-1" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label style={{ color: "#9CA3AF" }}>Cidade</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="mt-1" /></div>
            <div><Label style={{ color: "#9CA3AF" }}>Estado</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="mt-1" /></div>
          </div>
          <div><Label style={{ color: "#9CA3AF" }}>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className="mt-1" /></div>
          <div className="flex gap-2">
            <Button onClick={handleSave}>Salvar</Button>
            <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <Button className="mb-6" variant="outline" onClick={() => setEditing(true)}>Editar perfil</Button>
      )}

      {/* Organizer Section */}
      {isOrganizer && (
        <div className="mt-6 space-y-4">
          <h2 className="text-2xl font-display" style={{ color: "#fff" }}>💰 ÁREA DO ORGANIZADOR</h2>

          <Card style={{ background: "#0B0F12", borderColor: "rgba(43,255,136,0.1)" }}>
            <CardHeader>
              <CardTitle className="font-sans text-base flex items-center gap-2" style={{ color: "#fff" }}>
                <Wallet className="h-4 w-4" /> Conta Mercado Pago
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!mpCollectorId && (
                <div className="flex items-start gap-2 rounded-md p-3 text-sm" style={{ background: "rgba(43,255,136,0.05)", color: "#9CA3AF" }}>
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <p>Vincule sua conta MP para receber pagamentos automaticamente.</p>
                </div>
              )}
              <div>
                <Label className="text-xs" style={{ color: "#9CA3AF" }}>Collector ID</Label>
                <Input value={mpCollectorId} onChange={(e) => setMpCollectorId(e.target.value)} placeholder="Ex: 123456789" className="mt-1" />
              </div>
              <Button size="sm" onClick={handleSaveMp} disabled={savingMp}>
                {savingMp ? "Salvando..." : "Salvar conta MP"}
              </Button>
            </CardContent>
          </Card>

          <Card style={{ background: "#0B0F12", borderColor: "rgba(43,255,136,0.1)" }}>
            <CardHeader><CardTitle className="font-sans text-base" style={{ color: "#fff" }}>Saldo disponível</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-3xl font-bold" style={{ color: "#2BFF88" }}>R$ {balance.toFixed(2)}</p>
              {balance > 0 && (
                <Dialog open={withdrawDialog} onOpenChange={setWithdrawDialog}>
                  <DialogTrigger asChild><Button>Solicitar Saque via PIX</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Solicitar Saque</DialogTitle></DialogHeader>
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
              <CardHeader><CardTitle className="font-sans text-base" style={{ color: "#fff" }}>Histórico de saques</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {withdrawals.map((w) => (
                  <div key={w.id} className="flex items-center justify-between rounded-lg p-3" style={{ borderWidth: 1, borderColor: "rgba(43,255,136,0.1)" }}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: "#fff" }}>R$ {Number(w.amount).toFixed(2)}</p>
                      <p className="text-xs" style={{ color: "#9CA3AF" }}>{new Date(w.created_at).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <Badge className={statusColors[w.status] || ""}>
                      {w.status === "pending" ? "Pendente" : w.status === "approved" ? "Aprovado" : w.status === "paid" ? "Pago" : "Rejeitado"}
                    </Badge>
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
