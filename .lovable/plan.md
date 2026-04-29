
# AUDITORIA — FLUXO DE TORNEIOS (PRÉ GO-LIVE)

Diagnóstico brutalmente honesto. Nada será implementado nesta fase.

---

## 0. VEREDITO RESUMIDO

**Status: 🟠 BETA READY COM RESSALVAS — NÃO GO LIVE READY.**

Um torneio real **pode acontecer amanhã** se for operado **pelo dashboard web por um humano** (organizer). A camada conversacional WhatsApp/ORKYM **não fecha o ciclo de torneios** — ela cria torneio mas não cobre inscrição/grupos/check-in/placar/resultado via WhatsApp.

- **Funciona web:** criação, inscrição, pagamento, gerenciamento, edição, modalidades, brackets, partidas, placar, ranking, perfil público, feed.
- **Funciona parcial via WhatsApp:** apenas `create_tournament`, `list_pending_enrollments`, `get_tournament_standings`, `validate_checkin` (este via QR, não conversacional puro).
- **Não existe (P0/P1):** sorteio de grupos, lembrete automático de jogo, baixa-inscrição proativa para torneio, QR de inscrição, QR de torneio compartilhável, link público com SEO/preview, notificação WhatsApp de placar, atribuição de receita real (banco está com 0 transações).

---

## 1. EVIDÊNCIAS DE BANCO (estado atual)

```
tournaments:                 8
enrollments:                23
modality_matches:           69
modality_groups:            36
modality_entries:           78
arenas:                      0   ← seed pendente / piloto não criado
whatsapp_instances:          0   ← gate vai bloquear shells (exceto super admin)
financial_transactions:      0   ← receita NUNCA fluiu pelo split
orkym_triggers_queue:        0   ← proativa nunca rodou
orkym_revenue_attribution:   0   ← atribuição existe em schema, sem dado
```

Triggers em `tournaments / enrollments / modality_matches / financial_transactions`: **NENHUM trigger SQL ativo nessas tabelas** (consulta `information_schema.triggers` retornou vazio). RPCs existem (`trg_activity_from_enrollment`, `trg_enrollment_record_payment`, etc.) mas **não estão attach-adas como TRIGGER no DDL atual**. → **P0 invisível**: feed social e atribuição de receita dependem disso.

---

## 2. MAPA POR PERFIL

### Super Admin
- Vê tudo: `/admin/tournaments`, `/admin/enrollments`, `/admin/finances`, `/admin/control-tower`.
- Bypass de gate WhatsApp. **OK.**
- Gap: dashboard de torneios sem KPI de "torneios ativos por arena/tenant"; só lista.

### Tenant Admin
- Acessa `/tenant/dashboard`. Bloqueado pelo gate WhatsApp (0 instances).
- Não tem tela própria de "torneios da rede" — `tenant/dashboard` aponta para `OrganizerSettings`/`OrganizerArenas` em vários itens (rota duplicada).
- Comandos WA: `TenantCommands` existe, mas nenhum intent de "resumo dos torneios da rede" implementado.
- **P1**: nenhuma view tenant-scoped agregando torneios.

### Arena
- `/arena/dashboard/torneios` → `ArenaTournaments.tsx` lista por `arena.eq.{name} OR tenant_id`. **Heurística frágil** (match por nome string). **P2**.
- Sem QR de torneio gerável daqui. **P1**.
- Sem botão "criar torneio" no shell da arena. **P2** (organizer faz).
- Comandos WA da Arena: nenhum intent específico de torneio (tudo focado em aulas/reservas).

### Organizer
- `/organizer/dashboard` é uma única página com seções `eventos`, `inscricoes`, `jogos`, `performance` (anchors `#eventos` etc.). **Todas as sub-rotas (`/eventos`, `/inscricoes`, `/jogos`) renderizam o MESMO `OrganizerDashboard`** — apenas scrollam para anchor. **P2 UX**.
- Cria torneio em `/tournaments/create` (520 linhas, fluxo robusto, ViaCEP, builder por gênero, slot config). **OK.**
- Gerencia em `/tournaments/:id/manage` com tabs Inscrições / Categorias / Check-in. Brackets em `/tournaments/:id/brackets` separado.
- "Enviar lembrete" no manage é **fake** (`toast` sem chamada real). **P1**.
- Sem botão "sortear grupos" via UI — a auditoria de `Brackets.tsx` mostra `GenerateBracketDialog` mas sem fluxo de sorteio guiado.

### Athlete
- Vê `/tournaments` (público) e `/tournaments/:id`. Inscreve-se via `handleEnroll` → `/payment/:id`. **OK**.
- "Procurar parceiros" → `/tournaments/:id/match` existe.
- **Não recebe nada por WhatsApp** sobre torneios (sem trigger, sem proativa, sem confirmação). **P0 da camada conversacional**.
- Activities geradas só se trigger SQL existir — **não existe** → perfil público de atleta não atualiza após inscrição/jogo. **P0**.

### Company / Patrocinador
- `CompanySponsorBridge` + `SponsorTournaments`: vê torneios e pode patrocinar. **OK.**
- `TournamentDetail` mostra parceiros via `tournament_partners`. **OK.**
- Sem fluxo de "ofertar produto patrocinado dentro do torneio". **P3.**

---

## 3. FLUXO PONTA A PONTA (cenário "torneio amanhã")

```text
[1] CRIAR TORNEIO
    web: ✅ /tournaments/create (organizer)
    WA:  ⚠️ flow create_tournament existe, mas falta: arena_id, modality, gender,
         slot_config, payment_deadline. Cria registro mínimo sem categoria.
[2] CATEGORIAS / MODALIDADES
    web: ✅ slot_config no create + TabCategorias edita team_size/phase/rules_json
    WA:  ❌ não existe intent
[3] LINK PÚBLICO + SEO
    /tournaments/:id existe e renderiza sem login.
    ❌ Sem og:tags, sem share preview, sem QR shareable do torneio.   P1
[4] DIVULGAÇÃO
    ❌ Não há trigger "novo torneio relevante" → atletas não são notificados.
    ❌ Sem post automático no feed social.   P1
[5] INSCRIÇÃO
    web: ✅ via /tournaments/:id (com termos + parceiros)
    WA:  ❌ não existe intent enroll_athlete
    QR:  ❌ não existe QR de inscrição
[6] PAGAMENTO
    /payment/:id usa create-payment + Mercado Pago.   ✅
    Webhook mercadopago-webhook existe.   ✅
    ❌ financial_transactions = 0 no banco — NUNCA executou em produção. RISCO ALTO de bug latente. P0 validar com 1 pagamento real.
    ❌ orkym_revenue_attribution depende de trigger no financial_transactions paid → trigger não está instalado. P0.
[7] CHECK-IN
    web: ✅ TabCheckin (toggle manual)
    QR:  ✅ wa-bridge consome qrIntent="checkin" → arena_checkin_validate
         (mas validate é de arena_attendance, não de enrollment de torneio).   P1 mismatch.
    WA conversacional: ❌
[8] SORTEIO / GRUPOS
    Tabela modality_groups existe (36 rows seed). UI: TabGroups.
    ❌ Não há RPC "sortear grupos" automático — operador cria manual.   P1
    WA: ❌
[9] PARTIDAS / CHAVEAMENTO
    web: ✅ Brackets.tsx + TabBracketView + ScoreEntryDialog
    Agendamento de horário/quadra: ⚠️ depende de manual; sem integração com arena_courts.   P2
    WA: ❌ "meu jogo é que horas?" não responde
[10] RESULTADOS / RANKING
    web: ✅ ScoreEntryDialog grava modality_matches; get_tournament_standings RPC.
    Feed social/perfil público: ❌ trigger trg_activity_from_match não instalado.   P0
    WA: ❌
[11] NOTIFICAÇÕES
    ❌ Praticamente inexistentes em runtime. Toast no front é tudo.
[12] ORKYM PROATIVA
    Trigger types referenciados: low_enrollment, relevant_tournament — porém
    nenhuma RPC povoa orkym_triggers_queue para torneios. orkym_generate_periodic_triggers existe mas comportamento não auditado para torneios.   P1
[13] RECEITA ATRIBUÍDA
    Tabela orkym_revenue_attribution existe; KPIs RPC existem (orkym_revenue_kpis_*).
    ❌ Sem dado, sem trigger, sem fluxo testado.   P0
```

---

## 4. WHATSAPP CONVERSACIONAL — COBERTURA REAL

| Comando esperado | Existe? | Onde |
|---|---|---|
| "criar torneio" | ⚠️ parcial | `flows.create_tournament` + handler em `moodplay-execute-action` |
| "quantos inscritos?" | ❌ | sem intent |
| "quem não fez check-in?" | ❌ | sem intent |
| "quais jogos faltam?" | ⚠️ | `list_today_matches` RPC existe, sem intent WA |
| "gerar QR" | ❌ | sem intent (QR é gerado só pelo dashboard de arena/aula) |
| "abrir inscrições" | ❌ | sem intent |
| "sortear grupos" | ❌ | sem RPC nem intent |
| "registrar placar" | ❌ | sem intent |
| "me inscrever" | ❌ | sem intent enroll_in_tournament |
| "meu jogo é que horas?" | ❌ | sem intent |
| "fazer check-in" (QR) | ✅ | wa-bridge qrIntent=checkin |
| "ver resultado" | ⚠️ | `get_tournament_standings` existe; sem intent NLU |
| "resumo torneios da rede" (tenant) | ❌ | sem intent |

**Cobertura conversacional de torneios: ~10%.**

---

## 5. SEGURANÇA / RLS

- Pages públicas (`/tournaments`, `/tournaments/:id`, `/athletes/:id`, `/arenas/:slug`) não exigem login. ✅
- `TournamentDetail` faz `select * from tournaments`. RLS deve cobrir — não auditado nesta sessão (escopo). **P2**: confirmar que RLS de `tournaments` permite anon SELECT.
- `enrollments` usa contagem com `count: 'exact', head: true` — vaza `count` para anon? **P2**.
- Pagamento usa MP Brick — verificar que `mp_collector_id` não vaza para outros perfis.
- `organizer_id === user.id` controla "Gerenciar" no front, mas RLS deve barrar update no servidor — **não validado**.

---

## 6. UX / MOBILE

- `TournamentDetail` mobile-first ✅
- `ManageTournament` é desktop-pesado; tabs OK em mobile mas tabelas estouram. **P2.**
- `Brackets` ScoreEntryDialog em mobile precisa teste real. **P2.**
- Empty states existem em TabCategorias/TabCheckin ✅
- Sem skeleton em TournamentDetail. **P3.**

---

## 7. CLASSIFICAÇÃO P0/P1/P2/P3

### P0 — bloqueia go live
1. **Triggers SQL ausentes** em `enrollments`, `modality_matches`, `financial_transactions` → feed, perfil, ranking, atribuição de receita não funcionam end-to-end.
2. **Pagamento nunca executou** em produção (0 financial_transactions). Risco real de webhook MP falhar silenciosamente.
3. **Atribuição de receita ORKYM não está cadeada** ao financial_transactions paid → KPIs sempre zerados.
4. **0 arenas e 0 whatsapp_instances** → gates Tenant/Arena/Organizer/Company bloqueiam acesso (exceto super admin). Já existe botão "Criar piloto", precisa rodar antes do beta.
5. **Athlete não é notificado de nada** (inscrição, pagamento, jogo, resultado).

### P1 — corrigir antes de vender
1. Sem QR shareable do torneio (entrada física e divulgação).
2. Sem RPC/UI de sorteio automático de grupos.
3. "Enviar lembrete" no ManageTournament é fake (toast).
4. QR check-in atual valida `arena_attendance` (aulas), não `enrollments` de torneio — mismatch semântico.
5. Sem og:meta tags / share preview no /tournaments/:id.
6. Cobertura WhatsApp de torneios <10% — ORKYM "não sabe falar de torneio".
7. Tenant não tem view própria de torneios da rede.
8. Triggers proativos (`low_enrollment`, `relevant_tournament`) não têm gerador instalado.

### P2 — pode corrigir no beta
1. `OrganizerDashboard` rotas duplicadas (eventos/inscricoes/jogos/performance renderizam mesma página com anchor).
2. `ArenaTournaments` faz match por nome string.
3. RLS anon de `tournaments`/`enrollments` não revalidada nesta auditoria.
4. Sem agendamento integrado de quadras para partidas.
5. Mobile do ScoreEntryDialog/ManageTournament.
6. Profile/Brackets sem skeleton consistente.

### P3 — futuro
1. Patrocínio dentro do torneio com call-to-action de produto.
2. Histórico encerrado vira card "memória" no perfil.
3. SEO avançado (JSON-LD SportsEvent).

---

## 8. RESPOSTAS DIRETAS

**Pode acontecer um torneio real amanhã com MoodPlay + ORKYM?**
- **Operado por organizer no web: sim**, com 2 ressalvas: (a) testar 1 pagamento real ANTES (financial_transactions = 0); (b) aceitar que feed/ranking/perfil público não atualizam até instalar triggers SQL.
- **Operado via WhatsApp/ORKYM: não**. Cobertura conversacional é mínima.
- **Atleta tendo experiência fluida: não**. Sem notificações, sem updates de perfil, sem confirmações automáticas.

**Pode ir para produção?** **Não.** Há 5 P0.
**Pode vender beta controlado?** **Sim, com piloto manual** (1 organizer treinado + 1 arena + suporte ao vivo).
**Precisa corrigir antes?** Sim — pelo menos os 5 P0 listados.

---

## 9. PRÓXIMO PASSO RECOMENDADO (NÃO IMPLEMENTAR AGORA)

Quando você aprovar implementação, sugiro pacote enxuto **"Torneio Beta Real"**:

1. Reinstalar triggers em `enrollments`, `modality_matches`, `financial_transactions` (SQL DDL).
2. Smoke-test pagamento real (R$ 1) → verificar webhook + revenue attribution.
3. Implementar 4 intents WA mínimos: `enroll_in_tournament`, `my_next_match`, `tournament_status`, `register_score`.
4. RPC `sortear_grupos(_modality_id)` + botão na UI.
5. Gerar QR shareable do torneio + og:tags em `/tournaments/:id`.
6. Trocar "enviar lembrete" fake por chamada `wa-send-message`.
7. Rodar `seed-pilot-arena` + criar 1 instância WhatsApp real.

Diagnóstico encerrado. Aguardando sua decisão sobre qual P0 atacar primeiro.
