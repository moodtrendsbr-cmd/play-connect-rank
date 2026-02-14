import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

const Profile = () => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ tournaments: 0, wins: 0, rank: 0 });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name: "", city: "", state: "", whatsapp: "" });

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: p } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
      if (p) {
        setProfile(p);
        setForm({ full_name: p.full_name || "", city: p.city || "", state: p.state || "", whatsapp: p.whatsapp || "" });
      }

      const { count: tourns } = await supabase.from("enrollments").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "paid");
      const { count: wins } = await supabase.from("match_results").select("*", { count: "exact", head: true }).eq("winner_id", user.id);

      setStats({ tournaments: tourns || 0, wins: wins || 0, rank: 0 });
    };
    fetch();
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

  if (!profile) return <div className="flex min-h-screen items-center justify-center bg-background text-foreground">Carregando...</div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/dashboard" className="text-2xl font-display text-primary text-glow">🏐 MOOD PLAY</Link>
          <Button variant="ghost" onClick={signOut}>Sair</Button>
        </div>
      </header>

      <main className="container max-w-lg py-8">
        <h1 className="text-4xl font-display text-foreground">{profile.full_name || "Atleta"}</h1>
        {profile.city && <p className="text-muted-foreground mt-1">📍 {profile.city} - {profile.state}</p>}

        <div className="mt-6 grid grid-cols-3 gap-4">
          <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">#{stats.rank || "—"}</p><p className="text-xs text-muted-foreground">Ranking</p></CardContent></Card>
          <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{stats.tournaments}</p><p className="text-xs text-muted-foreground">Torneios</p></CardContent></Card>
          <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-primary">{stats.wins}</p><p className="text-xs text-muted-foreground">Vitórias</p></CardContent></Card>
        </div>

        {editing ? (
          <div className="mt-8 space-y-4">
            <div><Label>Nome</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Cidade</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="mt-1" /></div>
              <div><Label>Estado</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="mt-1" /></div>
            </div>
            <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className="mt-1" /></div>
            <div className="flex gap-2">
              <Button onClick={handleSave}>Salvar</Button>
              <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <Button className="mt-8" variant="outline" onClick={() => setEditing(true)}>Editar perfil</Button>
        )}
      </main>
    </div>
  );
};

export default Profile;
