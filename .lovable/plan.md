
# Refinamento da Hero Section - Visual Premium e Formal

## Objetivo
Transformar a hero section de um visual "gamer/esportivo agressivo" para uma plataforma esportiva profissional e premium.

## Mudancas no `src/pages/Index.tsx`

### 1. Headline - Reformulacao completa

Substituir o array `headlineLines` para aplicar verde apenas nas palavras-chave especificas (nao linhas inteiras):

```text
Linha 1 (bold): "Onde jogos viram ranking."
Linha 2 (medium): "[Atletas] ganham valor."        -> "Atletas" em verde
Linha 3 (medium): "[Torneios] viram ecossistema."   -> "Torneios" em verde
Linha 4 (medium): "Empresas ganham [visibilidade]." -> "visibilidade" em verde
```

- Remover CAPS LOCK (Bebas Neue ja da impacto sem caps)
- Remover `text-glow` forte, usar glow minimo ou nenhum
- Primeira linha: `font-bold`, demais: `font-medium`
- Reduzir tamanho em ~15%: de `text-4xl sm:text-5xl md:text-6xl lg:text-7xl` para `text-3xl sm:text-4xl md:text-5xl lg:text-6xl`
- Aumentar `leading` (line-height) para `leading-relaxed` ou `leading-loose`

### 2. Header Logo
- Remover CAPS de "MOOD PLAY" -> "Mood Play"
- Remover `text-glow` do logo

### 3. Subtitulo
- Manter texto atual, garantir cor `text-muted-foreground` (cinza claro)
- Adicionar mais espacamento vertical (`mt-8` em vez de `mt-6`)

### 4. CTAs - Reestruturacao

**Novo CTA primario** (logo abaixo do subtitulo):
- Texto: "Quero Participar"
- Botao verde primario, tamanho grande
- Com seta

**CTA secundario** (abaixo):
- Texto: "Ver torneios disponiveis"
- Botao branco/outline, tamanho menor
- Link para `/tournaments`

**Botoes de perfil** (mantidos abaixo):
- Sou Atleta, Sou Organizador, Sou Arena, Sou Empresa

### 5. Mais respiro vertical
- Aumentar padding vertical da hero section
- Mais espaco entre headline e subtitulo
- Mais espaco entre subtitulo e CTAs

### 6. Secoes abaixo - Remover CAPS dos titulos
- "UM ECOSSISTEMA ONDE TODOS CRESCEM JUNTOS." -> "Um ecossistema onde todos crescem juntos."
- "TUDO QUE VOCÊ PRECISA" -> "Tudo que voce precisa"
- "SIMPLES. RÁPIDO. PROFISSIONAL." -> "Simples. Rapido. Profissional."
- "O ESPORTE DA SUA CIDADE..." -> sentenca normal
- "PRONTO PARA ENTRAR NA ARENA?" -> sentenca normal

---

## Detalhes Tecnicos

Renderizacao da headline com palavras-chave verdes inline (nao linhas inteiras):

```tsx
// Cada linha renderiza com spans internos para palavras verdes
<motion.span className="block font-bold ...">
  Onde jogos viram ranking.
</motion.span>
<motion.span className="block font-medium ...">
  <span className="text-primary">Atletas</span> ganham valor.
</motion.span>
```

Botao "Ver torneios disponiveis":
```tsx
<Button variant="outline" className="border-white/30 text-white hover:bg-white/10" asChild>
  <Link to="/tournaments">Ver torneios disponiveis</Link>
</Button>
```

Botao "Quero Participar":
```tsx
<Button size="lg" className="h-14 px-8 text-lg font-bold box-glow" asChild>
  <Link to="/register">Quero Participar <ArrowRight /></Link>
</Button>
```

## Arquivo modificado
- `src/pages/Index.tsx` - unico arquivo alterado
