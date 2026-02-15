
# Popular Banco com Dados Completos para Teste

## Objetivo

Atualizar a funcao de seed para criar dados em TODAS as areas da plataforma, permitindo visualizar todas as paginas com conteudo real.

## Dados a serem criados

### Empresas (companies) - 3 empresas
- "Volei Store SP" (vestuario, Sao Paulo/SP, status: approved, plan: pro)
- "Beach Gear RJ" (acessorios, Rio de Janeiro/RJ, status: approved, plan: elite)
- "Foto Esportiva" (fotografia, Curitiba/PR, status: pending_approval, plan: free)

### Produtos (products) - 6 produtos
- 2 produtos por empresa aprovada (Volei Store e Beach Gear)
- 2 produtos da empresa pendente (para testar aprovacao no admin)
- Mix de status: approved, pending
- Com precos, descricoes e stock

### Planos de empresa (company_plans) - 3 planos
- Free, Pro, Elite (se nao existirem ainda)

### Assinaturas (subscriptions) - para as empresas Pro e Elite

### Patrocinios de atletas (athlete_sponsors) - 2 registros
- Beach Gear patrocinando Lucas Oliveira
- Volei Store patrocinando Ana Costa

### Pedidos do marketplace (marketplace_orders) - 3 pedidos
- Atletas comprando produtos aprovados

### Ledger financeiro (financial_ledger) - 5 registros
- Entradas de torneios, assinaturas e marketplace

### Saldos de organizadores (organizer_balances) - 2 registros
- Saldos pendentes para os 2 organizadores

### Match Pool (tournament_match_pool) - 3 entradas
- Atletas buscando parceiros no primeiro torneio

### Match Requests (match_requests) - 1 convite
- Atleta 1 convidando atleta 2

---

## Detalhes tecnicos

### Arquivo a editar
- `supabase/functions/seed-test-data/index.ts`

### Sequencia de insercao (respeitando dependencias)
1. Usuarios (ja existente)
2. Perfis (ja existente)
3. Torneios (ja existente)
4. Inscricoes (ja existente)
5. Match results (ja existente)
6. **Company plans** (verificar se ja existem)
7. **Companies** (com owner_user_id dos organizadores)
8. **Subscriptions** (vinculando empresas a planos)
9. **Products** (vinculando a companies)
10. **Marketplace orders** (atletas comprando)
11. **Athlete sponsors** (empresas patrocinando atletas)
12. **Financial ledger** (entradas de receita)
13. **Organizer balances** (saldos dos organizadores)
14. **Tournament match pool** (atletas no pool de match)
15. **Match requests** (convites de parceria)
16. Posts (ja existente)

### Observacoes
- Usar service role key (ja configurado) para bypass de RLS
- Tratar erros de duplicata para poder rodar multiplas vezes
- Atualizar status das empresas para "approved" onde necessario

### Como executar
Apos deploy, chamar a edge function `seed-test-data` via curl ou pelo admin.
