import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Calendar, Layers, ClipboardList, Trophy, ArrowRight } from "lucide-react";

interface Props {
  tournamentId: string;
  stageLabel?: string;
  hasModalities: boolean;
  orphansCount: number;
  pendingResultsCount: number;
  completePaidCount: number;
  notCheckedInCount: number;
  hasGroups: boolean;
  hasMatches: boolean;
  onGoTab: (tab: "resumo" | "inscritos" | "checkin" | "grupos" | "jogos" | "chave" | "podio") => void;
  onEditConfig: () => void;
}

interface UpcomingMatch {
  id: string;
  scheduled_at: string | null;
  round_number: number;
  match_number: number;
  modality_name?: string;
}

const fmt = (iso: string | null) => {
  if (!iso) return "Horário a definir";
  try {
    return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
};

const TabResumo = ({
  tournamentId,
  stageLabel,
  hasModalities,
  orphansCount,
  pendingResultsCount,
  completePaidCount,
  notCheckedInCount,
  hasGroups,
  hasMatches,
  onGoTab,
  onEditConfig,
}: Props) => {
  const [upcoming, setUpcoming] = useState<UpcomingMatch[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: mods } = await supabase
        .from("tournament_modalities")
        .select("id, name")
        .eq("tournament_id", tournamentId);
      const modIds = (mods || []).map((m: any) => m.id);
      const modNames: Record<string, string> = {};
      (mods || []).forEach((m: any) => { modNames[m.id] = m.name; });

      if (modIds.length === 0) { setUpcoming([]); return; }

      const { data: matches } = await supabase
        .from("modality_matches")
        .select("id, scheduled_at, round_number, match_number, modality_id, status")
        .in("modality_id", modIds)
        .neq("status", "finished")
        .order("scheduled_at", { ascending: true, nullsFirst: false })
        .limit(3);

      setUpcoming(
        ((matches || []) as any[]).map((m) => ({
          id: m.id,
          scheduled_at: m.scheduled_at,
          round_number: m.round_number,
          match_number: m.match_number,
          modality_name: modNames[m.modality_id],
        })),
      );
    };
    load();
  }, [tournamentId]);

  return (
    <div className="space-y-4">
      {/* Stage */}
      <p className="text-sm text-muted-foreground">
        Etapa atual: <span className="text-foreground font-medium capitalize">{stageLabel}</span>.
      </p>

      {/* Conditional CTAs */}
      {!hasModalities && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-amber-300">Cadastre as categorias</p>
              <p className="text-xs text-muted-foreground">Sem categorias o torneio não recebe inscritos válidos.</p>
            </div>
            <Button size="sm" onClick={onEditConfig}>Criar categoria</Button>
          </CardContent>
        </Card>
      )}

      {orphansCount > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-amber-300">{orphansCount} inscrições incompletas</p>
                <p className="text-xs text-muted-foreground">Pagas, mas sem categoria. Organize antes de sortear grupos.</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => onGoTab("inscritos")}>
              Organizar
            </Button>
          </CardContent>
        </Card>
      )}

      {hasGroups && !hasMatches && (
        <Card className="border-primary/30">
          <CardContent className="p-4 flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-foreground">Grupos prontos</p>
              <p className="text-xs text-muted-foreground">Gere os jogos para começar o torneio.</p>
            </div>
            <Button size="sm" onClick={() => onGoTab("jogos")}>Gerar jogos</Button>
          </CardContent>
        </Card>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI icon={Layers} label="Completas" value={completePaidCount} onClick={() => onGoTab("inscritos")} />
        <KPI icon={AlertTriangle} label="Incompletas" value={orphansCount} tone={orphansCount > 0 ? "warn" : "muted"} onClick={() => onGoTab("inscritos")} />
        <KPI icon={ClipboardList} label="Sem check-in" value={notCheckedInCount} onClick={() => onGoTab("checkin")} />
        <KPI icon={Trophy} label="Resultados pendentes" value={pendingResultsCount} onClick={() => onGoTab("jogos")} />
      </div>

      {/* Upcoming matches */}
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Próximos jogos</p>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum jogo agendado.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((m) => (
              <button
                key={m.id}
                onClick={() => onGoTab("jogos")}
                className="w-full flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-left hover:bg-muted/40 transition"
              >
                <div className="min-w-0">
                  <p className="text-sm text-foreground">
                    {m.modality_name ? `${m.modality_name} · ` : ""}R{m.round_number} · Jogo {m.match_number}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Calendar className="h-3 w-3" /> {fmt(m.scheduled_at)}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const KPI = ({ icon: Icon, label, value, onClick, tone = "muted" }: any) => (
  <button
    onClick={onClick}
    className="rounded-lg border border-border bg-card p-3 text-left hover:bg-muted/40 transition"
  >
    <div className="flex items-center gap-2">
      <Icon className={`h-4 w-4 ${tone === "warn" ? "text-amber-400" : "text-muted-foreground"}`} />
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
    <p className={`text-2xl font-bold mt-1 ${tone === "warn" ? "text-amber-300" : "text-foreground"}`}>{value}</p>
  </button>
);

export default TabResumo;
