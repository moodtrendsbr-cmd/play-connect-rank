import { useEffect, useState } from "react";
import { useTenant, useIsTenantOwner } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Role = "owner" | "admin" | "staff" | "member";

interface MemberRow {
  user_id: string;
  role: Role;
  full_name?: string | null;
  avatar_url?: string | null;
}

const OrganizerMembers = () => {
  const { tenant } = useTenant();
  const isOwner = useIsTenantOwner();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUserId, setNewUserId] = useState("");
  const [newRole, setNewRole] = useState<Role>("member");

  const load = async () => {
    if (!tenant) return;
    setLoading(true);
    const { data } = await supabase
      .from("tenant_memberships")
      .select("user_id, role")
      .eq("tenant_id", tenant.id);

    if (!data) { setMembers([]); setLoading(false); return; }

    const userIds = data.map((m) => m.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url")
      .in("user_id", userIds);

    const profMap = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);
    setMembers(
      data.map((m) => ({
        user_id: m.user_id,
        role: m.role as Role,
        full_name: profMap.get(m.user_id)?.full_name,
        avatar_url: profMap.get(m.user_id)?.avatar_url,
      }))
    );
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tenant?.id]);

  const updateRole = async (user_id: string, role: Role) => {
    if (!tenant) return;
    const { error } = await supabase
      .from("tenant_memberships")
      .update({ role })
      .eq("tenant_id", tenant.id)
      .eq("user_id", user_id);
    if (error) toast.error(error.message);
    else { toast.success("Papel atualizado"); load(); }
  };

  const removeMember = async (user_id: string) => {
    if (!tenant) return;
    if (!confirm("Remover este membro?")) return;
    const { error } = await supabase
      .from("tenant_memberships")
      .delete()
      .eq("tenant_id", tenant.id)
      .eq("user_id", user_id);
    if (error) toast.error(error.message);
    else { toast.success("Membro removido"); load(); }
  };

  const addMember = async () => {
    if (!tenant || !newUserId.trim()) return;
    const { error } = await supabase
      .from("tenant_memberships")
      .insert({ tenant_id: tenant.id, user_id: newUserId.trim(), role: newRole });
    if (error) toast.error(error.message);
    else { toast.success("Membro adicionado"); setNewUserId(""); load(); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Membros</h1>
        <p className="text-sm text-muted-foreground">Gerencie quem tem acesso ao organizador</p>
      </div>

      {isOwner && (
        <Card>
          <CardHeader><CardTitle>Adicionar membro</CardTitle></CardHeader>
          <CardContent className="flex flex-col md:flex-row gap-2">
            <Input placeholder="User ID (UUID)" value={newUserId} onChange={(e) => setNewUserId(e.target.value)} className="flex-1" />
            <Select value={newRole} onValueChange={(v) => setNewRole(v as Role)}>
              <SelectTrigger className="w-full md:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={addMember}>Adicionar</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Membros atuais ({members.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhum membro encontrado</p>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.user_id} className="flex items-center justify-between p-3 rounded-md border border-border">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {m.avatar_url ? (
                      <img src={m.avatar_url} className="w-8 h-8 rounded-full" alt="" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-muted" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{m.full_name || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">{m.user_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOwner ? (
                      <Select value={m.role} onValueChange={(v) => updateRole(m.user_id, v as Role)}>
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="owner">Owner</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-sm text-muted-foreground capitalize">{m.role}</span>
                    )}
                    {isOwner && (
                      <Button variant="ghost" size="icon" onClick={() => removeMember(m.user_id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OrganizerMembers;
