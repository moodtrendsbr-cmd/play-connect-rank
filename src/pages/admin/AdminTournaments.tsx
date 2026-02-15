import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Trash2, Eye, Settings, GitBranch, Trophy } from "lucide-react";

const AdminTournaments = () => {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  const fetchTournaments = async () => {
    const { data: tourns } = await supabase
      .from("tournaments")
      .select("*, enrollments(id, status)")
      .order("created_at", { ascending: false });

    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name");
    const nameMap: Record<string, string> = {};
    (profiles || []).forEach((p) => { nameMap[p.user_id] = p.full_name; });

    setTournaments((tourns || []).map((t) => ({
      ...t,
      organizer_name: nameMap[t.organizer_id] || "—",
      enrolled: (t.enrollments || []).length,
      paid: (t.enrollments || []).filter((e: any) => e.status === "paid").length,
    })));
  };

  useEffect(() => { fetchTournaments(); }, []);

  const deleteTournament = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este torneio?")) return;
    await supabase.from("tournaments").delete().eq("id", id);
    toast({ title: "Torneio excluído" });
    fetchTournaments();
  };

  const today = new Date().toISOString().split("T")[0];
  const filtered = tournaments.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.organizer_name.toLowerCase().includes(search.toLowerCase()) ||
    t.city.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <h1 className="mb-6 text-4xl font-display text-foreground">GERENCIAR TORNEIOS</h1>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="font-sans text-lg">Torneios ({filtered.length})</CardTitle>
            <Input placeholder="Buscar torneio, organizador, cidade..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-72" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Organizador</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Datas</TableHead>
                <TableHead>Vagas</TableHead>
                <TableHead>Inscritos</TableHead>
                <TableHead>Taxa</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{t.organizer_name}</TableCell>
                  <TableCell>{t.city}/{t.state}</TableCell>
                  <TableCell className="text-xs">{t.start_date} a {t.end_date}</TableCell>
                  <TableCell>{t.max_slots}</TableCell>
                  <TableCell>{t.paid}/{t.enrolled}</TableCell>
                  <TableCell>R$ {Number(t.entry_fee).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={t.end_date >= today ? "default" : "outline"}>
                      {t.end_date >= today ? "Ativo" : "Encerrado"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/tournaments/${t.id}`}><Eye className="h-4 w-4" /></Link>
                      </Button>
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/tournaments/${t.id}/manage`}><Settings className="h-4 w-4" /></Link>
                      </Button>
                      <Button variant="ghost" size="icon" asChild title="Chaveamento">
                        <Link to={`/tournaments/${t.id}/brackets`}><GitBranch className="h-4 w-4" /></Link>
                      </Button>
                      <Button variant="ghost" size="icon" asChild title="Resultados">
                        <Link to={`/tournaments/${t.id}/results`}><Trophy className="h-4 w-4" /></Link>
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteTournament(t.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
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

export default AdminTournaments;
