// Derives the current operational stage of a tournament + next action
// Pure: no DB calls. Takes already-fetched data and returns labels/routes.

export type StageId = "open" | "checkin" | "groups" | "matches" | "finals" | "closed";

export interface StageInputs {
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  paidCount: number;
  maxSlots: number;
  hasEntries: boolean;          // any modality_entries exist
  hasGroups: boolean;           // any modality_groups exist
  hasMatches: boolean;          // any modality_matches exist
  hasFinishedFinal: boolean;    // a champion exists
  hasOrphans?: boolean;         // paid enrollments without modality_id
}

export interface StageInfo {
  id: StageId;
  label: string;
  icon: string;
}

export interface NextAction {
  label: string;
  hint?: string;
  goToTab?: "resumo" | "inscritos" | "checkin" | "grupos" | "jogos" | "chave" | "podio";
  action?: "share" | "publish";
}

export const STAGES: StageInfo[] = [
  { id: "open",     label: "Inscrições", icon: "📝" },
  { id: "checkin",  label: "Check-in",   icon: "✅" },
  { id: "groups",   label: "Grupos",     icon: "🎯" },
  { id: "matches",  label: "Jogos",      icon: "🏐" },
  { id: "finals",   label: "Finais",     icon: "🥇" },
  { id: "closed",   label: "Encerrado",  icon: "🏁" },
];

export const deriveStage = (i: StageInputs): StageId => {
  const now = new Date();
  const end = i.endDate ? new Date(i.endDate) : null;

  if (i.hasFinishedFinal || (end && now > end && i.hasMatches)) return "closed";
  if (i.hasMatches) {
    // If only final-stage matches remain we could mark "finals", but keep simple:
    return "matches";
  }
  if (i.hasGroups) return "groups";
  // Only advance to check-in when we actually have valid entries or status was opened manually.
  if (i.hasEntries && (i.status === "checkin" || i.paidCount > 0)) return "checkin";
  return "open";
};

export const nextActionFor = (stage: StageId, i: StageInputs): NextAction => {
  switch (stage) {
    case "open":
      if (i.hasOrphans) {
        return {
          label: "Organizar inscrições",
          hint: "Há inscrições pagas sem categoria. Organize antes de avançar.",
          goToTab: "inscritos",
        };
      }
      return {
        label: "Divulgar torneio",
        hint: i.paidCount === 0 ? "Compartilhe o link e comece a receber inscrições." : `${i.paidCount} inscritos confirmados.`,
        action: "share",
      };
    case "checkin":
      return {
        label: i.hasEntries ? "Conferir presenças" : "Abrir check-in",
        hint: "Confira quem chegou antes de sortear os grupos.",
        goToTab: "checkin",
      };
    case "groups":
      return {
        label: "Gerar jogos",
        hint: "Grupos sorteados. Hora de criar a tabela de jogos.",
        goToTab: "jogos",
      };
    case "matches":
      return {
        label: "Registrar resultado",
        hint: "Lance os placares para o chaveamento avançar.",
        goToTab: "jogos",
      };
    case "finals":
      return {
        label: "Publicar pódio",
        hint: "Finalize o torneio e divulgue o resultado.",
        goToTab: "podio",
      };
    case "closed":
      return {
        label: "Compartilhar pódio",
        hint: "Torneio encerrado. Divulgue o pódio nas suas redes.",
        action: "share",
      };
  }
};

export const stageIndex = (id: StageId) => STAGES.findIndex((s) => s.id === id);
