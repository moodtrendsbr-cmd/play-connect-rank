// Mock data for the Tournament Flow prototype. Pure presentation, no backend.

export type Profile = "athlete" | "arena" | "organizer" | "public";
export type FlowState = "empty" | "filling" | "live" | "finished";

export interface Pair {
  id: string;
  p1: string;
  p2: string;
  city: string;
  rank: number;
  seed?: number;
}

export interface Match {
  id: string;
  court: string;
  time: string;
  pairA: Pair;
  pairB: Pair;
  scoreA?: string;
  scoreB?: string;
  status: "scheduled" | "live" | "done";
  winner?: "A" | "B";
}

export const tournament = {
  name: "Beach Tennis Open Floripa",
  edition: "5ª Etapa",
  dates: "15 — 16 Nov 2026",
  city: "Florianópolis, SC",
  venue: "Arena Praia Mole",
  cover: "https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=1200&q=80",
  organizer: "Floripa Beach Sports",
  modalities: [
    { id: "mc", label: "Mista C", entries: 24, capacity: 32 },
    { id: "open", label: "Open", entries: 16, capacity: 16 },
    { id: "ini", label: "Iniciante", entries: 12, capacity: 24 },
  ],
  prize: "R$ 6.000",
  fee: "R$ 180",
  countdown: "Faltam 3 dias",
};

export const pairs: Pair[] = [
  { id: "p1", p1: "Larissa Mendes", p2: "Camila Ribeiro", city: "Florianópolis", rank: 142, seed: 1 },
  { id: "p2", p1: "Marina Costa", p2: "Júlia Pacheco", city: "Joinville", rank: 168, seed: 2 },
  { id: "p3", p1: "Bianca Soares", p2: "Helena Vargas", city: "Curitiba", rank: 201, seed: 3 },
  { id: "p4", p1: "Rafaela Duarte", p2: "Tainá Moraes", city: "Porto Alegre", rank: 215, seed: 4 },
  { id: "p5", p1: "Pedro Santana", p2: "Rafael Lima", city: "Florianópolis", rank: 230 },
  { id: "p6", p1: "Bruno Vasconcelos", p2: "Tiago Almeida", city: "Balneário Camboriú", rank: 244 },
  { id: "p7", p1: "Letícia Brandão", p2: "Sofia Antunes", city: "Itajaí", rank: 259 },
  { id: "p8", p1: "Ana Beatriz", p2: "Carolina Reis", city: "Blumenau", rank: 270 },
  { id: "p9", p1: "Gabriela Tavares", p2: "Mariana Lopes", city: "Florianópolis", rank: 283 },
  { id: "p10", p1: "Isadora Prado", p2: "Beatriz Coelho", city: "São José", rank: 290 },
  { id: "p11", p1: "Luana Cardoso", p2: "Patrícia Nogueira", city: "Palhoça", rank: 301 },
  { id: "p12", p1: "Renata Oliveira", p2: "Cláudia Faria", city: "Tubarão", rank: 315 },
  { id: "p13", p1: "Daniela Souza", p2: "Fernanda Borges", city: "Criciúma", rank: 322 },
  { id: "p14", p1: "Vitória Macedo", p2: "Eduarda Pinto", city: "Lages", rank: 334 },
  { id: "p15", p1: "Jéssica Andrade", p2: "Bruna Magalhães", city: "Chapecó", rank: 348 },
  { id: "p16", p1: "Yasmin Carvalho", p2: "Natália Siqueira", city: "Florianópolis", rank: 360 },
];

export const groups = [
  { id: "A", pairs: [pairs[0], pairs[7], pairs[10], pairs[13]] },
  { id: "B", pairs: [pairs[1], pairs[6], pairs[11], pairs[12]] },
  { id: "C", pairs: [pairs[2], pairs[5], pairs[8], pairs[15]] },
  { id: "D", pairs: [pairs[3], pairs[4], pairs[9], pairs[14]] },
];

export const courts = [
  { id: "Q1", label: "Quadra Praia" },
  { id: "Q2", label: "Quadra Sunset" },
  { id: "Q3", label: "Quadra Pôr do Sol" },
];

export const schedule: Match[] = [
  { id: "m1", court: "Q1", time: "08:00", pairA: pairs[0], pairB: pairs[13], scoreA: "6/2", scoreB: "3/6", status: "done", winner: "A" },
  { id: "m2", court: "Q2", time: "08:00", pairA: pairs[1], pairB: pairs[12], scoreA: "6/4", scoreB: "4/6", status: "done", winner: "A" },
  { id: "m3", court: "Q3", time: "08:00", pairA: pairs[2], pairB: pairs[15], scoreA: "7/5", scoreB: "5/7", status: "done", winner: "A" },
  { id: "m4", court: "Q1", time: "09:00", pairA: pairs[3], pairB: pairs[14], scoreA: "4/2", scoreB: "3/3", status: "live" },
  { id: "m5", court: "Q2", time: "09:00", pairA: pairs[7], pairB: pairs[10], status: "scheduled" },
  { id: "m6", court: "Q3", time: "09:00", pairA: pairs[5], pairB: pairs[8], status: "scheduled" },
  { id: "m7", court: "Q1", time: "10:00", pairA: pairs[6], pairB: pairs[11], status: "scheduled" },
  { id: "m8", court: "Q2", time: "10:00", pairA: pairs[4], pairB: pairs[9], status: "scheduled" },
];

// Bracket — 8 quartas → 4 semis → 2 finais → 1 campeão (single elimination)
export interface BracketMatch {
  id: string;
  round: "r16" | "qf" | "sf" | "f";
  pairA?: Pair;
  pairB?: Pair;
  scoreA?: string;
  scoreB?: string;
  winner?: "A" | "B";
}

export const bracket: BracketMatch[] = [
  // Oitavas (8)
  { id: "r16-1", round: "r16", pairA: pairs[0], pairB: pairs[15], scoreA: "6/1", scoreB: "1/6", winner: "A" },
  { id: "r16-2", round: "r16", pairA: pairs[7], pairB: pairs[8], scoreA: "6/4", scoreB: "4/6", winner: "A" },
  { id: "r16-3", round: "r16", pairA: pairs[3], pairB: pairs[12], scoreA: "5/7", scoreB: "7/5", winner: "B" },
  { id: "r16-4", round: "r16", pairA: pairs[4], pairB: pairs[11], scoreA: "6/3", scoreB: "3/6", winner: "A" },
  { id: "r16-5", round: "r16", pairA: pairs[1], pairB: pairs[14], scoreA: "6/2", scoreB: "2/6", winner: "A" },
  { id: "r16-6", round: "r16", pairA: pairs[6], pairB: pairs[9], scoreA: "7/6", scoreB: "6/7", winner: "A" },
  { id: "r16-7", round: "r16", pairA: pairs[2], pairB: pairs[13], scoreA: "6/4", scoreB: "4/6", winner: "A" },
  { id: "r16-8", round: "r16", pairA: pairs[5], pairB: pairs[10], scoreA: "5/7", scoreB: "7/5", winner: "B" },
  // Quartas (4)
  { id: "qf-1", round: "qf", pairA: pairs[0], pairB: pairs[7], scoreA: "6/3", scoreB: "3/6", winner: "A" },
  { id: "qf-2", round: "qf", pairA: pairs[12], pairB: pairs[4], scoreA: "4/6", scoreB: "6/4", winner: "B" },
  { id: "qf-3", round: "qf", pairA: pairs[1], pairB: pairs[6], scoreA: "6/2", scoreB: "2/6", winner: "A" },
  { id: "qf-4", round: "qf", pairA: pairs[2], pairB: pairs[10], scoreA: "7/5", scoreB: "5/7", winner: "A" },
  // Semis (2)
  { id: "sf-1", round: "sf", pairA: pairs[0], pairB: pairs[4], scoreA: "6/4", scoreB: "4/6", winner: "A" },
  { id: "sf-2", round: "sf", pairA: pairs[1], pairB: pairs[2], scoreA: "6/3", scoreB: "3/6", winner: "A" },
  // Final
  { id: "f-1", round: "f", pairA: pairs[0], pairB: pairs[1], scoreA: "7/6", scoreB: "6/7", winner: "A" },
];

export const podium = {
  champion: pairs[0],
  runnerUp: pairs[1],
  third: pairs[2],
};

export const rankingDelta = [
  { pair: pairs[0], from: 142, to: 118, delta: -24 },
  { pair: pairs[1], from: 168, to: 149, delta: -19 },
  { pair: pairs[2], from: 201, to: 187, delta: -14 },
  { pair: pairs[7], from: 270, to: 261, delta: -9 },
  { pair: pairs[3], from: 215, to: 220, delta: 5 },
];

export const feedPosts = [
  { id: "f1", author: pairs[0].p1, avatar: "L", time: "2h", text: "Que torneio! Foi guerra na final 🏖️🥇 #BeachTennisOpen", likes: 234, hasVideo: true },
  { id: "f2", author: pairs[1].p1, avatar: "M", time: "3h", text: "Vice é só o começo. Volto mais forte na próxima.", likes: 178, hasVideo: false },
  { id: "f3", author: pairs[2].p1, avatar: "B", time: "4h", text: "3º lugar conquistado. Obrigada Floripa! 💚", likes: 142, hasVideo: true },
];

export const stages = [
  { id: 1, slug: "create", title: "Criação", short: "Criação", fidelity: "low" as const },
  { id: 2, slug: "public", title: "Página pública", short: "Pública", fidelity: "high" as const },
  { id: 3, slug: "enrollment", title: "Inscrição", short: "Inscrição", fidelity: "high" as const },
  { id: 4, slug: "athletes", title: "Inscritos", short: "Inscritos", fidelity: "high" as const },
  { id: 5, slug: "checkin", title: "Check-in", short: "Check-in", fidelity: "high" as const },
  { id: 6, slug: "groups-form", title: "Formação de grupos", short: "Grupos+", fidelity: "low" as const },
  { id: 7, slug: "draw", title: "Sorteio", short: "Sorteio", fidelity: "low" as const },
  { id: 8, slug: "groups-view", title: "Visualização dos grupos", short: "Grupos", fidelity: "high" as const },
  { id: 9, slug: "generate", title: "Geração de jogos", short: "Gerar", fidelity: "low" as const },
  { id: 10, slug: "schedule", title: "Agenda de partidas", short: "Agenda", fidelity: "high" as const },
  { id: 11, slug: "bracket", title: "Chaveamento", short: "Bracket", fidelity: "high" as const },
  { id: 12, slug: "live", title: "Jogos em andamento", short: "Ao vivo", fidelity: "low" as const },
  { id: 13, slug: "result", title: "Registro de resultado", short: "Resultado", fidelity: "low" as const },
  { id: 14, slug: "advance", title: "Avanço de fase", short: "Avanço", fidelity: "low" as const },
  { id: 15, slug: "final", title: "Final", short: "Final", fidelity: "low" as const },
  { id: 16, slug: "champion", title: "Resultado final", short: "Pódio", fidelity: "low" as const },
  { id: 17, slug: "ranking", title: "Ranking atualizado", short: "Ranking", fidelity: "low" as const },
  { id: 18, slug: "post-feed", title: "Feed pós-torneio", short: "Feed", fidelity: "high" as const },
];
