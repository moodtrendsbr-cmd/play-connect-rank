

# Fase 11.8 — Cleanup Final + Naming Unification + UX Consolidation

> **Princípio**: zero banco, zero rotas removidas, zero edge, zero RLS, zero ORKYM. Apenas **renomear, reagrupar e padronizar headers/sidebars/CTAs** dos 6 perfis para fechar a reorganização das Fases 11.1–11.7 com acabamento premium.

---

## Diagnóstico — inconsistências identificadas

| Área | Problema |
|---|---|
| Headers de shells | 6 formatos diferentes ("Arena", "Rede white-label", "Organizador de eventos", "Atleta · Mood Play", "Empresa · Mood Play", "Admin") |
| Sidebar Arena | "Central de Operação" + "Control Tower" + "Visão geral" + "Ações sugeridas" + "Controle automático" — 5 termos para IA/governança |
| Sidebar Organizer | 7 grupos com 1 item cada (Eventos, Inscrições, Jogos, Check-in, Performance, Financeiro) — fragmentado |
| Sidebar Admin (duplicado) | `AdminLayout.tsx` (em uso) tem lista plana; `AdminSidebar.tsx` (Fase 11.7) tem 5 grupos — **divergência ativa** |
| Admin marketplace | "Publicidade (legado)" + "Campanhas Ads" + "Patrocínios Atleta" + "Patrocínios Torneio" — 4 verbetes redundantes |
| AdminDashboard H1 | `PAINEL ADMINISTRATIVO` 4xl uppercase quebra padrão dos outros 5 dashboards |
| Banner conversacional | Diz "Dashboard → Controle" enquanto sidebars usam "Control Tower" / "Central de Operação" / "Painel" |
| OrganizerSidebar Check-in | Aponta para `/organizer/dashboard/jogos` (mesma URL que "Jogos & Brackets") — duplicado |

---

## 1. Glossário oficial (single source of truth)

Arquivo novo `src/lib/profileNaming.ts` (~50 linhas, pure data):

```ts
export const PROFILE_NAMING = {
  admin:     { shellLabel: "Admin · MoodPlay global",   towerLabel: "Control Tower" },
  tenant:    { shellLabel: "Rede · {tenantName}",       towerLabel: "Control Tower da Rede" },
  arena:     { shellLabel: "Arena · {arenaName}",       towerLabel: "Control Tower da Arena" },
  organizer: { shellLabel: "Organizador · MoodPlay",    towerLabel: "Event Control Tower" },
  athlete:   { shellLabel: "Atleta · MoodPlay",         towerLabel: "Athlete Hub" },
  company:   { shellLabel: "Empresa · {companyName}",   towerLabel: "Company Control Tower" },
} as const;

export const SECTION_LABELS = {
  controlTower: "Control Tower",   // todos os perfis
  orkymActions: "Ações ORKYM",     // padroniza "Ações sugeridas" / "Ações IA"
  autonomy:     "Autonomia",       // padroniza "Controle automático"
  finance:      "Financeiro",      // padroniza "billing / cobranças / finance"
  marketplace:  "Marketplace",
  campaigns:    "Campanhas",       // padroniza "ads / publicidade / sponsor"
  sponsorships: "Patrocínios",     // singular para o domínio "patrocinador"
} as const;
```

Padrões fixos:
- **MoodPlay** (CamelCase, sem espaço) — substitui "Mood Play".
- **Patrocínios** (não "sponsor / sponsorship / patrocinador").
- **Campanhas** (não "ads / publicidade / advertising"; legacy fica como sub-item).
- **Ações ORKYM** (não "Ações sugeridas" / "Ações IA").
- **Autonomia** (não "Controle automático" / "Governança IA").

---

## 2. Headers dos 6 shells (padronizados)

Layout único: `[chip de papel] · [nome contextual]`, todos `text-sm font-medium`.

| Shell | Antes | Depois |
|---|---|---|
| `AdminShell.tsx` | "Admin" | "**Admin** · MoodPlay global" |
| `TenantShell.tsx` | "Rede white-label" + name | "**Rede** · {tenant.name}" |
| `ArenaShell.tsx` | "Arena" | "**Arena** · {arena.name}" (busca via outlet context, fallback "Arena") |
| `OrganizerShell.tsx` | "Organizador de eventos" | "**Organizador** · MoodPlay" |
| `AthleteShell.tsx` | "Atleta · Mood Play" | "**Atleta** · MoodPlay" |
| `CompanyShell.tsx` | "Empresa · Mood Play — {name}" | "**Empresa** · {companyName}" (fallback "MoodPlay") |

Implementação: chip com `text-xs uppercase tracking-wider text-muted-foreground` para o papel + ` · ` + nome em `text-foreground`.

---

## 3. Sidebars — reorganização e renomeação

### 3.1 ArenaSidebar (5 grupos consolidados)
Antes: "Central de Operação" (4 itens misturados), "Operação" (9), "Financeiro" (5), "Torneios" (1), "Growth" (1) = 5 grupos desbalanceados.

Depois: **Control Tower / Operação / Financeiro / Torneios / Growth** — itens de IA reagrupados em "Control Tower":
- Control Tower → Dashboard · Visão geral · **Ações ORKYM** (era "Ações sugeridas") · **Autonomia** (era "Controle automático")

### 3.2 OrganizerSidebar (consolidar 7 → 4 grupos)
Antes: 7 grupos com 1 item cada.
Depois:
- **Event Control Tower** → Dashboard
- **Eventos** → Meus eventos · Criar evento · Inscrições
- **Operação** → Jogos & Brackets · Check-in (URL distinta `#checkin`)
- **Performance & Financeiro** → Performance · Financeiro do evento

### 3.3 AdminSidebar (resolver duplicação ATIVA)
**Decisão**: `/admin` usa `AdminLayout.tsx` (legacy, lista plana). O `AdminSidebar.tsx` (Phase 11.7, com 5 grupos) está ÓRFÃO. Duas opções:

**Opção escolhida**: Migrar `AdminLayout.tsx` para usar a estrutura de 5 grupos do `AdminSidebar.tsx` (sem trocar componente — só copiar os groups), e padronizar nomes:
- "Publicidade (legado)" → remove (mantém rota `/admin/ads`, vira sub-item de Campanhas como "Legado")
- "Campanhas Ads" → "**Campanhas**"
- "Patrocínios Atleta" + "Patrocínios Torneio" → grupo único "**Patrocínios**" com 2 sub-itens (Atletas, Torneios)
- "Monitor ORKYM" / "Ações ORKYM" / "Autonomia" / "Control Tower" → grupo "**ORKYM & Autonomia**"

### 3.4 TenantSidebar / AthleteSidebar / CompanySidebar
Já estão bem agrupadas (Phases 11.3/11.5/11.6). Apenas:
- Renomear "Sponsor Dashboard" → "Visão de patrocínios" se ainda existir
- "Mood Play" → "MoodPlay" em qualquer label

---

## 4. AdminDashboard H1 — alinhar com os outros 5

Trocar:
```tsx
<h1 className="text-4xl font-display text-foreground">PAINEL ADMINISTRATIVO</h1>
```
Por SectionHeader equivalente (mesmo padrão dos outros): "**Control Tower**" + subtítulo "Visão global do MoodPlay".

---

## 5. Banner conversacional — alinhar wording

`OperationModeBanner.tsx`:
- "Dashboard → Controle" → "**Control Tower** → Visão e controle"
- Demais labels mantidos.

---

## 6. CTAs padronizados

Único catálogo (já implícito, agora explícito via `src/lib/conversationalCommands.ts`):

| Intenção | CTA oficial |
|---|---|
| Iniciar conversa | "**Falar com a ORKYM**" |
| Continuar fluxo | "**Continuar no WhatsApp**" |
| Pedir ação | "**Pedir pelo WhatsApp**" |
| Ativar QR | "**Gerar QR**" / "**Abrir QR**" |
| Detalhes | "**Ver detalhes**" |

Auditoria nos 6 sidebars + `OrkymActionsCard` + `WhatsAppCTA`: trocar variações soltas. (Já está 90% padronizado; apenas 2-3 strings divergentes.)

---

## 7. Aliases visíveis — limpeza UX (sem quebrar)

Manter rotas legacy 100% funcionais; apenas garantir que **menus apontem para a rota nova**:

| Sidebar Item | Rota antiga (mantida) | Rota nova (alvo do menu) |
|---|---|---|
| Company "Patrocinar torneio" | `/sponsor/tournaments` | `/company/sponsor/torneios` ✅ já correto |
| Company "Meus patrocínios" | `/sponsor/dashboard` | `/company/sponsor/resumo` ✅ já correto |
| Athlete "Feed" (legacy item) | `/feed` | `/athlete/feed` (alias do shell) — ajustar |
| Athlete "Torneios" | `/tournaments` | `/athlete/torneios` — ajustar |

Verificar e migrar 2-3 links para rotas dentro do shell.

---

## 8. Polimento visual leve

- Headers dos shells: altura `h-12` mantida; chip do papel ganha cor sutil `bg-primary/5 text-primary` quando aplicável.
- SectionHeader: padrão único copiado do `OrganizerDashboard` (h-9 w-9 round-md bg-primary/10) — aplicar nos 6 dashboards onde divergir (Arena já usa variante minimal; Tenant tem variante colorida; padronizar para o do Organizer).
- Espaçamento: confirmar `space-y-6` no container raiz dos 6 dashboards.

---

## 9. Arquivos tocados

| Tipo | Arquivo |
|---|---|
| Novo | `src/lib/profileNaming.ts` (glossário) |
| Edit | `src/layouts/AdminShell.tsx` (header) |
| Edit | `src/layouts/TenantShell.tsx` (header) |
| Edit | `src/layouts/ArenaShell.tsx` (header) |
| Edit | `src/layouts/OrganizerShell.tsx` (header) |
| Edit | `src/layouts/AthleteShell.tsx` (header) |
| Edit | `src/layouts/CompanyShell.tsx` (header) |
| Edit | `src/layouts/sidebars/ArenaSidebar.tsx` (renomear grupo IA) |
| Edit | `src/layouts/sidebars/OrganizerSidebar.tsx` (consolidar 7→4 grupos) |
| Edit | `src/layouts/sidebars/CompanySidebar.tsx` (MoodPlay + label fixes) |
| Edit | `src/layouts/sidebars/AthleteSidebar.tsx` (links para shell aliases) |
| Edit | `src/pages/admin/AdminLayout.tsx` (migrar para 5 grupos + renomear) |
| Edit | `src/pages/admin/AdminDashboard.tsx` (H1 SectionHeader) |
| Edit | `src/components/conversational/OperationModeBanner.tsx` (wording) |
| Edit | `src/pages/tenant/TenantDashboard.tsx` (SectionHeader → padrão Organizer) — opcional |
| Edit | `src/pages/arena-dashboard/ArenaDashboard.tsx` (SectionHeader → padrão) — opcional |
| Memory | `mem/style/profile-naming.md` (novo — glossário oficial) |

**Total**: 1 novo + ~12 edits cirúrgicos (cada um < 15 linhas) + 1 memory.

---

## 10. Garantias de não-regressão

- Zero rotas adicionadas/removidas.
- Zero migration, edge, RLS, ORKYM core, lógica de negócio.
- Componentes existentes preservados — apenas labels/agrupamentos.
- Sidebar `AdminSidebar.tsx` (Phase 11.7) permanece exportado mas não-usado → marcar como deprecated em comentário (não deletar).
- Build TS limpo.

---

## 11. ENTREGA B — Relatório

| Item | Resultado |
|---|---|
| Renomeado | "Mood Play" → "MoodPlay" em 6 shells; "Ações sugeridas / Ações IA" → "Ações ORKYM"; "Controle automático" → "Autonomia"; "Painel Administrativo" → "Control Tower"; "Sponsor Dashboard" → "Visão de patrocínios" |
| Consolidado | 6 headers shell em formato único `[Chip] · [Nome]`; OrganizerSidebar 7→4 grupos; AdminSidebar lista plana → 5 grupos coerentes com Tenant/Arena |
| Limpo | "Publicidade (legado)" sai do menu top; "Campanhas Ads" vira só "Campanhas"; Patrocínios Atleta+Torneio viram grupo único; Athlete sidebar deixa de apontar para `/feed` direto (usa `/athlete/feed`) |
| Padronizado | Glossário `profileNaming.ts` como single source of truth; CTAs em 5 variações canônicas |
| Inconsistente antes | 6 estilos de header, 5 termos para IA na Arena, AdminSidebar.tsx órfão divergente do AdminLayout em uso, H1 4xl uppercase só no Admin |
| Mais claro agora | Cada perfil tem 1 chip de papel + 1 nome contextual; cada Control Tower é nomeado com modificador do papel (Arena/Rede/Event/Athlete/Company); IA = ORKYM em toda UI |

## 12. ENTREGA C — Pendências

- **11.9**: deprecar fisicamente `AdminSidebar.tsx` órfão (após uma versão estável)
- **11.10**: substituir `AdminLayout.tsx` por `AdminShell.tsx` (alinhar à arquitetura de shells dos outros 5 perfis)
- **11.11**: redirect 301 de `/sponsor/*` para `/company/sponsor/*`
- **11.12**: redirect 301 de `/marketplace/my-company` para `/company/marketplace`
- **11.13**: extrair `SectionHeader` / `KpiCard` / `ShortcutLink` para `src/components/dashboard/*` (eliminar duplicação local em 6 dashboards)
- **12.0**: camada conversacional profunda (edge `wa-bridge` recebendo webhooks)

---

## 13. Critério de sucesso

- ✅ Todos os 6 shells têm header em formato único `[Papel] · [Contexto]`
- ✅ "MoodPlay" (sem espaço) em toda UI
- ✅ "Ações ORKYM" / "Autonomia" / "Control Tower" como termos oficiais
- ✅ AdminSidebar com 5 grupos coerentes (igual Tenant/Arena)
- ✅ OrganizerSidebar com 4 grupos balanceados
- ✅ AdminDashboard H1 alinhado ao padrão dos outros 5
- ✅ Banner conversacional fala "Control Tower" (não "Dashboard")
- ✅ Glossário `profileNaming.ts` documenta naming oficial
- ✅ Zero rota quebrada, build TS limpo

