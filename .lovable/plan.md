## Fase: Arena Physical Experience

Objetivo: transformar a entrada física da arena em uma experiência conversacional ao vivo, sem ERP, sem IA exposta, sem cadastro. Toda a base (tabelas `arena_checkins`, `wa_qr_tokens`, `bookings`, `booking_checkin_links`, edge `arena-public-checkin`, RPC `arena_checkin_complete/booking_checkin_resolve`) já existe e será reaproveitada. Trabalho é majoritariamente frontend.

### 1. Página /arena/recepcao (nova)

Arquivo: `src/pages/arena-dashboard/ArenaReception.tsx` (rota dentro do `ArenaLayout`).
- Layout mobile-first, tela cheia, tipografia esportiva (Bebas para títulos curtos como "AGORA", "PRÓXIMOS").
- Polling 15s + realtime subscription em `arena_checkins` (INSERT) e `bookings` (UPDATE) — padrão já usado em `ArenaCheckinList.tsx`.
- 5 blocos:
  1. **Acabou de entrar** — últimos 10 check-ins (30 min), nome + esporte + hora, animação fade-in para novos.
  2. **Chegando agora** — bookings das próximas 2h com status de check-in (chegou / pendente / atrasado se `start_time` < now -10min).
  3. **Próximas aulas** — `arena_classes` das próximas 3h com contagem de alunos vs presentes.
  4. **Torneios ativos** — `tournaments` com `status='ongoing'` na arena.
  5. **QR principal** — card grande, mostra o QR de check-in ativo (`wa_qr_tokens` kind='checkin'), botão "Abrir em tela cheia".
- Ações rápidas (barra sticky no topo): Abrir QR cheio, Localizar reserva (busca por nome/telefone/shortcode), Registrar presença manual (dialog), Abrir conversa (link `/arena/dashboard/mensagens-wa`).
- Adicionar item "Recepção" no topo do grupo "Hoje" do `ArenaSidebar.tsx`.

### 2. /arena/dashboard/qr — refino

Arquivo existente: `src/pages/arena-dashboard/ArenaQR.tsx`.
- Adicionar coluna/contador de scans visível (já temos `scans_count`).
- Botão "Abrir tela cheia" em cada QR → modal preto com QR gigante, nome da arena, ideal para tablet na recepção.
- Filtro por tipo (chips: arena / check-in / quadra / torneio / aula / produto / promo / campanha).
- Adicionar tipo `campaign` à lista `QR_KINDS` (atualmente cobre 7 dos 8 pedidos).
- Status: mostrar "Última leitura há Xmin" (campo `last_scan_at` se existir, senão omitir).
- Vincular QR de quadra/aula/torneio a um recurso específico via Select no dialog de criação (lista `courts`/`arena_classes`/`tournaments`).

### 3. Check-in conversacional (refino)

Páginas existentes: `src/pages/PublicCheckin.tsx` + edge `arena-public-checkin`. Já cumpre <30s. Ajustes:
- Reduzir para 1 tela: telefone + nome no mesmo passo, esportes como chips abaixo (1 toque envia).
- Auto-foco no input, formatação BR no telefone.
- Tela "done" mostra contador "Você é o Nº da arena hoje" (consulta count do dia).
- Sem alterações de schema/edge.

### 4. Reserva de grupo

A tabela `booking_checkin_links` (shortcode) já existe e a edge resolve via `resolve_booking`. Faltam UI:
- Em `ArenaBookings.tsx` (e na confirmação após criar reserva): botão "Link do grupo" → modal com QR + URL `/c/{shortcode}` + botão Compartilhar (Web Share API) + "Enviar no WhatsApp" (`https://wa.me/?text=...`).
- Card "Grupo" dentro do detalhe da reserva mostrando confirmados/chegaram/pendentes (count em `arena_checkins` onde `booking_id=...`).
- No bloco "Chegando agora" da Recepção, expandir cada reserva para listar membros e quem fez check-in.

### 5. Realtime / polling

- Recepção: canal supabase em `arena_checkins` (INSERT filter `arena_id=eq.{id}`) + interval 30s para bookings/aulas.
- Toast discreto + som curto opcional (off por padrão) quando alguém entra.
- Indicador "AO VIVO" piscando no header.

### 6. Feed social

`arena_checkins` tem `social_identity_id`. Reusar `SocialActivityFeed` existente: adicionar handler que, ao receber INSERT de check-in com `visibility='public'`, publica linha "{nome} está na {arena} jogando {esporte}". Sem mudar privacidade default (continua 'arena').
- Apenas frontend: filtrar checkins públicos do dia e renderizar como cards no `Feed.tsx` já existente, behind toggle do perfil. Implementação leve: hook `useArenaPublicCheckins(arenaId)` consumido por um novo `<ArenaLiveStrip>` no perfil público da arena (`ArenaPublic.tsx`).

### 7. CRM automático

Sem nova tabela. Adicionar view client-side em `ArenaStudents.tsx`:
- Coluna "Última visita" e "Frequência (30d)" calculadas a partir de `arena_checkins` (join por `social_identity_id` ↔ `student.social_identity_id`).
- Filtro "Inativos > 21d" / "Frequentes" como chips.
- Botão "Abrir conversa" por aluno usando `phone_e164`.

### 8. WhatsApp ações rápidas

Em todos os cards de pessoa (Recepção, Bookings, Students):
- Botão WhatsApp → abre `https://wa.me/{phone}` (sem comando).
- Botão "Enviar QR" → gera link do QR check-in da arena e abre share/WhatsApp.
- Botão "Compartilhar reserva" → usa shortcode da reserva.

Tudo via links `wa.me`, nenhum comando técnico, nenhuma menção a tokens/IA.

### 9. Out of scope (não fazer)

- Sem novas tabelas, sem migration.
- Sem mexer em `wa-bridge`, MoodPlay, ORKYM, control-tower.
- Sem ERP, sem cobrança de couvert, sem catraca, sem cadastro CPF/email.
- Sem analytics novos; reaproveita o que já está em `ArenaCheckinList`.
- Sidebar não ganha grupos novos — só o item "Recepção" no grupo "Hoje".

### Arquivos previstos

Novos:
- `src/pages/arena-dashboard/ArenaReception.tsx`
- `src/components/arena/reception/NowEnteringBlock.tsx`
- `src/components/arena/reception/ArrivingBlock.tsx`
- `src/components/arena/reception/UpcomingClassesBlock.tsx`
- `src/components/arena/reception/ActiveTournamentsBlock.tsx`
- `src/components/arena/reception/MainQRCard.tsx`
- `src/components/arena/reception/FullscreenQRDialog.tsx`
- `src/components/arena/reception/ManualPresenceDialog.tsx`
- `src/components/arena/reception/LocateBookingDialog.tsx`
- `src/components/arena/BookingGroupShareDialog.tsx`
- `src/components/arena/ArenaLiveStrip.tsx`
- `src/hooks/useArenaCheckinsLive.ts`
- `src/hooks/useArenaPublicCheckins.ts`

Editados:
- `src/App.tsx` (rota `/arena/recepcao` dentro de `ArenaLayout`)
- `src/layouts/sidebars/ArenaSidebar.tsx` (item Recepção)
- `src/pages/arena-dashboard/ArenaQR.tsx` (fullscreen, filtros, vínculo a recurso, tipo campaign)
- `src/pages/arena-dashboard/ArenaBookings.tsx` (botão grupo)
- `src/pages/arena-dashboard/ArenaStudents.tsx` (CRM frequência)
- `src/pages/PublicCheckin.tsx` (unificar telefone+nome+esporte em uma tela)
- `src/pages/arenas/ArenaPublic.tsx` (ArenaLiveStrip)
- `.lovable/plan.md` (registro)

### Critério de sucesso

- Dono abre `/arena/recepcao` no tablet e vê quem está entrando ao vivo.
- Cliente escaneia QR e entra em <30s, 1 tela só.
- Reserva tem QR de grupo compartilhável em 1 toque.
- Sidebar "Hoje" tem Recepção como primeiro item.
- Nenhuma menção a IA, ORKYM, tokens ou comandos técnicos na UI.
