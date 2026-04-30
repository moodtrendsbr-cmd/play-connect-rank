---
name: Image uploads (unified)
description: Unified `ImageUploadField` (upload + URL + preview), `pickImage` fallback helper, no new buckets
type: design
---
Padrão único de imagem em formulários: `src/components/shared/ImageUploadField.tsx` (tabs Enviar/Colar link, preview, remover, upload via Supabase Storage). Helper `src/lib/imageFallback.ts` (`pickImage`, `imageOrPlaceholder`).

Buckets reutilizados (todos públicos): `tournament-images`, `tournament-files`, `arena-images`, `company-images`, `post-images`. Não criar novos buckets.

pathPrefix por entidade:
- arenas → `arena-images` em `arenas/{id}/{logo|hero|partners}`
- tenants → `company-images` em `tenants/{id}/{branding|favicon}`
- companies → `company-images` em `companies/{id}/logo` e `products/{companyId}`
- arena products → `company-images` em `products/arena-{arenaId}`
- tournaments → `tournament-images` em `tournaments/{id}/hero`
- ad campaigns / sponsored posts → `company-images` em `campaigns` / `sponsored-posts`

Colunas mantidas (sem renomear): `arenas.cover_image_url`, `arenas.logo_url`, `companies.logo_url`, `tournaments.image_url`, `products.image_urls[]`, `tenant_settings.{logo_url,favicon_url}`, `ad_campaigns.image_url`, `sponsored_posts.image_url`, `arena_partners.logo_url`, `profiles.avatar_url`. URLs externas continuam funcionando (componente aceita link colado).
