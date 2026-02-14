import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

const AdminEnrollments = () => {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [selectedTournament, setSelectedTournament] = useState("");
  const [enrollments, setEnrollments] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("tournaments").select("id, name").order("created_at", { ascending: false }).then(({ data }) => {
      setTournaments(data || []);
    });
  }, []);

  useEffect(() => {
    if (!selectedTournament) { setEnrollments([]); return; }
    const fetch = async () => {
      const { data } = await supabase
        .from("enrollments")
        .select("*")
        .eq("tournament_id", selectedTournament)
        .order("created_at", { ascending: false });

      // Get profile names for user_ids
      const userIds = (data || []).map((e) => e.user_id).filter(Boolean);
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds.length ? userIds : ["none"]);
      const nameMap: Record<string, string> = {};
      (profiles || []).forEach((p) => { nameMap[p.user_id] = p.full_name; });

      setEnrollments((data || []).map((e) => ({ ...e, profile_name: nameMap[e.user_id || ""] || e.athlete_name || "—" })));
    };
    fetch();
  }, [selectedTournament]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("enrollments").update({ status: status as any }).eq("id", id);
    toast({ title: `Inscrição atualizada para ${status}` });
    setSelectedTournament((prev) => prev); // trigger refetch
    // refetch
    const { data } = await supabase.from("enrollments").select("*").eq("tournament_id", selectedTournament).order("created_at", { ascending: false });
    const userIds = (data || []).map((e) => e.user_id).filter(Boolean);
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds.length ? userIds : ["none"]);
    const nameMap: Record<string, string> = {};
    (profiles || []).forEach((p) => { nameMap[p.user_id] = p.full_name; });
    setEnrollments((data || []).map((e) => ({ ...e, profile_name: nameMap[e.user_id || ""] || e.athlete_name || "—" })));
  };

  const deleteEnrollment = async (id: string) => {
    if (!confirm("Excluir esta inscrição?")) return;
    await supabase.from("enrollments").delete().eq("id", id);
    toast({ title: "Inscrição excluída" });
    setSelectedTournament((prev) => { /* force refetch */ return prev; });
  };

  const statusColor = (s: string) => s === "paid" ? "default" : s === "pending" ? "secondary" : "outline";

  return (
    <div>
      <h1 className="mb-6 text-4xl font-display text-foreground">GERENCIAR INSCRIÇÕES</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-sans text-lg">Selecione um Torneio</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedTournament} onValueChange={setSelectedTournament}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Escolha o torneio..." />
            </SelectTrigger>
            <SelectContent>
              {tournaments.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedTournament && (
        <Card>
          <CardHeader>
            <CardTitle className="font-sans text-lg">Inscrições ({enrollments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Atleta</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollments.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.profile_name}</TableCell>
                    <TableCell>{e.athlete_email || "—"}</TableCell>
                    <TableCell>{e.athlete_whatsapp || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={statusColor(e.status)}>{e.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{new Date(e.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {e.status !== "paid" && (
                          <Button size="sm" variant="outline" onClick={() => updateStatus(e.id, "paid")}>
                            Confirmar
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteEnrollment(e.id)}>
                          Excluir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {enrollments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">Nenhuma inscrição encontrada.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminEnrollments;
