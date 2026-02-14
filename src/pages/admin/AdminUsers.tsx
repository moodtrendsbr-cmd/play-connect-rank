import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

interface UserRow {
  user_id: string;
  full_name: string;
  city: string | null;
  state: string | null;
  whatsapp: string | null;
  mp_collector_id: string | null;
  role: string;
}

const AdminUsers = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const fetchUsers = async () => {
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, city, state, whatsapp, mp_collector_id");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");

    const roleMap: Record<string, string> = {};
    (roles || []).forEach((r) => { roleMap[r.user_id] = r.role; });

    setUsers((profiles || []).map((p) => ({ ...p, role: roleMap[p.user_id] || "athlete" })));
  };

  useEffect(() => { fetchUsers(); }, []);

  const changeRole = async (userId: string, currentRole: string, newRole: string) => {
    if (currentRole === newRole) return;

    // Check if role record exists
    const { data: existing } = await supabase.from("user_roles").select("id").eq("user_id", userId).maybeSingle();

    if (existing) {
      await supabase.from("user_roles").update({ role: newRole as any }).eq("user_id", userId);
    } else {
      await supabase.from("user_roles").insert({ user_id: userId, role: newRole as any });
    }

    toast({ title: "Role atualizada", description: `Usuário atualizado para ${newRole}` });
    fetchUsers();
  };

  const filtered = users.filter((u) => {
    const matchSearch = u.full_name.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div>
      <h1 className="mb-6 text-4xl font-display text-foreground">GERENCIAR USUÁRIOS</h1>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="font-sans text-lg">Usuários ({filtered.length})</CardTitle>
            <div className="flex gap-2">
              <Input placeholder="Buscar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-48" />
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="organizer">Organizador</SelectItem>
                  <SelectItem value="athlete">Atleta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>MP</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                  <TableCell>{u.city ? `${u.city}/${u.state}` : "—"}</TableCell>
                  <TableCell>{u.whatsapp || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === "admin" ? "default" : u.role === "organizer" ? "secondary" : "outline"}>
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell>{u.mp_collector_id ? "✅" : "—"}</TableCell>
                  <TableCell>
                    <Select value={u.role} onValueChange={(v) => changeRole(u.user_id, u.role, v)}>
                      <SelectTrigger className="h-8 w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="athlete">Atleta</SelectItem>
                        <SelectItem value="organizer">Organizador</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUsers;
