import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Swords, QrCode, MapPin, Clock } from "lucide-react";
import QRCode from "react-qr-code";

interface NextMatch {
  id: string;
  scheduled_at: string | null;
  modality_name: string | null;
  tournament_name: string | null;
  tournament_id: string | null;
  opponent_name: string | null;
  court_name: string | null;
}

interface PaidEnrollment {
  id: string;
  checkin_token: string;
  tournament_id: string;
  tournament_name: string;
}

const fmtWhen = (iso: string | null) => {
  if (!iso) return "Horário a definir";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

const MyNextMatchCard = () => {
  const { user } = useAuth();
  const [next, setNext] = useState<NextMatch | null>(null);
  const [paidEnrollments, setPaidEnrollments] = useState<PaidEnrollment[]>([]);
  const [qrFor, setQrFor] = useState<PaidEnrollment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!user) return;
      setLoading(true);

      // Find athlete entries for this user
      const { data: members } = await supabase
        .from("modality_entry_members")
        .select("entry_id")
        .eq("user_id", user.id);
      const entryIds = (members || []).map((m: any) => m.entry_id);

      if (entryIds.length > 0) {
        const nowIso = new Date().toISOString();
        const { data: matches } = await supabase
          .from("modality_matches")
          .select(
            "id, scheduled_at, status, entry_a_id, entry_b_id, modality_id, tournament_modalities(name, tournament_id, tournaments(name))"
          )
          .or(`entry_a_id.in.(${entryIds.join(",")}),entry_b_id.in.(${entryIds.join(",")})`)
          .neq("status", "finished")
          .gte("scheduled_at", nowIso)
          .order("scheduled_at", { ascending: true })
          .limit(1);

        const m = (matches || [])[0] as any;
        if (m) {
          const opponentEntryId = entryIds.includes(m.entry_a_id) ? m.entry_b_id : m.entry_a_id;
          let opponentName: string | null = null;
          if (opponentEntryId) {
            const { data: opp } = await supabase
              .from("modality_entries")
              .select("name")
              .eq("id", opponentEntryId)
              .maybeSingle();
            opponentName = (opp as any)?.name ?? null;
          }
          if (alive) {
            setNext({
              id: m.id,
              scheduled_at: m.scheduled_at,
              modality_name: m.tournament_modalities?.name ?? null,
              tournament_name: m.tournament_modalities?.tournaments?.name ?? null,
              tournament_id: m.tournament_modalities?.tournament_id ?? null,
              opponent_name: opponentName,
              court_name: null,
            });
          }
        } else if (alive) {
          setNext(null);
        }
      } else if (alive) {
        setNext(null);
      }

      // Paid enrollments for QR
      const { data: enrolls } = await supabase
        .from("enrollments")
        .select("id, checkin_token, tournament_id, tournaments(name, end_date)")
        .eq("user_id", user.id)
        .eq("status", "paid")
        .order("created_at", { ascending: false });

      const today = new Date();
      const valid = (enrolls || [])
        .filter((e: any) => {
          if (!e.tournaments?.end_date) return true;
          return new Date(e.tournaments.end_date) >= today;
        })
        .map((e: any) => ({
          id: e.id,
          checkin_token: e.checkin_token,
          tournament_id: e.tournament_id,
          tournament_name: e.tournaments?.name ?? "Torneio",
        }))
        .filter((e: any) => !!e.checkin_token);

      if (alive) {
        setPaidEnrollments(valid);
        setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [user]);

  const qrUrl = useMemo(() => {
    if (!qrFor) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/checkin?token=${qrFor.checkin_token}`;
  }, [qrFor]);

  if (loading) return null;
  if (!next && paidEnrollments.length === 0) return null;

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Swords className="h-4 w-4 text-primary" />
          Meu próximo jogo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {next ? (
          <div className="rounded-md border border-border p-3 space-y-2">
            <div className="font-display text-lg leading-tight">
              {next.opponent_name ? `Você vs ${next.opponent_name}` : "Adversário a definir"}
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              {next.tournament_name && <div>{next.tournament_name}</div>}
              {next.modality_name && <div>{next.modality_name}</div>}
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> {fmtWhen(next.scheduled_at)}
              </div>
              {next.court_name && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {next.court_name}
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum jogo agendado no momento.</p>
        )}

        {paidEnrollments.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Meu QR de check-in
            </p>
            {paidEnrollments.map((e) => (
              <Button
                key={e.id}
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => setQrFor(e)}
              >
                <QrCode className="h-4 w-4" /> {e.tournament_name}
              </Button>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={!!qrFor} onOpenChange={(o) => !o && setQrFor(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Check-in: {qrFor?.tournament_name}</DialogTitle>
          </DialogHeader>
          {qrFor && (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="bg-white p-4 rounded-md">
                <QRCode value={qrUrl} size={220} />
              </div>
              <p className="text-xs text-muted-foreground text-center break-all">{qrUrl}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default MyNextMatchCard;
