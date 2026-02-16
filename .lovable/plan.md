

# Landing Page Oficial Mood Play - Redesign Completo

## Visao Geral

Reescrever completamente o `src/pages/Index.tsx` com todas as secoes solicitadas, mantendo a logica existente de redirect para usuarios autenticados e botao admin.

---

## Arquivo Modificado

### `src/pages/Index.tsx` - Reescrita completa

### Estrutura das Secoes

1. **Header fixo** (mantido) - Logo + Entrar/Cadastrar ou Painel Admin para admins
2. **Hero** - 4 linhas de headline com alternancia de cor verde, subtitulo, CTA primario + 4 botoes secundarios com scroll
3. **Secao Ecossistema** (id="ecosystem") - 4 cards conectados (Atletas, Organizadores, Arenas, Empresas)
4. **Secao Funcionalidades** (id="features") - 4 cards (Torneios, Rede Social, Ranking, Pagamentos)
5. **Secao Como Funciona** - 3 passos numerados (Crie conta, Participe, Evolua)
6. **Secao Para Cada Perfil** - 4 blocos com bullets e CTAs dedicados (id="atletas", "organizadores", "arenas", "empresas")
7. **Secao Prova Social** - 3 metricas (atletas cadastrados, torneios, cidades)
8. **CTA Final** - Titulo grande + botao
9. **Footer** - Logo, tagline, links organizados

### Detalhes Tecnicos

- Todas as animacoes usam `framer-motion` (`motion.div` com `whileInView`, stagger delays)
- Hero: cada linha anima com delay incremental (0, 0.15, 0.3, 0.45s)
- Linhas 2 e 4 do hero recebem classes `text-primary text-glow`
- Botoes secundarios do hero usam `onClick` com `document.getElementById('atletas')?.scrollIntoView({ behavior: 'smooth' })`
- Cards do ecossistema: layout grid 2x2 com borda `border-border hover:border-primary/40`
- Secao perfis: cada bloco alterna layout (texto + bullets) com CTA que linka para `/register` com query params adequados
- Prova social: numeros estaticos placeholder (ex: "1.200+ Atletas") com animacao de fade-in
- Footer com grid de links: Atletas, Organizadores, Arenas, Empresas, Termos, Privacidade
- Manter toda a logica existente de auth redirect e condicional admin no header
- Nenhuma nova dependencia necessaria (framer-motion, lucide-react, react-router-dom ja instalados)

### Icones utilizados (lucide-react)

- Trophy, Users, Zap, BarChart3, ArrowRight (ja importados)
- Building2 (arenas), Briefcase (empresas), UserPlus, Medal, Target
- CheckCircle2 (bullets dos perfis)

### Sem alteracoes em outros arquivos

Apenas `src/pages/Index.tsx` sera modificado.

