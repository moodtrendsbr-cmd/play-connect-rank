// Human confirmation phrases for proactive WA loop.
// Used right after the system executes a pending_action triggered by the
// user's affirmative reply. No jargon, no AI/ORKYM mention.

export function confirmationFor(actionType: string): string {
  switch (actionType) {
    case "tournament_boost":
      return "Perfeito. Já estou divulgando seu torneio. Você deve começar a receber mais inscrições em breve.";
    case "fill_idle_slots":
      return "Combinado. Já estou avisando quem costuma jogar nesse horário.";
    case "reactivation_message":
      return "Pode deixar. Já estou enviando o convite agora.";
    case "create_campaign":
      return "Show. Já estou impulsionando sua campanha agora.";
    case "product_boost":
      return "Show. Já estou divulgando seu produto agora.";
    case "company_boost":
      return "Show. Já estou divulgando sua empresa agora.";
    case "send_proactive_message":
      return "Beleza. Já estou te mandando os detalhes.";
    default:
      return "Pronto, já estou cuidando disso.";
  }
}

export function blockedReply(): string {
  return "Tudo bem, vou tentar de novo mais tarde.";
}

export function declinedReply(): string {
  return "Sem problema. Quando quiser, é só me chamar.";
}

/**
 * Loose Portuguese affirmative-reply detector. The text must be a SHORT
 * standalone confirmation (≤ ~25 chars after trim). We deliberately do not
 * try to interpret long free-form text — that path stays with ORKYM.
 */
export function isAffirmative(raw: string): boolean {
  const t = (raw || "").toLowerCase().trim();
  if (!t || t.length > 25) return false;
  // Strip diacritics + punctuation
  const clean = t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[!.?¡¿,;:"']/g, "")
    .trim();
  return /^(sim|s|pode|ok|okay|manda|faz|fazer|claro|beleza|bora|vamos|vai|isso|positivo|👍|✅|yes)\s*$/.test(
    clean,
  );
}

export function isNegative(raw: string): boolean {
  const t = (raw || "").toLowerCase().trim();
  if (!t || t.length > 25) return false;
  const clean = t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[!.?¡¿,;:"']/g, "")
    .trim();
  return /^(nao|n|no|negativo|deixa|depois|agora nao|👎|❌)\s*$/.test(clean);
}
