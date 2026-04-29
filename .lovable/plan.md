# Camada de Identidade + Perfil Social + Feed Global (Fase Social-1)

## Princípios

- **Não duplicar** o que já existe. O sistema tem `athlete_activities`, `wa_identities`, `profiles`, `profiles_public`, `athletes_public`, `athlete_activities_public` e um `social_feed_public` (UNION). Vamos **estender**, não recriar.
- **Sem IA local**. Descrições por templates determinísticos. Qualquer notificação push é decidida por ORKYM (`/orkym-invoke`).
- **Multi-tenant preservado**. Nenhum evento sensível vaza entre tenants no feed global.
- **Telefone como chave** de identidade quando não há `auth.user`.

## Modelo conceitual

```text
[wa_identities]    +    [profiles (auth users)]
        \                   /
         \                 /
        [social_identities]   ← chave: phone_e164 (única); aponta para user_id se logou
                |
                v
        [social_profiles]     ← username, display_name, bio, avatar, visibility, level, sport, city
                |
                v
        [social_events]       ← log unificado tenant-aware (deriva de athlete_activities + bookings + payments)
                |
                v
        [social_feed_public]  ← VIEW pública filtrada por visibility + sensibilidade
```

## 1. Tabelas novas

### `social_identities`
- `id uuid pk`, `phone_e164 text unique not null`, `display_name text`, `avatar_url text`,
- `source text check in ('whatsapp','qr','booking','enrollment','signup','seed')`,
- `first_tenant_id uuid`, `first_arena_id uuid`,
- `user_id uuid` (FK lógica para `auth.users`, **nullable**, único quando preenchido),
- `wa_identity_id uuid` (FK lógica para `wa_identities.id`, nullable),
- `created_at`, `updated_at`.
- RLS: `select` para admin + dono (via `user_id = auth.uid()`); `insert/update` apenas via funções `SECURITY DEFINER`.
- Função pública: `social_identity_upsert(_phone, _name, _source, _tenant, _arena)` → retorna `identity_id`. Idempotente (ON CONFLICT phone).

### `social_profiles`
- `id uuid pk`, `identity_id uuid unique not null fk → social_identities`,
- `username citext unique` (gerado: slug do display_name + sufixo se colidir),
- `display_name`, `bio`, `avatar_url`,
- `visibility text default 'public' check in ('public','private')`,
- `level text check in ('iniciante','intermediario','avancado')`,
- `main_sport text`, `city text`, `state text`,
- `notif_opt_in boolean default true`,
- `created_at`, `updated_at`.
- Trigger: ao criar `social_identity`, cria `social_profile` automaticamente.
- RLS: `select` público apenas para `visibility='public'`; dono lê/edita o seu (via `identity.user_id = auth.uid()` ou via wa_identity verificada).
- View `social_profiles_public` (security_invoker=on) só com perfis públicos e colunas seguras.

### `social_events`
- `id uuid pk`, `tenant_id uuid not null`, `arena_id uuid`,
- `profile_id uuid not null fk → social_profiles`,
- `event_type text check in ('checkin','tournament_join','match_win','match_loss','booking','class_attendance','ranking_update','tournament_created','payment_completed')`,
- `entity_type text`, `entity_id uuid`,
- `payload jsonb default '{}'`,
- `visibility text default 'public' check in ('public','tenant','private')`,
- `created_at`.
- Índices: `(profile_id, created_at desc)`, `(tenant_id, created_at desc)`, `(event_type, created_at desc)`, `unique (profile_id, event_type, entity_id) where entity_id is not null` (dedup).
- RLS: `select` público para `visibility='public'`; admin/dono veem `tenant`/`private`.

## 2. Geração automática de eventos

Reutilizar a infraestrutura existente. **Não criamos novos triggers de origem** — em vez disso, criamos **um trigger único em `athlete_activities`** que projeta para `social_events`, mais dois triggers novos para fontes que `athlete_activities` ainda não cobre:

- `trg_social_from_activity` (AFTER INSERT em `athlete_activities`):
  - mapeia `activity_type` → `event_type`:
    - `tournament.enrolled` → `tournament_join`
    - `tournament.checked_in` → `checkin`
    - `tournament.match_won` → `match_win`
    - `tournament.match_lost` → `match_loss`
    - `class.attended` → `class_attendance`
    - `social.posted`/`clip_posted` → ignorar (já existem como posts/clips no feed atual)
  - resolve `profile_id` via `social_identity_for_user(athlete_id)` (cria identidade automaticamente para usuários auth via `auth.users.phone`/`profiles.phone` quando disponível).
- `trg_social_from_booking` (AFTER INSERT/UPDATE em `arena_bookings` quando status=`confirmed`/`paid`) → `booking`.
- `trg_social_from_financial_transaction` (AFTER UPDATE em `financial_transactions` quando status passa para `paid`) → `payment_completed` com `visibility='private'` por padrão (não vai pro feed público; serve de timeline pessoal).
- `trg_social_from_tournament` (AFTER INSERT em `tournaments` com status `published`) → `tournament_created` (autor: organizador).

Backfill único no fim da migração para popular o histórico.

## 3. Identidade a partir do WhatsApp

- `wa-bridge` e `orkym-whatsapp-connection` já recebem `wa_phone`. Adicionar chamada a `social_identity_upsert(phone, name, 'whatsapp', tenant, arena)` no fluxo de primeira mensagem/verificação.
- Quando `wa_identities.verified_at` é setado, **vincular** `social_identities.user_id = wa_identities.user_id` (e copiar avatar do profile se vazio).
- QR check-in (`enrollment_checkin_validate`, `arena_attendance`): se houver telefone na entrada, garantir identidade antes do registro do evento.

## 4. Feed global

Substituir/expandir a view atual `social_feed_public` para um UNION enxuto:

```sql
create or replace view social_feed_public with (security_invoker=on) as
select
  e.id              as event_id,
  e.event_type,
  e.created_at      as occurred_at,
  e.tenant_id, e.arena_id,
  sp.id             as profile_id,
  sp.username, sp.display_name, sp.avatar_url,
  a.name            as arena_name,
  t.name            as tenant_name,
  social_event_description(e.event_type, e.payload, sp.display_name, a.name) as description,
  e.payload
from social_events e
join social_profiles sp on sp.id = e.profile_id
left join arenas a on a.id = e.arena_id
left join tenants t on t.id = e.tenant_id
where e.visibility = 'public' and sp.visibility = 'public';
```

Posts/clips continuam sendo lidos pelo feed atual (posts UI). Esta view alimenta uma **timeline de atividades** (separada ou intercalada conforme o front decidir).

## 5. Geração de descrição (sem IA)

`social_event_description(event_type, payload, name, arena_name)` SQL puro com `case`:
- `checkin` → `"{name} fez check-in em {arena_name}"`
- `tournament_join` → `"{name} entrou em {payload->>'tournament_name'}"`
- `match_win` → `"{name} venceu sua partida"` (+ score se houver)
- `match_loss` → `"{name} disputou sua partida"`
- `booking` → `"{name} reservou {payload->>'court_name'}"`
- `class_attendance` → `"{name} treinou em {arena_name}"`
- `tournament_created` → `"Novo torneio: {payload->>'tournament_name'}"`
- demais → fallback genérico.

## 6. Anti-spam e qualidade

- Dedup por `(profile_id, event_type, entity_id)` (índice único).
- Throttle por trigger: ignorar se já existe evento mesmo `event_type` do mesmo profile há < 30s.
- `class_attendance` agrupado por dia (apenas 1 evento público por dia/arena).
- Eventos com payload sensível (valor de pagamento, dados de cartão) **nunca** entram com `visibility='public'`.

## 7. Privacidade

- `social_profiles.visibility='private'` esconde tudo do feed público (filtro na view).
- Por evento: `visibility='private'` (timeline pessoal só dele) ou `'tenant'` (só admins/staff do tenant).
- RPC `social_profile_set_visibility(_visibility)` para o usuário trocar.
- RPC `social_event_hide(_event_id)` (dono pode esconder evento específico).

## 8. Perfil do atleta — UI

Atualizar `UserProfile.tsx` e `Profile.tsx` para exibir um bloco **Atividade Recente** alimentado por `social_feed_public` filtrado por `profile_id`. Reutiliza `<AthleteActivities />` como base (já existe), trocando a fonte para a nova view (mantém compatibilidade visual).

## 9. Integração ORKYM (loop de crescimento)

- Após inserir um `social_event` público relevante (`match_win`, `tournament_join`, `checkin`), enfileirar um `orkym_triggers_queue` opcional `kind='social_engage'` com link `/u/{username}`.
- ORKYM decide se envia (eligibility + cooldown). Sem decisão local.
- Mensagem template no ORKYM: `"Você jogou hoje. Veja sua atividade {link}"`.

## 10. Rotas e páginas

- `/u/:username` — perfil social público (lê `social_profiles_public` + `social_feed_public`).
- `/feed/global` — timeline cronológica do `social_feed_public` (paginação, filtros por `event_type` e arena).
- Card no Feed atual injetando os 5 eventos mais recentes do tenant ativo.

## 11. Fora de escopo (esta fase)

Comentários, likes, chat social, gamificação avançada, ranking global, IA de conteúdo. Permanecem futuros.

## Detalhes técnicos / arquivos

**Nova migração** (uma só, idempotente):
- cria `social_identities`, `social_profiles`, `social_events` + RLS + índices;
- cria funções: `social_identity_upsert`, `social_identity_for_user`, `social_event_description`, `social_profile_set_visibility`, `social_event_hide`, `_social_username_generate`;
- cria triggers: `trg_social_from_activity` em `athlete_activities`, `trg_social_from_booking` em `arena_bookings`, `trg_social_from_financial_transaction` em `financial_transactions`, `trg_social_from_tournament` em `tournaments`, `trg_social_profile_autocreate` em `social_identities`;
- substitui `social_feed_public`; cria `social_profiles_public`;
- backfill: para cada `auth.users` com telefone → identity+profile; para cada `wa_identities.verified` → identity+profile; projeta `athlete_activities` históricas em `social_events`.

**Edge functions tocadas**:
- `wa-bridge/index.ts`: chamar `social_identity_upsert` no primeiro contato.
- `orkym-whatsapp-connection/index.ts`: vincular `user_id` à identidade quando verifica.
- `moodplay-execute-action/index.ts`: ao executar `enrollment.create`/`booking.create` com phone, garantir identidade antes.

**Frontend**:
- `src/pages/UserProfile.tsx`: bloco "Atividade Recente" lendo `social_feed_public`.
- `src/pages/Feed.tsx`: seção/aba "Atividade da rede" lendo `social_feed_public` (top 20).
- `src/pages/SocialProfile.tsx` (nova) + rota `/u/:username` em `App.tsx`.
- `src/components/social/SocialEventCard.tsx` (novo) — render por `event_type`.

**Tipos**: `src/integrations/supabase/types.ts` é regenerado automaticamente após migração.

## Critérios de aceitação

- Inserir uma `enrollments` cria `athlete_activities` (já existe) **e** `social_events.tournament_join` automaticamente, com `social_profile` criado se necessário.
- `select * from social_feed_public order by occurred_at desc limit 20` retorna eventos com descrição legível.
- Marcar `social_profiles.visibility='private'` remove imediatamente todos os eventos do feed público.
- Mesma `entity_id` não gera evento duplicado.
- Telefone que escreve para ORKYM pela primeira vez aparece em `social_identities` com `source='whatsapp'`.
- Pagamentos não vazam valores no feed público.
