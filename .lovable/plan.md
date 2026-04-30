# Auditoria e padronização de imagens

## 1. Mapa atual (auditoria)

### Campos no banco (mantidos como estão — sem renomear)

| Entidade | Campos atuais | Status |
|---|---|---|
| `tournaments` | `image_url`, `rules_file_url` | só URL |
| `arenas` | `logo_url`, `cover_image_url` | só URL |
| `companies` | `logo_url` | só URL |
| `products` | `image_urls` (array), `video_url` | array de URLs |
| `profiles` | `avatar_url` | upload OK (post-images) |
| `tenant_settings` | `logo_url`, `favicon_url` | só URL |
| `ad_campaigns` | `image_url` | só URL |
| `sponsored_posts` | `image_url` | só URL |
| `tournament_sponsorships` | `logo_url` | upload OK (company-images) |
| `arena_partners` | `logo_url` | só URL |
| `clips` | `media_url`, `thumbnail_url` | upload OK (post-images) |

### Buckets existentes (todos públicos)
`tournament-images`, `tournament-files`, `arena-images`, `company-images`, `post-images`. **Nenhum bucket novo necessário.**

### Onde já existe upload
`ProfileHeader` (avatar), `CreatePostDialog`, `CreateClipDialog`, `SponsorTournamentDialog` (logo), `EditTournamentForm` (image), `CreateTournament` (image).

### Onde só existe URL (precisa receber upload+preview)
- `src/pages/arena-dashboard/ArenaProfile.tsx` — `logo_url`, `cover_image_url`
- `src/pages/arena-dashboard/ArenaProducts.tsx` — `image_url` (vai pro `image_urls[0]`)
- `src/pages/arena-dashboard/ArenaSponsors.tsx` — `logo_url` parceiro
- `src/pages/organizer/OrganizerSettings.tsx` — `logo_url`, `favicon_url`
- `src/pages/MyCompany.tsx` — logo da empresa, imagens de produto
- `src/pages/Profile.tsx` — avatar (já tem upload via ProfileHeader; OK)
- `src/pages/admin/AdminAdCampaigns.tsx` — `image_url`
- `src/pages/admin/AdminAds.tsx` — `image_url`

## 2. Componente reutilizável `ImageUploadField`

Novo arquivo `src/components/shared/ImageUploadField.tsx`.

Props:
```ts
{
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  bucket: "tournament-images"|"arena-images"|"company-images"|"post-images";
  pathPrefix: string;          // ex: `arenas/${arenaId}/hero`
  aspect?: "16/9"|"1/1"|"3/1"; // dica visual
  previewShape?: "rectangle"|"square"|"circle";
  allowUrl?: boolean;          // default true
  allowUpload?: boolean;       // default true
  helperText?: string;
  accept?: string;             // default "image/jpeg,image/png,image/webp"
  maxSizeMB?: number;          // default 5
}
```

UI: Tabs `Enviar imagem` | `Colar link` + preview com botão remover + estado loading + erros amigáveis (formato/tamanho). Usa `supabase.storage.from(bucket).upload(path)` e `getPublicUrl`.

## 3. Helper de fallback

`src/lib/imageFallback.ts`:
```ts
export function pickImage(...candidates: (string|null|undefined)[]): string | null
// retorna o primeiro truthy; consumidores usam <img src={pickImage(...) ?? "/placeholder.svg"}/>
```

Aplicado nas páginas públicas (arena, torneio, empresa, produto, feed cards) onde a imagem hoje pode ficar quebrada.

## 4. Substituições nos formulários

Cada `<Input value={form.X_url} ... placeholder="https://..."/>` vira `<ImageUploadField .../>` mantendo a mesma chave do form. Bucket por entidade:

| Form | Campo | Bucket | pathPrefix |
|---|---|---|---|
| ArenaProfile | logo_url | arena-images | `arenas/{id}/logo` |
| ArenaProfile | cover_image_url | arena-images | `arenas/{id}/hero` |
| ArenaProducts | image_url → image_urls[0] | company-images | `products/arena-{arenaId}` |
| ArenaSponsors | logo_url | arena-images | `arenas/{id}/partners` |
| OrganizerSettings | logo_url | company-images | `tenants/{id}/branding` |
| OrganizerSettings | favicon_url | company-images | `tenants/{id}/favicon` |
| MyCompany | logo_url | company-images | `companies/{id}/logo` |
| MyCompany product | image_urls | company-images | `products/{id}` |
| AdminAdCampaigns | image_url | company-images | `campaigns/{id}` |
| AdminAds | image_url | company-images | `ads/{id}` |
| EditTournamentForm | image_url | tournament-images | `tournaments/{id}/hero` (já existe upload — só trocar pelo componente unificado) |
| CreateTournament | image_url | tournament-images | `tournaments/new/hero` |

## 5. Páginas públicas — fallbacks

- `ArenaPublic`: hero usa `pickImage(cover_image_url, logo_url)`; placeholder com gradient quando vazio.
- `TournamentDetail`: hero usa `pickImage(image_url, arena.cover_image_url)`.
- `MarketplaceCompany`/`MarketplaceProduct`: usa `pickImage(image_urls[0])` + placeholder.
- `Feed` (`SponsoredPostCard`, `BoostedTournamentCard`, `BoostedProductCard`): já condicional — adicionar placeholder visual em vez de esconder.
- `PublicCheckin`: já condicional, sem mudança.

## 6. RLS storage

Buckets já têm policies. Verificar se `arena-images` permite upload pelo dono via path `arenas/{arena_id}/...`. Se a policy atual exige `auth.uid()` como primeiro segmento (padrão herdado de `post-images`), adicionar policies por bucket que aceitem o pathPrefix de cada entidade. **Migration nova** apenas se necessário após teste — 1 arquivo SQL com policies de upload/update/delete por bucket baseadas em ownership da entidade (ex: `arenas.owner_id = auth.uid()`).

## 7. Sem mudanças destrutivas

- Não renomear colunas. `cover_image_url` continua sendo `cover_image_url` (não vira `hero_image_url`).
- Não tornar imagem obrigatória em nenhum form.
- URLs antigas continuam válidas (componente aceita URL externa via aba "Colar link").
- Sem novos buckets.

## 8. Entregáveis

1. `src/components/shared/ImageUploadField.tsx`
2. `src/lib/imageFallback.ts`
3. Refactor de 8 formulários listados na seção 4
4. Fallbacks visuais em 5 páginas públicas (seção 5)
5. Migration SQL (somente se policies exigirem) para upload em `arena-images` e `company-images` por dono da entidade
6. Relatório final no chat: campos antes/depois, buckets usados, formulários atualizados, páginas com fallback, pendências (ex: tenant favicon — só URL faz sentido para favicon externo)

## 9. Critério de sucesso

- Em todo form de imagem o usuário pode enviar arquivo OU colar URL, com preview e remover.
- Páginas públicas nunca exibem `<img>` quebrado — sempre placeholder ou conteúdo alternativo.
- Imagens já cadastradas continuam sendo exibidas sem migração de dados.
- Sem novos buckets; multi-tenant preservado pelas RLS existentes.
