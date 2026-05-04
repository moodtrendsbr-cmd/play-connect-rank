
# Auditoria estrutural — Módulo Torneios (validação real)

## Veredito direto

**A correção foi escrita mas não foi aplicada.** A migration `20260504144850_*.sql` existe no disco do projeto, mas **não consta em `supabase_migrations.schema_migrations`** — ou seja, nunca foi executada no banco. Triggers ausentes, colunas ausentes, lógica nova inerte. O front-end já chama o novo fluxo, mas o banco é o de antes.

Resultado: **o módulo continua quebrado exatamente como estava antes da "correção"**.

---

## 1. Validação de dados (números reais agora)

| Métrica | Valor | Esperado pós-fix |
|---|---|---|
| Total enrollments | 28 | — |
| Enrollments `paid` | 21 | — |
| Enrollments com `modality_id` | **0** | >0 nas novas |
| Enrollments com `entry_id` | **0** | >0 nas pagas com modality |
| Pagos com modality, sem entry | 0 (porque ninguém tem modality) | 0 |
| `modality_entries` | 78 (todos seed de 2026‑02‑16) | — |
| `modality_entry_members` | **0** | ≥1 por entry real |
| `entries` sem members | **78 (100%)** | ~0 |
| `tournament_modalities` | 18 | — |
| `modality_matches` | 69 | — |
| `matches` com winner | 46 | — |
| `modality_placements` | **0** | >0 em torneios concluídos |

**Leitura honesta:**
- Pagamento → entrada: **NÃO funciona**. Zero enrollments têm `modality_id`, zero têm `entry_id`. O selector de categoria existe no Payment.tsx, mas o backend que materializa a entry **não existe** (trigger não criado).
- Entries sem members (78/78): herança do seed antigo + ausência da função que insere membros.
- Pódio: **0 registros** mesmo com 46 matches finalizadas e finais decididas.

## 2. Validação do schema (o que está faltando no banco)

```text
enrollments.entry_id ............... AUSENTE  (esperado: uuid FK)
modality_matches.source_a_match_id . AUSENTE
modality_matches.source_b_match_id . AUSENTE
modality_matches.source_a_role ..... AUSENTE
modality_matches.source_b_role ..... AUSENTE
modality_matches.bracket_side ...... AUSENTE
modality_placements UNIQUE(modality_id,position) ... AUSENTE

trg_enrollments_create_entry ....... AUSENTE (função e trigger)
trg_matches_advance ................ AUSENTE
trg_matches_finalize_podium ........ AUSENTE
```

`is_modality_tournament_owner`, `get_my_next_match`, `list_today_matches` existem (são antigas).

## 3. Fluxo ponta-a-ponta — o que acontece hoje

| Passo | Comportamento real |
|---|---|
| 1. Criar torneio | OK; `CreateTournament.tsx` agora insere em `tournament_modalities` (18 registros confirmam que a parte de UI roda). 🟢 |
| 2. Criar categorias | Junto com criação. 🟢 |
| 3. Inscrição com pagamento | UI já força escolher categoria; envia `modality_id`. **Mas no banco a coluna é gravada como NULL nas 28 inscrições atuais** — nenhuma criada via novo fluxo ainda, ou create-payment não persiste. 🟡 |
| 4a. Enrollment criado | OK |
| 4b. `modality_entry` automático | **NÃO** — trigger não existe. 🔴 |
| 4c. `modality_entry_members` | **NÃO** — função não existe. 🔴 |
| 5. Gerar chave | Edge function `generate-bracket` está deployada (verify_jwt=true) e o front chama ela. 🟢 código / 🟡 dados (tenta gravar `bracket_side`/`source_*` em colunas inexistentes → INSERT vai falhar em runtime) |
| 6. Bye/ímpar | Lógica server correta no código, mas **runtime quebrado** porque colunas não existem. 🔴 |
| 7. Registrar resultado | Manual (UI grava winner). OK. |
| 8. Avanço automático | **NÃO** — `trg_matches_advance` não existe. Próxima fase fica vazia. 🔴 |
| 9. Finalizar torneio | Manual. |
| 10. Pódio | **NÃO** — `trg_matches_finalize_podium` não existe. `modality_placements`=0. 🔴 |

## 4. Bracket — classificação

- Lógica: **server-side** (✓ migrou de client para edge function). 🟢 código
- Byes: algoritmo correto no código (padding até pow2, `winner_entry_id` pré-preenchido). 🟢 código / 🔴 dados (insere coluna `bracket_side` que não existe → falha)
- Números ímpares: tratados via byes. 🟢 código
- Double elimination: gera placeholders de losers bracket + grand final, mas **source links e progressão de loser nunca são preenchidos** no código atual (só winners avançam). É um esqueleto, não DE funcional. 🟡
- Matches completos: para single elim sim; para DE, só estrutura.

**Status real:** 🔴 — qualquer chamada à `generate-bracket` em produção hoje retorna erro de coluna inexistente.

## 5. Avanço de fase

- `trg_matches_advance` definida na migration, mas **não criada**. 🔴
- Sem o trigger, registrar resultado **não move** ninguém. Organizador teria que editar manualmente `entry_a_id`/`entry_b_id` da próxima rodada — não existe UI para isso.

## 6. Pódio

- `trg_matches_finalize_podium` definida, **não criada**. 🔴
- `modality_placements`: 0 registros, mesmo com 8/9 partidas finalizadas em duas modalidades.
- Nenhuma UI mostra pódio porque não há dado.

## 7. Experiência do atleta

- Componente `MyNextMatchCard.tsx` criado e integrado em `AthleteDashboard.tsx`. 🟢
- Consome RPC `get_my_next_match` (existe). 🟢
- **Porém**: como nenhum atleta tem `modality_entry_members`, o RPC **retorna vazio para todos**. O card aparece "sem próximos jogos". 🔴 efeito final.
- QR de check-in: `enrollments.checkin_token` existe; `MyNextMatchCard` renderiza QR via lib `qrcode`. 🟢 estrutura, 🟡 alcance (depende de enrollment ter virado entry).

## 8. WhatsApp

- Actions ORKYM existentes relevantes a torneios: enfileiramento de notificações em `enrollment_paid`, `match_result` (via memória `tournament-go-live-fix`). 🟢
- "Meu próximo jogo" / "registrar resultado" / "check-in" via WA: **não há handlers dedicados** no `orkym-execute-action` para esses verbos específicos no contexto torneio. ORKYM responde só ao que está cadastrado em `_shared/orkym-handlers.ts`. 🟡
- Como `modality_entry_members` está vazio, mesmo se houvesse handler, não acharia "meu jogo".

## 9. Inconsistências e duas verdades

1. **`tournaments.slot_config` (jsonb) vs `tournament_modalities`** — código novo grava nos dois; código antigo (EditTournamentForm, ManageTournament) lê só do jsonb. Duas verdades convivendo.
2. **Front-end novo + banco antigo** — `Payment.tsx` envia `modality_id`, `GenerateBracketDialog` chama edge function, `MyNextMatchCard` espera entry_id; banco não suporta nada disso.
3. **Entries seed (78) sem members (0)** — bracket-gerado em torneios atuais usa entries fantasmas; quem é "Time A" / "Time B" é placeholder do seed, ninguém real.
4. **`bracket_side` no INSERT da edge function** vai estourar erro de coluna inexistente assim que alguém clicar "gerar chave" em produção.

## 10. Notas (0–10, baseado no que está RODANDO, não no que está escrito)

| Item | Nota | Justificativa |
|---|---|---|
| Integração pagamento → categoria | **2** | UI manda; banco descarta; 0/28 enrollments com modality |
| Estrutura de dados | **3** | Schema novo não aplicado; FKs ausentes; placements vazio |
| Bracket | **3** | Server-side correto em teoria; quebra em runtime por colunas faltantes |
| Automação | **1** | Nenhum dos 3 triggers críticos existe |
| Experiência do atleta | **2** | Componente existe, dado não existe → tela vazia |

**Média: 2.2/10.**

## 11. Veredito final (sem rodeio)

- O sistema **NÃO** funciona como fluxo único.
- O torneio **NÃO** roda sozinho — pior: várias telas vão dar erro porque o front pressupõe schema que não existe.
- Continua existindo dois sistemas paralelos (`slot_config` jsonb vs `tournament_modalities` + entries reais vs entries seed).
- O código da correção foi escrito de forma plausível, mas **a migration que sustenta tudo nunca foi aplicada** — provavelmente foi rejeitada/não aprovada ou falhou silenciosamente. É preciso reaplicar essa migration e rodar um backfill para validar.

## 12. O que precisa acontecer para sair do 2.2 (não é parte da auditoria, mas é o caminho)

1. Reaplicar a migration `20260504144850_*.sql` (recriar como nova migration `20260504XXXXXX_*.sql`) — adiciona colunas, constraint, 3 triggers.
2. Backfill: para enrollments `paid` antigas com `modality_id` (atualmente 0), executar a função de criação de entry; para as 78 entries seed sem members, deletar ou marcar como descartáveis.
3. Validar: rodar `smoke-test-payment` (já existe) após migration; checar que `entry_id` é populado e que finalizar match dispara avanço + pódio.
4. Limpar `tournaments.slot_config` como fonte de verdade — passar `EditTournamentForm` e `ManageTournament` a ler de `tournament_modalities`.

---

**Conclusão honesta:** a correção foi *desenhada e codada*, não *entregue*. Em produção, hoje, o módulo torneios está pior do que antes — porque agora UI espera coisas que o banco não tem, então além de não automatizar, vai gerar erros de runtime na primeira chave gerada via novo dialog.
