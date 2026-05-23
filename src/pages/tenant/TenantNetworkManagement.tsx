import { useEffect, useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UsersRound, Plus, Loader2, Trash2, Shield, Building2 } from "lucide-react";
import { EmptyState } from "@/components/tenant/EmptyState";
import { toast } from "@/hooks/use-toast";

type Member = {
  id: string;
  user_id: string;
  role: "owner" | "admin" | "member" | string;
  created_at: string;
  profile?: { display_name: string | null; email: string | null; avatar_url: string | null } | null;
};

const ROLE_LABEL: Record<string, string> = {
  owner: "Dono da rede",
  admin: "Gestor",
  member: "Organizador",
};

export default function TenantNetworkManagement() {
  const { tenant } = useTenant();
  const [members, setMembers] = useState<Member[]>([]);
  const [arenasCount, setArenasCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ email: "", role: "admin" });

  const load = async () => {
    if (!tenant?.id) return;
    setLoading(true);
    const [m, a] = await Promise.all([
      supabase
        .from("tenant_memberships")
        .select("id, user_id, role, created_at")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: true }),
      supabase.from("arenas").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
    ]);
    const baseList = (m.data ?? []) as Member[];
    if (baseList.length > 0) {
      const userIds = baseList.map((x) => x.user_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, email, avatar_url")
        .in("user_id", userIds);
      const profMap = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
      baseList.forEach((mem) => { mem.profile = (profMap.get(mem.user_id) as any) ?? null; });
    }
    setMembers(baseList);
    setArenasCount(a.count ?? 0);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tenant?.id]);

  const handleAdd = async () => {
    if (!tenant?.id || !form.email.trim()) return;
    setSaving(true);
    const { data: prof } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("email", form.email.trim().toLowerCase())
      .maybeSingle();
    if (!prof?.user_id) {
      setSaving(false);
      toast({ title: "Usuário não encontrado", description: "Esse e-mail ainda não tem cadastro na plataforma.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("tenant_memberships").insert({
      tenant_id: tenant.id,
      user_id: prof.user_id,
      role: form.role,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Membro adicionado à rede" });
    setForm({ email: "", role: "admin" });
    setOpen(false);
    load();
  };

  const handleRemove = async (id: string, role: string) => {
    if (role === "owner") { toast({ title: "Dono da rede não pode ser removido", variant: "destructive" }); return; }
    if (!confirm("Remover este membro da rede?")) return;
    const { error } = await supabase.from("tenant_memberships").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Removido" }); load(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl text-foreground flex items-center gap-2">
            <UsersRound className="h-6 w-6 text-primary" /> Gestão da rede
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Pessoas que ajudam a operar sua rede esportiva: donos, gestores e organizadores.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Adicionar pessoa</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Adicionar à rede</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>E-mail da pessoa</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="nome@exemplo.com"
                />
                <p className="text-[11px] text-muted-foreground mt-1">A pessoa precisa ter cadastro na plataforma.</p>
              </div>
              <div>
                <Label>Papel na rede</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Gestor — gerencia rede, arenas e eventos</SelectItem>
                    <SelectItem value="member">Organizador — cria e opera eventos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAdd} disabled={saving || !form.email.trim()} className="w-full">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Adicionar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Pessoas na rede</p>
          <p className="text-2xl font-semibold tabular-nums">{members.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Shield className="h-3 w-3" /> Gestores</p>
          <p className="text-2xl font-semibold tabular-nums">{members.filter(m => m.role === "owner" || m.role === "admin").length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="h-3 w-3" /> Arenas vinculadas</p>
          <p className="text-2xl font-semibold tabular-nums">{arenasCount}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Membros</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-24 bg-muted/30 animate-pulse rounded" />
          ) : members.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              title="Sua rede ainda é só você"
              description="Adicione gestores para administrar a rede e organizadores para criar eventos."
              ctaLabel="Adicionar pessoa"
              onCta={() => setOpen(true)}
            />
          ) : (
            <ul className="divide-y divide-border">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-3 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0 overflow-hidden">
                      {m.profile?.avatar_url ? (
                        <img src={m.profile.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        (m.profile?.display_name ?? m.profile?.email ?? "?").slice(0, 1).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{m.profile?.display_name ?? m.profile?.email ?? m.user_id.slice(0, 8)}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{m.profile?.email ?? "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-[10px]">{ROLE_LABEL[m.role] ?? m.role}</Badge>
                    {m.role !== "owner" && (
                      <button onClick={() => handleRemove(m.id, m.role)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
