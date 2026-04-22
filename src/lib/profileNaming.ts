/**
 * MoodPlay — Glossário oficial de naming por perfil (Phase 11.8).
 *
 * Single source of truth para labels visíveis nos shells, sidebars,
 * dashboards e CTAs. Use estas constantes em vez de literais soltos
 * para garantir consistência entre os 6 perfis.
 *
 * Padrões fixos:
 * - "MoodPlay" (CamelCase, sem espaço) — substitui "Mood Play"
 * - "Patrocínios" — substitui "sponsor / sponsorship / patrocinador"
 * - "Campanhas" — substitui "ads / publicidade / advertising"
 * - "Ações ORKYM" — substitui "Ações sugeridas / Ações IA"
 * - "Autonomia" — substitui "Controle automático / Governança IA"
 * - "Control Tower" — termo unificado para a visão de controle
 */

export type ProfileKey = "admin" | "tenant" | "arena" | "organizer" | "athlete" | "company";

export const PROFILE_NAMING: Record<ProfileKey, { roleChip: string; defaultContext: string; towerLabel: string }> = {
  admin:     { roleChip: "Admin",        defaultContext: "MoodPlay global", towerLabel: "Control Tower" },
  tenant:    { roleChip: "Rede",         defaultContext: "MoodPlay",        towerLabel: "Control Tower da Rede" },
  arena:     { roleChip: "Arena",        defaultContext: "MoodPlay",        towerLabel: "Control Tower da Arena" },
  organizer: { roleChip: "Organizador",  defaultContext: "MoodPlay",        towerLabel: "Event Control Tower" },
  athlete:   { roleChip: "Atleta",       defaultContext: "MoodPlay",        towerLabel: "Athlete Hub" },
  company:   { roleChip: "Empresa",      defaultContext: "MoodPlay",        towerLabel: "Company Control Tower" },
};

export const SECTION_LABELS = {
  controlTower: "Control Tower",
  orkymActions: "Ações ORKYM",
  autonomy:     "Autonomia",
  finance:      "Financeiro",
  marketplace:  "Marketplace",
  campaigns:    "Campanhas",
  sponsorships: "Patrocínios",
} as const;

export const CTA_LABELS = {
  talkToOrkym:    "Falar com a ORKYM",
  continueOnWa:   "Continuar no WhatsApp",
  askOnWa:        "Pedir pelo WhatsApp",
  generateQr:     "Gerar QR",
  openQr:         "Abrir QR",
  viewDetails:    "Ver detalhes",
} as const;
