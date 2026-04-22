---
name: WhatsApp-First Conversational Layer
description: Camada visual conversacional aplicada nos 6 dashboards. WhatsApp = operação rápida, QR = entrada física, Dashboard = controle, ORKYM = cérebro.
type: feature
---

# WhatsApp-First Layer (Fase 11.7)

## Princípio
- **WhatsApp**: ações operacionais rápidas (criar torneio, abrir cobrança, check-in conversacional, executar ações ORKYM).
- **QR**: entrada física (check-in de aulas/torneios, acesso a quadras).
- **Dashboard**: visão, controle, auditoria, análise.
- **ORKYM**: interpreta o comando, decide o fluxo, executa.

## Componentes compartilhados
Pasta `src/components/conversational/`:

- `WhatsAppCTA` — botão verde-WhatsApp (variants: `primary`, `inline`, `card`). Abre `https://wa.me/<numero>?text=<command>`. Lê `VITE_ORKYM_WHATSAPP`; sem fallback usa toast informativo.
- `CommandExamplesCard` — card com 4-5 comandos sugeridos por perfil. Cada item dispara `wa.me`.
- `OperationModeBanner` — banner dismissable (localStorage `mp_op_banner_<profile>_dismissed`) explicando os 3 canais.
- `QrEntryCard` — card com CTA para fluxo de QR existente. Aplicado em Arena/Organizer/Athlete (perfis físicos).

Comandos por perfil em `src/lib/conversationalCommands.ts` (pure data, zero lógica).

## Aplicação por dashboard

| Dashboard | Inserção | QR aponta para |
|---|---|---|
| ArenaDashboard | Após Control Tower | `/arena/checkin` |
| OrganizerDashboard | Após KPIs | `/organizer/dashboard/jogos` (check-in de torneio) |
| AthleteDashboard | Após Hero | `/arena/checkin` |
| CompanyDashboard | Após KPIs | (sem QR — full-width nos comandos) |
| TenantDashboard | Após Control Tower | (sem QR) |
| AdminDashboard | Após métricas | (sem QR) |

## ORKYM como cérebro
`OrkymActionsCard` ganha botão extra **"Continuar no WhatsApp"** que abre `wa.me?text=Aprovar ação <id> — <título>`. Sem alterar `approveAction`/`executeAction`/`rejectAction`.

## Sidebars
Cada uma das 6 sidebars tem item rodapé "Falar com a ORKYM" (`WhatsAppCTA inline`).

## Configuração
- Secret esperado: `VITE_ORKYM_WHATSAPP` (formato com ou sem caracteres especiais — o componente strip-a tudo que não for dígito).
- Sem secret configurado → toast informativo.

## Pendências futuras
- 11.8: edge function `wa-bridge` recebendo webhook do WhatsApp e disparando `orkym-invoke`.
- 11.9: `VITE_ORKYM_WHATSAPP` per-tenant.
- 11.10: deeplinks de QR para fluxos não-arena.
- 11.11: histórico de comandos WhatsApp (depende de tabela nova).
