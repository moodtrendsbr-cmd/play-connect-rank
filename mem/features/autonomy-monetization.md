---
name: Autonomy Monetization (AI Control Tower)
description: Phase 10 — tiers (free/growth/pro/business/enterprise) por plano, quotas mensais (calls/suggestions/auto), domain gating, fallback rebaixa modo (auto→approve→suggest), nunca quebra fluxo
type: feature
---

A Fase 10 transforma a autonomia ORKYM em produto vendável via tiers ligados a `company_plans`.

**Tiers e capacidades**:
- `free`: só sugestões, 20 calls/10 sug/0 auto, domínio `arena_operations`
- `growth`: 100/50/0
- `pro`: 500/200/50, domínios + `growth`, auto risk = `low`
- `business`: 5000/2000/1000, + `finance` + `tournaments`, auto risk `low`+`medium`
- `enterprise`: ilimitado (`-1`), todos domínios, auto até `high` (ainda passa por guardrails)

**Resolução de tier**: `orkym_get_tenant_tier` → 1) override em `tenant_settings.metadata.autonomy_tier_override`, 2) subscription ativa do owner, 3) fallback `free`.

**Gating em runtime**:
- Edge `orkym-invoke`: chama `orkym_check_quota('calls')` antes de invocar ORKYM. Se estourou, retorna `degraded:true, reason:'quota_exceeded'` sem chamar API e sem falhar.
- Resolver `autonomy_resolve_policy` aplica 4 checagens extras (domain allowed, tier permite auto por risk, quota auto, quota suggestions) e rebaixa modo: `auto→approve→suggest`. Sources: `tier_domain_block`, `tier_no_auto`, `quota_auto`, `quota_suggestions`.
- Edge `orkym-execute-action`: re-check de quota auto-actions imediatamente antes de marcar `executing` (defesa em profundidade). Se estourou, marca `canceled` com `failure_reason='quota_exhausted_runtime'`.

**Tracking**: tabela `orkym_usage` (UPSERT mensal por tenant) com counters de calls/suggestions/auto/approved/rejected/blocked + `estimated_time_saved_minutes` (heurística: 5min por auto + 2min por sugestão).

**Páginas Control Tower**:
- `/arena/dashboard/control-tower` (tenant): tier badge, 3 UsageMeter cards, tempo economizado, alertas a 80%/100%, UpgradeCTA
- `/admin/control-tower` (global): top adopters, próximos do limite, distribuição por tier, receita potencial estimada

**AdminMonetization**: cards de plano ganham seção "AI Autonomy" com select de tier, 3 inputs de limite (-1=ilimitado) e toggles de domínios liberados.

**Segurança não-negociável**: kill switch + guardrails + blocklist (refund/cancel/change_split) sempre prevalecem sobre tier. Tier `enterprise` NÃO desativa guardrails — só amplia risk levels permitidos para auto.

**UI**: `PolicyDecisionBadge` mostra source via `policySourceLabel`; `OrkymActionsCard` exibe badge "rebaixada por plano" quando source é tier/quota.
