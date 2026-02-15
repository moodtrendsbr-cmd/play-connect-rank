
# Reestruturar Marketplace: Produtos na Home, Video, Estoque Ilimitado

## Resumo das mudancas

A pagina principal do Marketplace passara a exibir **produtos** (em vez de empresas). Ao clicar em um produto, o usuario sera levado a pagina da empresa com todos os seus produtos. A ordenacao prioriza empresas com plano pago e produtos em destaque. O estoque nao sera visivel para o usuario final. No cadastro de produtos, sera possivel marcar estoque como ilimitado e adicionar ate 10 imagens + 1 video.

---

## 1. Migracao de banco de dados

Adicionar coluna `video_url` na tabela `products`:

```sql
ALTER TABLE public.products ADD COLUMN video_url text;
```

---

## 2. Marketplace.tsx - Pagina principal mostra produtos

**Antes:** Lista empresas aprovadas.
**Depois:** Lista produtos aprovados (de empresas aprovadas), com busca e filtro por categoria.

- Buscar produtos com join na empresa: `products(*, companies(*))`
- Filtrar: `status = 'approved'` e empresa `status = 'approved'`
- Busca por nome do produto (ilike)
- Filtro por categoria da empresa
- Ordenacao:
  1. Produtos em destaque (`featured = true`) primeiro
  2. Empresas com plano pago (`companies.plan != 'free'`) segundo
  3. Empresas da mesma cidade do usuario terceiro
  4. Restante por data de criacao
- Card do produto: imagem, nome, preco, badge da empresa, badge "Destaque" se aplicavel
- Ao clicar no produto -> navega para `/marketplace/company/:companyId` (pagina da empresa)
- Manter links "Cadastrar empresa" e "Gerenciar minha empresa"
- **NAO** mostrar estoque

---

## 3. MarketplaceCompany.tsx - Pagina da empresa (sem mudancas grandes)

- Manter como esta: header da empresa + grid de produtos
- Ao clicar num produto -> `/marketplace/product/:productId`
- **NAO** mostrar estoque nos cards

---

## 4. MarketplaceProduct.tsx - Pagina do produto

- Remover a linha que exibe estoque (`Estoque: X unidades`)
- Suportar exibicao de video (`video_url`) alem das imagens no carrossel

---

## 5. MyCompany.tsx - Cadastro de produto (dialog)

Atualizar o formulario de "Novo Produto" para incluir:

- **Checkbox "Estoque ilimitado"**: quando marcado, o campo de estoque fica desabilitado e envia `null` ao banco (null = ilimitado)
- **Upload de ate 10 imagens**: campo de input de URLs (por enquanto como texto, ja que nao ha storage configurado para uploads de imagem do usuario). Permitir adicionar multiplas URLs de imagem
- **1 video (URL)**: campo para URL do video
- Salvar `video_url` e array de `image_urls` no insert

---

## Detalhes tecnicos

### Marketplace.tsx (reescrita principal)
- Query: `supabase.from("products").select("*, companies(*)").eq("status", "approved")`
- Filtrar no frontend empresas com `status !== 'approved'` (ja que o RLS da products ja filtra por empresa aprovada na policy publica)
- Ordenar no frontend: featured primeiro, depois por plano da empresa, depois por cidade
- Renderizar grid 2 colunas com cards de produto (imagem, nome, preco, nome da empresa)
- Clicar no card -> `/marketplace/company/:companyId`

### MarketplaceProduct.tsx
- Remover linha 82 (`{product.stock != null && ...}`)
- Adicionar renderizacao de video se `product.video_url` existir

### MyCompany.tsx - Formulario de produto
- Adicionar estado `unlimitedStock` (boolean, default true)
- Adicionar estado `imageUrls` (array de strings, ate 10)
- Adicionar estado `videoUrl` (string)
- Checkbox para "Estoque ilimitado" - quando marcado, stock = null
- Campos para adicionar URLs de imagens (input + botao adicionar, lista com remover)
- Campo para URL do video
- No submit: `image_urls: imageUrls, video_url: videoUrl || null, stock: unlimitedStock ? null : Number(stock)`

### Arquivos a editar
1. **Migracao SQL** - adicionar `video_url` na tabela products
2. **src/pages/Marketplace.tsx** - reescrever para listar produtos
3. **src/pages/MarketplaceProduct.tsx** - remover estoque, adicionar video
4. **src/pages/MyCompany.tsx** - expandir formulario de cadastro de produto
