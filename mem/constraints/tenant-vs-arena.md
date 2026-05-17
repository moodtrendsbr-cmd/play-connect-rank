---
name: Tenant vs Arena separation
description: Strict UX boundary between Tenant (network strategic ops) and Arena (physical day-to-day ops). Never mix them.
type: constraint
---

**Tenant (rede):** estratégia, expansão, perfil da rede, produtos próprios/merchandising da rede, gestão de arenas vinculadas, eventos/circuitos/torneios, patrocinadores da rede, financeiro consolidado.

**Arena (operação física):** bar, estoque, caixa, pedidos, lojinha interna, reservas, professores, alunos, ocorrências, check-in físico, QR físico.

**Regras:**
- Tenant **nunca** expõe bar/estoque/caixa/lojinha/pedidos da arena.
- Tenant **nunca** mostra IA/ORKYM/runtime técnico, control tower de autonomia, kill-switch, usage meters, "ações automáticas".
- Tenant pode ter "produtos da rede" (merchandising), separado de "produtos da arena".
- QR físico vive em Arena, não Tenant.
- Equipe vive em Configurações da Rede, não como módulo separado.

**Vocabulário tenant (Phase Strategic Ops):**
- "Central da Rede" (não Control Tower)
- "Visão da Rede" (não Visão Executiva)
- "Pendências importantes" (não Alertas abertos)
- Nome real da rede em vez de "Default"
