

# Fase 11.7 — WhatsApp-First Conversational Layer (UX-only)

> **Princípio**: zero banco, zero edge, zero RLS, zero ORKYM core. Apenas adicionar uma **camada visual conversacional** consistente em todos os 6 dashboards das Fases 11.2–11.6, deixando claro que a operação rápida acontece no WhatsApp e que dashboards são camada de controle.

---

## Diagnóstico atual

- 6 dashboards já reorganizados (Arena/Tenant/Organizer/Athlete/Company/Admin) — todos com padrão visual similar (`SectionHeader` + `KpiCard` + `ShortcutLink`).
- ORKYM já integrada via `OrkymActionsCard` + `OrkymInsightsCard` (usado no Arena).
- QR Check-in já existe em `/arena/checkin` + `ArenaClassEnrollments` (geração de QR), mas é **invisível** fora desses 2 contextos.
- Campo `whatsapp` existe em `profiles`, `bookings`, `companies`, `arenas`, `tournament_entries` — mas **não há nenhum CTA `wa.me://` em nenhum lugar do produto**.
- Nenhum componente conversacional/comando-exemplo existe.

---

## 1. Componentes novos (4 arquivos compartilhados)

Pasta nova: `src/components/conversational/`

### 1.1 `WhatsAppCTA.tsx` (~60 linhas)
Botão padronizado verde-WhatsApp que abre `https://wa.me/<numero>?text=<comando>` em nova aba. Variantes: `primary` (botão grande), `inline` (chip), `card` (card de ação).
```ts
<WhatsAppCTA command="Resumo da operação de hoje" label="Pedir pelo WhatsApp" variant="card" />
```
Número-alvo lido de `VITE_ORKYM_WHATSAPP` (env já configurável; fallback para placeholder `+55 11 99999-9999` com toast "Conecte o WhatsApp da sua arena").

### 1.2 `CommandExamplesCard.tsx` (~90 linhas)
Card "O que você pode pedir pelo WhatsApp" — lista de 3-6 exemplos de comandos por perfil, cada exemplo é um `WhatsAppCTA` inline. Props: `title`, `examples: { icon, command, hint? }[]`.

### 1.3 `OperationModeBanner.tsx` (~50 linhas)
Banner sutil no topo do dashboard explicando: **"Este painel é para visão e controle. Operações rápidas → WhatsApp · Entrada física → QR · Inteligência → ORKYM"**. Dismissable via `localStorage` por perfil (`mp_op_banner_arena_dismissed` etc).

### 1.4 `QrEntryCard.tsx` (~70 linhas)
Card destacado "Entrada por QR" com ícone grande, descrição do uso (check-in / acesso / ativação) e CTA. Aceita props `title`, `subtitle`, `ctaTo`, `ctaLabel`. Reusa `lucide-react QrCode` + estilo já consagrado.

---

## 2. Catálogo de comandos por perfil

Arquivo novo `src/lib/conversationalCommands.ts` (~150 linhas, **pure data**, zero lógica):

```ts
export const COMMANDS = {
  arena: [
    { icon: "Trophy", command: "Criar torneio sábado beach tennis 16 vagas", hint: "Cria torneio em segundos" },
    { icon: "Receipt", command: "Abrir cobrança do João", hint: "Envia link de pagamento" },
    { icon: "Activity", command: "Como está a operação de hoje?", hint: "Resumo do dia" },
    { icon: "Users", command: "Quais alunos faltaram?", hint: "Lista de ausências" },
    { icon: "AlertTriangle", command: "Abrir ocorrência da quadra 2", hint: "Registra ticket" },
  ],
  organizer: [ /* 5 comandos */ ],
  athlete:   [ /* 4 comandos */ ],
  company:   [ /* 4 comandos */ ],
  tenant:    [ /* 4 comandos */ ],
  admin:     [ /* 4 comandos */ ],
} as const;
```

Cada comando vira um `wa.me?text=` quando clicado.

---

## 3. Aplicação por dashboard (6 edits cirúrgicos)

Para **cada um dos 6 dashboards**, adicionar logo abaixo do hero/control tower:

```tsx
<OperationModeBanner profile="arena" />          {/* dismissable */}
<div className="grid md:grid-cols-2 gap-4">
  <CommandExamplesCard
    title="Operar pelo WhatsApp"
    examples={COMMANDS.arena}
  />
  <QrEntryCard
    title="Entrada física"
    subtitle="Check-in de aulas, torneios e quadras"
    ctaTo="/arena/dashboard/aulas-matriculas"
    ctaLabel="Gerar QR de check-in"
  />
</div>
```

Posicionamento por dashboard:

| Dashboard | Inserção | QrEntryCard aponta para |
|---|---|---|
| `ArenaDashboard.tsx` | Após Control Tower | `/arena/dashboard/aulas-matriculas` (QR já existe) |
| `OrganizerDashboard.tsx` | Após Event Control Tower | Manage tournament check-in |
| `AthleteDashboard.tsx` | Após Hero | `/arena/checkin` (instrução: aponte a câmera no QR da arena) |
| `CompanyDashboard.tsx` | Após Control Tower | (sem QR — esconde QrEntryCard, full-width nos comandos) |
| `TenantDashboard.tsx` | Após Control Tower | (sem QR — esconde) |
| `AdminDashboard.tsx` | Após métricas | (sem QR — esconde) |

---

## 4. ORKYM como cérebro conversacional (reforço visual)

No `OrkymActionsCard` já existente, adicionar em cada proposta um terceiro botão **"Continuar no WhatsApp"** (variante ghost) que abre `wa.me?text=Aprovar ação <id> — <título>`. Edit cirúrgico de ~10 linhas.

Sem alterar a lógica de `approveAction`/`executeAction` — apenas mais um caminho de execução para o usuário humano.

---

## 5. Sidebars — destaque visual leve

Em cada uma das 6 sidebars (`ArenaSidebar`, `TenantSidebar`, `OrganizerSidebar`, `AthleteSidebar`, `CompanySidebar`, `AdminSidebar`), adicionar **no rodapé** um item discreto:

```tsx
<SidebarMenuItem>
  <WhatsAppCTA variant="inline" command="Olá" label="Falar com a ORKYM" />
</SidebarMenuItem>
```

1 linha por sidebar.

---

## 6. Configuração

`.env` permanece intocado (auto-gerado). Adicionar fallback no `WhatsAppCTA`:
- Lê `import.meta.env.VITE_ORKYM_WHATSAPP` se existir.
- Caso contrário, usa placeholder visual `+55 (11) 99999-9999` com badge "configure no admin" — apenas informativo.

Sem secret novo obrigatório nesta fase. (Se o usuário quiser fixar o número real, adiciona via Connectors → secret depois.)

---

## 7. Arquivos tocados

| Tipo | Arquivo |
|---|---|
| Novo | `src/components/conversational/WhatsAppCTA.tsx` |
| Novo | `src/components/conversational/CommandExamplesCard.tsx` |
| Novo | `src/components/conversational/OperationModeBanner.tsx` |
| Novo | `src/components/conversational/QrEntryCard.tsx` |
| Novo | `src/lib/conversationalCommands.ts` |
| Edit | `src/pages/arena-dashboard/ArenaDashboard.tsx` (~12 linhas) |
| Edit | `src/pages/organizer/OrganizerDashboard.tsx` (~12 linhas) |
| Edit | `src/pages/athlete/AthleteDashboard.tsx` (~12 linhas) |
| Edit | `src/pages/company/CompanyDashboard.tsx` (~12 linhas) |
| Edit | `src/pages/tenant/TenantDashboard.tsx` (~12 linhas) |
| Edit | `src/pages/admin/AdminDashboard.tsx` (~12 linhas) |
| Edit | `src/components/orkym/OrkymActionsCard.tsx` (+1 botão) |
| Edit | 6× sidebars (1 linha cada no rodapé) |
| Memory | `mem/features/whatsapp-first-layer.md` (novo) |

**Total**: 5 arquivos novos + 13 edits mínimos + 1 memory.

---

## 8. Garantias de não-regressão

- Zero rotas novas, zero rotas removidas.
- Zero migration, zero edge, zero RLS, zero alteração ORKYM core.
- `OrkymActionsCard` ganha 1 botão extra — `approveAction`/`executeAction`/`rejectAction` intactos.
- `WhatsAppCTA` é puramente client-side (`window.open(wa.me)`); sem fetch, sem mutation.
- Banner é dismissable (não polui retornos futuros).
- Build TS limpo.

---

## 9. ENTREGA B — Relatório

| Item | Resultado |
|---|---|
| Reaproveitado | Padrão visual `SectionHeader`/`KpiCard` das Fases 11.2–11.6, `OrkymActionsCard`, `/arena/checkin` existente, ícones `lucide-react QrCode`, campo `whatsapp` já presente em várias tabelas |
| Reorganizado | 6 dashboards passam a ter, no topo, `OperationModeBanner` + duo `CommandExamplesCard` × `QrEntryCard` — deixa claro que dashboard é camada de controle |
| Renomeado | Nada — apenas adições |
| WhatsApp-first | `wa.me://` aparece em 7 superfícies: 6 dashboards + ORKYM action card; sidebars têm atalho rodapé "Falar com a ORKYM" |
| QR como entrada | `QrEntryCard` torna QR visível em Arena/Organizer/Athlete (perfis físicos); aponta para fluxos já existentes |
| ORKYM cérebro | `OrkymActionsCard` ganha CTA "Continuar no WhatsApp" — dashboard mostra estado, WhatsApp executa |

## 10. ENTREGA C — Pendências

- **11.8**: edge function `wa-bridge` que recebe webhook do WhatsApp e dispara `orkym-invoke` com o comando
- **11.9**: secret `VITE_ORKYM_WHATSAPP` configurado per-tenant (cada tenant tem seu próprio número)
- **11.10**: deeplinks de QR para fluxos não-arena (acesso a evento, ativação de campanha)
- **11.11**: histórico de comandos WhatsApp visível no dashboard (depende de tabela nova)
- **11.12**: voice notes → ORKYM (transcrição via OpenAI Whisper)
- **11.13**: rich messages do ORKYM (botões nativos do WhatsApp Business)

## 11. Critério de sucesso

- ✅ Cada dashboard mostra claramente "operar pelo WhatsApp" + "entrada por QR"
- ✅ Banner dismissable explica os 3 canais (WhatsApp / QR / Dashboard)
- ✅ Cada perfil tem 4-5 comandos prontos para clicar
- ✅ ORKYM action card permite continuar no WhatsApp
- ✅ Zero migration, zero edge, zero RLS, zero ORKYM core alterado
- ✅ Build limpo, todas rotas intactas

