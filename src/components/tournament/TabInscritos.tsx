import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, MessageCircle, Bell, Trash2, Search } from "lucide-react";
import EmptyState from "./EmptyState";
import { toast } from "@/hooks/use-toast";

interface Props {
  tournamentId: string;
  canManage: boolean;
  onDivulgar?: () => void;
}

interface Row {
  id: string;
  user_id: string | null;
  athlete_name: string | null;
  status: string;
  amount_paid: number | null;
  checked_in_at: string | null;
  modality_id: string | null;
  entry_id: string | null;
  created_at: string;
}

interface ProfileLite {
  full_name: string | null;
  whatsapp: string | null;
}

const statusLabel = (s: string) => {
  if (s === "paid") return { label: "Pago", className: "bg-primary/20 text-primary" };
  if (s === "pending") return { label: "Pendente", className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" };
  if (s === "expired") return { label: "Expirado", className: "bg-destructive/15 text-destructive border-destructive/30" };
  return { label: s, className: "bg-muted text-muted-foreground" };
};

export default function TabInscritos({ tournamentId, canManage, onDivulgar }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, ProfileLite>>({});
  const [modalityMap, setModalityMap] = useState<Record<string, string>>({});
  const [entryMembersMap, setEntryMembersMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "paid" | "pending" | "expired">("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("enrollments")
      .select("id, user_id, athlete_name, status, amount_paid, checked_in_at, modality_id, entry_id, created_at")
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: false });
    const list = (data || []) as Row[];
    setRows(list);

    const userIds = [...new Set(list.map((r) => r.user_id).filter(Boolean) as string[])];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, whatsapp")
        .in("user_id", userIds);
      const pmap: Record<string, ProfileLite> = {};
      (profiles || []).forEach((p: any) => {
        pmap[p.user_id] = { full_name: p.full_name, whatsapp: p.whatsapp };
      });
      setProfileMap(pmap);
    }

    const modalityIds = [...new Set(list.map((r) => r.modality_id).filter(Boolean) as string[])];
    if (modalityIds.length > 0) {
      const { data: mods } = await supabase
        .from("tournament_modalities")
        .select("id, name")
        .in("id", modalityIds);
      const mmap: Record<string, string> = {};
      (mods || []).forEach((m: any) => { mmap[m.id] = m.name; });
      setModalityMap(mmap);
    }

    const entryIds = [...new Set(list.map((r) => r.entry_id).filter(Boolean) as string[])];
    if (entryIds.length > 0) {
      const { data: members } = await supabase
        .from("modality_entry_members")
        .select("entry_id, user_id")
        .in("entry_id", entryIds);
      const allUserIds = [...new Set((members || []).map((m: any) => m.user_id))];
      let pNames: Record<string, string> = {};
      if (allUserIds.length > 0) {
        const { data: pp } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", allUserIds);
        (pp || []).forEach((p: any) => { pNames[p.user_id] = p.full_name || "—"; });
      }
      const emap: Record<string, string[]> = {};
      (members || []).forEach((m: any) => {
        if (!emap[m.entry_id]) emap[m.entry_id] = [];
        emap[m.entry_id].push(pNames[m.user_id] || "Atleta");
      });
      setEntryMembersMap(emap);
    }

    setLoading(false);
  };

  useEffect(() => { load(); }, [tournamentId]);

  const sendReminder = async (e: Row) => {
    const { error } = await supabase.rpc("enqueue_enrollment_reminder", { _enrollment_id: e.id });
    if (error) {
      toast({ title: "Falha ao enviar lembrete", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Lembrete enviado", description: `Aviso via WhatsApp para ${nameOf(e)}.` });
  };

  const confirmManually = async (e: Row) => {
    const { error } = await supabase.from("enrollments").update({ status: "paid" }).eq("id", e.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Inscrição confirmada" });
    load();
  };

  const removeEnrollment = async (e: Row) => {
    if (!confirm(`Remover inscrição de ${nameOf(e)}?`)) return;
    const { error } = await supabase.from("enrollments").delete().eq("id", e.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Inscrição removida" });
    load();
  };

  const nameOf = (e: Row) =>
    (e.user_id && profileMap[e.user_id]?.full_name) || e.athlete_name || "Atleta";

  const whatsappOf = (e: Row) =>
    (e.user_id && profileMap[e.user_id]?.whatsapp) || "";

  const counts = {
    all: rows.length,
    paid: rows.filter((r) => r.status === "paid").length,
    pending: rows.filter((r) => r.status === "pending").length,
    expired: rows.filter((r) => r.status === "expired").length,
  };

  const filtered = rows.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!nameOf(r).toLowerCase().includes(q)) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Seu torneio ainda não tem inscritos."
        description="Compartilhe o link para começar a receber atletas."
        ctaLabel="Divulgar torneio"
        onCta={onDivulgar}
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {([
          ["all", `Todos (${counts.all})`],
          ["paid", `Pagos (${counts.paid})`],
          ["pending", `Pendentes (${counts.pending})`],
          ["expired", `Expirados (${counts.expired})`],
        ] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setFilter(k as any)}
            className={`text-xs px-3 py-1.5 rounded-full border ${
              filter === k
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar atleta..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="space-y-2">
        {filtered.map((e) => {
          const st = statusLabel(e.status);
          const modality = e.modality_id ? modalityMap[e.modality_id] : null;
          const members = e.entry_id ? entryMembersMap[e.entry_id] : null;
          const phone = whatsappOf(e);
          const checkedIn = !!e.checked_in_at;

          return (
            <div key={e.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{nameOf(e)}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1 text-[11px] text-muted-foreground">
                    {modality && <span>Categoria: <span className="text-foreground">{modality}</span></span>}
                    {members && members.length > 1 && (
                      <span>· Dupla: <span className="text-foreground">{members.join(" + ")}</span></span>
                    )}
                    {checkedIn && <span>· ✓ Presente</span>}
                  </div>
                </div>
                <Badge className={st.className} variant="outline">{st.label}</Badge>
              </div>

              {canManage && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {e.status === "pending" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => sendReminder(e)} className="gap-1.5">
                        <Bell className="h-3.5 w-3.5" /> Lembrete
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => confirmManually(e)}>
                        Confirmar manualmente
                      </Button>
                    </>
                  )}
                  {phone && (
                    <Button size="sm" variant="outline" asChild className="gap-1.5">
                      <a href={`https://wa.me/${phone.replace(/\D/g, "")}`} target="_blank" rel="noopener">
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </a>
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => removeEnrollment(e)} className="gap-1.5 text-destructive">
                    <Trash2 className="h-3.5 w-3.5" /> Remover
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-6">Nenhum inscrito neste filtro.</p>
        )}
      </div>
    </div>
  );
}
