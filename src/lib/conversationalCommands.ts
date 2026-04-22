// Pure data — comandos conversacionais por perfil.
// Cada comando é enviado via wa.me?text=<command> pelo WhatsAppCTA.

export type CommandExample = {
  icon: string; // lucide-react icon name
  command: string;
  hint?: string;
};

export const COMMANDS: Record<string, CommandExample[]> = {
  arena: [
    { icon: "Trophy", command: "Criar torneio sábado beach tennis 16 vagas", hint: "Cria torneio em segundos" },
    { icon: "Receipt", command: "Abrir cobrança do João", hint: "Envia link de pagamento" },
    { icon: "Activity", command: "Como está a operação de hoje?", hint: "Resumo do dia" },
    { icon: "Users", command: "Quais alunos faltaram?", hint: "Lista de ausências" },
    { icon: "AlertTriangle", command: "Abrir ocorrência da quadra 2", hint: "Registra ticket" },
  ],
  organizer: [
    { icon: "Plus", command: "Criar evento na Arena X", hint: "Novo torneio rápido" },
    { icon: "ClipboardList", command: "Mostrar inscrições do torneio Y", hint: "Listagem rápida" },
    { icon: "CheckCircle2", command: "Quem fez check-in hoje?", hint: "Status de presença" },
    { icon: "GitBranch", command: "Como estão os jogos?", hint: "Resumo dos brackets" },
    { icon: "TrendingUp", command: "Performance dos meus eventos", hint: "Métricas executivas" },
  ],
  athlete: [
    { icon: "Trophy", command: "Quais torneios estão abertos?", hint: "Próximas competições" },
    { icon: "CheckCircle2", command: "Fazer check-in", hint: "Confirma presença" },
    { icon: "Swords", command: "Ver meus jogos", hint: "Próximos confrontos" },
    { icon: "Medal", command: "Ver meu ranking", hint: "Posição atual" },
  ],
  company: [
    { icon: "Megaphone", command: "Criar campanha", hint: "Novo anúncio" },
    { icon: "ShoppingBag", command: "Ver pedidos pendentes", hint: "Status de vendas" },
    { icon: "Eye", command: "Como está meu anúncio?", hint: "Performance da campanha" },
    { icon: "TrendingUp", command: "Resumo da semana", hint: "Métricas comerciais" },
  ],
  tenant: [
    { icon: "Network", command: "Resumo da rede", hint: "Visão executiva" },
    { icon: "AlertTriangle", command: "Quais arenas estão em risco?", hint: "Alertas críticos" },
    { icon: "DollarSign", command: "Mostrar receita do mês", hint: "Financeiro consolidado" },
    { icon: "Sparkles", command: "Ações da ORKYM aguardando aprovação", hint: "Governança IA" },
  ],
  admin: [
    { icon: "Activity", command: "Resumo global do MoodPlay", hint: "Visão da plataforma" },
    { icon: "AlertTriangle", command: "Quais tenants com problema?", hint: "Saúde da rede" },
    { icon: "Sparkles", command: "Uso da ORKYM hoje", hint: "Consumo de IA" },
    { icon: "DollarSign", command: "Receita consolidada do dia", hint: "GMV diário" },
  ],
} as const;

export type ProfileKey = keyof typeof COMMANDS;
