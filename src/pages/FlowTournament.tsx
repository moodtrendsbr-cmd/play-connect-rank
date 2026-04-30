import { useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import StepStepper from "@/components/flow-tournament/StepStepper";
import ProfileTabs from "@/components/flow-tournament/ProfileTabs";
import MobileFrame from "@/components/flow-tournament/MobileFrame";
import ScreenInfoPanel, { ScreenInfo } from "@/components/flow-tournament/ScreenInfoPanel";
import { stages, Profile } from "@/components/flow-tournament/mock/tournamentData";
import {
  S01Create, S02PublicPage, S03Enrollment, S04Athletes, S05CheckIn,
  S06GroupsForm, S07Draw, S08GroupsView, S09GenerateMatches, S10Schedule,
  S11Bracket, S12Live, S13Result, S14Advance, S15Final, S16Champion, S17Ranking, S18PostFeed
} from "@/components/flow-tournament/screens/AllScreens";
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";

const ROLE_LABEL: Record<Profile, string> = {
  athlete: "Atleta",
  arena: "Arena",
  organizer: "Organizador",
  public: "Público",
};

function getInfo(stepId: number, profile: Profile): ScreenInfo {
  const stage = stages.find(s => s.id === stepId)!;
  const base: Record<number, ScreenInfo> = {
    1: { name: "Criar torneio", sees: "Form em 6 etapas com progresso visual. Cada passo cobre uma decisão.", actions: ["Continuar etapa", "Voltar", "Salvar rascunho"], components: ["Stepper", "Form", "Cards de etapa"], data: ["Modalidades", "Categorias", "Datas", "Local", "Inscrição"], state: "Em construção" },
    2: { name: "Página pública do torneio", sees: "Hero com capa, contador, modalidades com vagas e CTA principal.", actions: ["Inscrever-se", "Compartilhar", "Acompanhar"], components: ["Hero", "Stat cards", "Lista de modalidades", "CTA"], data: ["Nome", "Datas", "Local", "Premiação", "Inscritos / capacidade"] },
    3: { name: "Inscrição do atleta", sees: "Seleção de categoria, dupla, regulamento e resumo de pagamento.", actions: ["Escolher categoria", "Adicionar parceiro", "Pagar com PIX"], components: ["Radio cards", "Avatar pair", "Checkbox regulamento", "Resumo"], data: ["Categoria", "Dupla", "Valor", "Taxa"] },
    4: { name: "Lista de inscritos", sees: "Busca, filtros por categoria e ranking de duplas.", actions: ["Buscar", "Filtrar", "Abrir dupla"], components: ["Search", "Tabs", "Lista de duplas"], data: ["Nome", "Cidade", "Seed", "Categoria"] },
    5: { name: "Check-in", sees: profile === "athlete" ? "Seu QR Code grande e confirmação." : "Contador de presentes e leitor de QR ativo.", actions: profile === "athlete" ? ["Apresentar QR"] : ["Ler QR Code", "Confirmar manualmente"], components: ["QR", "Progress", "Lista live"], data: ["Confirmados / total", "Horário", "Duplas"], state: profile === "athlete" ? "Confirmado" : "Em andamento" },
    6: { name: "Formação de grupos", sees: "4 chaves visuais com regra de distribuição.", actions: ["Trocar regra", "Confirmar formação"], components: ["Grid de chaves", "Resumo regras"], data: ["Quantidade de chaves", "Cabeças de chave"] },
    7: { name: "Sorteio", sees: "Animação central + log dos sorteios em tempo real.", actions: ["Pausar", "Pular animação"], components: ["Animation", "Log de eventos"], data: ["Duplas distribuídas em ordem"] },
    8: { name: "Visualização dos grupos", sees: "Cards por chave com 4 duplas cada e seeds destacadas.", actions: ["Abrir chave", "Compartilhar"], components: ["Card por chave", "Lista de duplas"], data: ["Chave", "Duplas", "Seeds"] },
    9: { name: "Geração de jogos", sees: "Total de jogos, distribuição por quadra e prévia da agenda.", actions: ["Publicar agenda", "Editar"], components: ["Big number", "Card por quadra", "Prévia"], data: ["24 jogos", "8 por quadra", "Horários"] },
    10: { name: "Agenda de partidas", sees: profile === "athlete" ? "Destaque do próximo jogo + agenda completa por quadra." : "Agenda completa por quadra.", actions: ["Ver detalhes", "Confirmar presença"], components: ["Próximo jogo", "Lista por quadra", "Status badges"], data: ["Horário", "Quadra", "Duplas", "Placar parcial"] },
    11: { name: "Chaveamento", sees: "Bracket horizontal: oitavas → quartas → semi → final, com placar.", actions: ["Tocar avatar", "Compartilhar bracket"], components: ["Bracket SVG", "Cells", "Banner campeão"], data: ["Confrontos", "Placares", "Vencedores"] },
    12: { name: "Jogos em andamento", sees: "Placares ao vivo destacados em verde, jogos do dia listados.", actions: ["Abrir jogo", "Acompanhar"], components: ["Live cards", "Placar grande"], data: ["Placar atual", "Quadra", "Status"] },
    13: { name: "Registro de resultado", sees: "Inputs por set, vencedor destacado.", actions: profile === "organizer" ? ["Lançar set", "Confirmar resultado"] : ["Acompanhar"], components: ["Set inputs", "Badge vencedor"], data: ["Sets", "Games", "Tie-break"] },
    14: { name: "Avanço de fase", sees: "Lista de classificadas e contagem para a próxima fase.", actions: ["Ver chaveamento"], components: ["Cards classificadas", "Timer"], data: ["Classificadas", "Próxima fase"] },
    15: { name: "Final", sees: "Tela cheia com as duas duplas finalistas em destaque.", actions: ["Lembrete", "Compartilhar"], components: ["Card finalistas", "VS gigante"], data: ["Finalistas", "Horário", "Quadra"] },
    16: { name: "Resultado final", sees: "Pódio 1º/2º/3º com placar da final e premiação.", actions: ["Compartilhar", "Ver galeria"], components: ["Pódio", "Resumo final", "Card premiação"], data: ["Campeãs", "Vice", "3º", "Placar", "Premiação"] },
    17: { name: "Ranking atualizado", sees: "Lista das duplas com posição nova e variação.", actions: ["Ver ranking completo"], components: ["Lista", "Setas de variação"], data: ["Posição anterior", "Posição nova", "Delta"] },
    18: { name: "Feed pós-torneio", sees: "Banner de torneio finalizado, V-Clips e posts dos atletas.", actions: ["Curtir", "Comentar", "Compartilhar"], components: ["Banner", "Post card", "Player V-Clip"], data: ["Posts", "Vídeos", "Likes"] },
  };
  const info = base[stepId] ?? { name: stage.title, sees: "—", actions: [], components: [], data: [] };
  return info;
}

function renderScreen(stepId: number, profile: Profile) {
  switch (stepId) {
    case 1: return <S01Create />;
    case 2: return <S02PublicPage profile={profile} />;
    case 3: return <S03Enrollment />;
    case 4: return <S04Athletes profile={profile} />;
    case 5: return <S05CheckIn profile={profile} />;
    case 6: return <S06GroupsForm />;
    case 7: return <S07Draw />;
    case 8: return <S08GroupsView />;
    case 9: return <S09GenerateMatches />;
    case 10: return <S10Schedule profile={profile} />;
    case 11: return <S11Bracket />;
    case 12: return <S12Live />;
    case 13: return <S13Result profile={profile} />;
    case 14: return <S14Advance />;
    case 15: return <S15Final />;
    case 16: return <S16Champion />;
    case 17: return <S17Ranking />;
    case 18: return <S18PostFeed />;
    default: return null;
  }
}

export default function FlowTournament() {
  const [params, setParams] = useSearchParams();
  const step = Number(params.get("step") ?? 2);
  const profile = (params.get("role") ?? "athlete") as Profile;
  const stage = stages.find(s => s.id === step) ?? stages[0];
  const info = useMemo(() => getInfo(step, profile), [step, profile]);

  const setStep = (id: number) => {
    const p = new URLSearchParams(params); p.set("step", String(id)); setParams(p);
  };
  const setProfile = (r: Profile) => {
    const p = new URLSearchParams(params); p.set("role", r); setParams(p);
  };

  const fidelityLabel = stage.fidelity === "high" ? "Alta fidelidade" : "Mockup simplificado";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/40 backdrop-blur sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm">
            <ArrowLeft className="w-4 h-4" /> MoodPlay
          </Link>
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-widest text-primary">Fluxo de torneios — protótipo navegável</div>
            <div className="text-sm font-semibold">Etapa {stage.id}: {stage.title} • {ROLE_LABEL[profile]} • <span className="text-muted-foreground">{fidelityLabel}</span></div>
          </div>
          <ProfileTabs value={profile} onChange={setProfile} />
        </div>
        <StepStepper current={step} onChange={setStep} />
      </header>

      <main className="max-w-[1400px] mx-auto px-4 py-6 grid lg:grid-cols-[1fr_420px] gap-8">
        <div className="flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-4">
            <button
              onClick={() => setStep(Math.max(1, step - 1))}
              disabled={step === 1}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-xs disabled:opacity-30">
              <ChevronLeft className="w-3.5 h-3.5" /> Anterior
            </button>
            <div className="text-xs text-muted-foreground">{step} de {stages.length}</div>
            <button
              onClick={() => setStep(Math.min(stages.length, step + 1))}
              disabled={step === stages.length}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-30">
              Próxima <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <MobileFrame title={stage.title}>
            {renderScreen(step, profile)}
          </MobileFrame>
        </div>
        <aside className="lg:sticky lg:top-32 self-start">
          <ScreenInfoPanel info={info} />
        </aside>
      </main>
    </div>
  );
}
