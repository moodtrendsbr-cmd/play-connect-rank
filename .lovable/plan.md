## Protótipo Navegável: Fluxo Completo de Torneios

Vou criar uma rota interna `/flow-tournament` que funciona como um Figma vivo dentro do MoodPlay. Você navega pelas 18 etapas, troca de perfil (Atleta / Arena / Organizador / Público) e vê cada tela renderizada com dados realistas — tudo respeitando o design system atual (preto #050708, verde neon #2BFF88, Bebas Neue + Inter).

### O que será entregue

Uma experiência tipo "demo interativa" com três eixos de navegação simultâneos:

```text
┌─ EIXO 1: Etapa (1 → 18) ──── stepper horizontal no topo
├─ EIXO 2: Perfil ──────────── tabs Atleta | Arena | Organizer | Público
└─ EIXO 3: Estado ──────────── chips: Vazio | Em andamento | Cheio | Finalizado
```

Cada combinação renderiza um mockup mobile-first dentro de um "frame de celular" no centro da tela, com painel lateral mostrando: nome da tela, o que o usuário vê, ações disponíveis, componentes, dados exibidos.

### Estrutura das 18 etapas

**Alta fidelidade (8 telas críticas, mockup completo e interativo):**
1. Página pública do torneio — hero, contador, modalidades, botão inscrever
2. Inscrição do atleta — seleção de categoria/dupla, termos, pagamento PIX
3. Lista de inscritos — grid de duplas, filtros por categoria, status
4. Check-in — QR code, lista presencial, contador "23/32 confirmados"
5. Grupos — cards por chave A/B/C/D com 4 duplas cada
6. Agenda de partidas — timeline por quadra (Q1, Q2, Q3) com horários
7. Bracket visual — oitavas → quartas → semi → final, linhas conectoras, placares
8. Feed pós-jogo — V-Clips do torneio, ranking atualizado, posts dos atletas

**Mockup simplificado (10 etapas, cards visuais mas sem interação completa):**
- Criação do torneio (form steps resumidos)
- Sorteio (animação de cards)
- Geração de jogos (lista compacta)
- Jogos em andamento (placar ao vivo)
- Registro de resultado (input de games)
- Avanço de fase (transição visual)
- Final (destaque de tela cheia)
- Resultado final (pódio 1º/2º/3º)
- Ranking atualizado (mudança de posição com setas)
- Visualização de grupos consolidada

### Visões por perfil

Cada etapa muda conforme o perfil ativo:

| Perfil | Foco principal |
|---|---|
| **Atleta** | Inscrição, minha agenda, meu próximo jogo, meu bracket, minha posição |
| **Arena** | Quadras alocadas, check-in operacional, timeline da arena |
| **Organizador** | Criação, gestão de chaves, sorteio, registro de resultados, controle |
| **Público** | Página pública, bracket read-only, ranking, feed social |

### Dados simulados realistas

Mock fixo embutido no protótipo:

```text
Torneio:    "Beach Tennis Open Floripa — 5ª Etapa"
Local:      Arena Praia Mole, Florianópolis-SC
Modalidades: Beach Tennis Mista C / Open / Iniciante
Datas:      15-16 Nov 2026
Duplas:     "Larissa Mendes & Camila Ribeiro", "Pedro Santana & Rafael Lima",
            "Bruno Vasconcelos & Tiago Almeida", "Marina Costa & Júlia Pacheco"...
Quadras:    Q1 Praia, Q2 Sunset, Q3 Pôr do Sol
Placares:   6/4 6/2, 7/6(5) 4/6 10/8, etc.
```

Também inclui um cenário paralelo curto de **futevôlei** para mostrar variação de modalidade.

### Bracket crítico

O componente de bracket terá renderização fiel: 8 confrontos nas oitavas → 4 nas quartas → 2 nas semis → 1 final, com linhas conectoras em SVG, placares preenchidos, vencedor destacado em verde neon, perdedor em opacidade reduzida. Avatares clicáveis (mock) levam a um drawer com mini perfil.

### Estilo visual

- Mobile-first: frame fixo de 390×844 simulando iPhone, com chrome do sistema
- Cards com `bg-card`, bordas `border-border`, radius `rounded-xl`
- Highlights em `text-primary` (verde neon) seguindo regra de não pintar tudo
- Bebas Neue em headings de seção, Inter no corpo
- Sem termos técnicos, sem mostrar backend, sem mencionar IA/ORKYM

### Arquivos a criar

```text
src/pages/FlowTournament.tsx                  ← rota principal
src/components/flow-tournament/
  ├─ FlowShell.tsx                            ← layout 3 eixos + frame mobile
  ├─ StepStepper.tsx                          ← stepper das 18 etapas
  ├─ ProfileTabs.tsx                          ← Atleta/Arena/Organizer/Público
  ├─ StateChips.tsx                           ← Vazio/Cheio/Em andamento/Final
  ├─ ScreenInfoPanel.tsx                      ← painel lateral descritivo
  ├─ MobileFrame.tsx                          ← bezel + status bar
  ├─ mock/tournamentData.ts                   ← dados simulados
  └─ screens/
      ├─ S01_Create.tsx          (simplif.)
      ├─ S02_PublicPage.tsx      (HI-FI)
      ├─ S03_Enrollment.tsx      (HI-FI)
      ├─ S04_Athletes.tsx        (HI-FI)
      ├─ S05_CheckIn.tsx         (HI-FI)
      ├─ S06_Groups.tsx          (simplif.)
      ├─ S07_Draw.tsx            (simplif.)
      ├─ S08_GroupsView.tsx      (HI-FI)
      ├─ S09_GenerateMatches.tsx (simplif.)
      ├─ S10_Schedule.tsx        (HI-FI)
      ├─ S11_Bracket.tsx         (HI-FI)
      ├─ S12_LiveMatches.tsx     (simplif.)
      ├─ S13_RegisterResult.tsx  (simplif.)
      ├─ S14_PhaseAdvance.tsx    (simplif.)
      ├─ S15_Final.tsx           (simplif.)
      ├─ S16_FinalResult.tsx     (simplif.)
      ├─ S17_RankingUpdate.tsx   (simplif.)
      └─ S18_PostFeed.tsx        (HI-FI)
```

E adição de uma rota em `src/App.tsx`: `<Route path="/flow-tournament" element={<FlowTournament />} />`

### Detalhes técnicos

- 100% client-side, dados mockados em memória (zero backend, zero migrations)
- Estado da navegação por `useState` (etapa, perfil, estado), URL sincronizada via `useSearchParams` para permitir compartilhar links tipo `/flow-tournament?step=11&role=athlete&state=live`
- Reuso dos componentes de UI já existentes (`Card`, `Button`, `Badge`, `Avatar`) — só novos componentes para o frame mobile e o bracket SVG
- Sem dependências novas; SVG inline para o bracket
- Não toca nada do fluxo real de torneios (`Tournaments.tsx`, `TournamentDetail.tsx`, `Brackets.tsx`) — é uma rota paralela isolada

### Como você vai usar

1. Acessa `/flow-tournament`
2. Vê a tela 1 com perfil "Atleta" por padrão
3. Avança pelo stepper (próximo / anterior / clique direto)
4. Troca o perfil para ver a mesma etapa sob outra ótica
5. Alterna estados (vazio → cheio → finalizado) onde fizer sentido
6. Compartilha qualquer combinação por URL

### Fora do escopo

- Não cria nenhuma migration, edge function ou tabela
- Não altera o fluxo real de torneios em produção
- Não conecta a dados reais — todo conteúdo é mock fixo
- Não inclui PDF/PNG export (pode ser adicionado depois se quiser uma versão estática)