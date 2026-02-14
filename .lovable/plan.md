

# Implementacao de Split Payment com Mercado Pago

## Resumo

O pagamento das inscricoes sera dividido automaticamente entre o organizador do torneio e a plataforma Mood. Se o organizador nao tiver conta no Mercado Pago, a Mood recebe o valor total e o organizador pode solicitar o saque pelo perfil.

## Cenarios de pagamento

```text
+--------------------------------------------------+
|  Atleta paga inscricao (PIX ou Cartao)           |
+--------------------------------------------------+
            |
            v
+---------------------------+
| Organizador tem conta MP? |
+---------------------------+
     |              |
    SIM            NAO
     |              |
     v              v
+-----------------+  +-------------------------+
| Split Payment   |  | Mood recebe 100%        |
| MP Marketplace  |  | Saldo fica no sistema   |
| Org: valor - %  |  | Organizador solicita    |
| Mood: comissao  |  | saque pelo perfil       |
+-----------------+  +-------------------------+
```

## Mudancas no banco de dados

### 1. Adicionar campo na tabela `profiles`
- `mp_collector_id` (text, nullable) -- ID do vendedor no Mercado Pago (para split)

### 2. Nova tabela `organizer_balances`
Armazena o saldo acumulado de organizadores que nao tem conta MP:

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| organizer_id | uuid | FK para auth.users |
| tournament_id | uuid | FK para tournaments |
| amount | numeric | Valor devido ao organizador |
| commission | numeric | Comissao da Mood |
| payment_id | text | ID do pagamento MP |
| status | text | pending / paid / withdrawn |
| created_at | timestamptz | Data de criacao |
| withdrawn_at | timestamptz | Data do saque (quando aplicavel) |

RLS: organizador ve apenas seus proprios registros.

### 3. Nova tabela `withdrawal_requests`
Solicitacoes de saque feitas pelo organizador:

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| organizer_id | uuid | Quem solicita |
| amount | numeric | Valor solicitado |
| status | text | pending / approved / paid / rejected |
| pix_key | text | Chave PIX do organizador |
| created_at | timestamptz | |
| processed_at | timestamptz | |

## Mudancas nas Edge Functions

### `create-payment` (atualizar)

1. Receber `tournament_id` no body
2. Buscar o torneio e o perfil do organizador para checar `mp_collector_id`
3. **Se organizador tem MP**: usar a API de split payment do Mercado Pago, enviando `application_fee` (comissao Mood) e o `collector_id` do organizador
4. **Se organizador NAO tem MP**: criar pagamento normal (Mood recebe tudo), apos aprovacao registrar o saldo na tabela `organizer_balances`

### `mercadopago-webhook` (atualizar)

Apos confirmar pagamento aprovado:
1. Atualizar enrollments (ja existente)
2. Se o pagamento foi sem split (organizador sem MP), registrar credito na `organizer_balances`

### Nova edge function: `request-withdrawal`

Organizador solicita saque do saldo acumulado:
- Valida autenticacao
- Calcula saldo disponivel (sum de `organizer_balances` com status=paid menos saques ja feitos)
- Cria registro em `withdrawal_requests`
- Envia notificacao (futuro: webhook/email)

## Mudancas no Frontend

### Perfil do Organizador (`Profile.tsx`)

Adicionar secao visivel apenas para organizadores:
- **Conta Mercado Pago**: campo para informar o `collector_id` MP (com instrucoes de onde encontrar)
- **Saldo disponivel**: mostra soma dos valores em `organizer_balances` que nao foram sacados
- **Botao "Solicitar Saque"**: abre dialog para informar chave PIX e confirmar valor
- **Historico de saques**: lista de `withdrawal_requests` com status

### Pagina de Gerenciamento do Torneio (`ManageTournament.tsx`)

Adicionar card mostrando:
- Total arrecadado (inscricoes pagas)
- Comissao Mood
- Valor liquido do organizador
- Aviso se nao tem conta MP vinculada

### Pagina de Criacao de Torneio ou Configuracoes

Aviso/banner: "Conecte sua conta Mercado Pago para receber pagamentos automaticamente"

## Detalhes Tecnicos

### Comissao da Mood
- Definir como percentual fixo (ex: 10%) ou valor configuravel
- Sera armazenado como constante na edge function inicialmente (pode virar configuracao no futuro)

### Split Payment no Mercado Pago (API Marketplace)
Quando o organizador tem `mp_collector_id`, o body do pagamento inclui:

```text
{
  ...paymentBody,
  application_fee: comissaoMood,    // valor que fica com a Mood
  collector_id: organizador.mp_collector_id  // quem recebe
}
```

Obs: Para split funcionar, o organizador precisa autorizar a aplicacao Mood no Mercado Pago (OAuth). Inicialmente pode ser feito com collector_id manual; futuramente pode-se implementar OAuth completo.

### Seguranca
- RLS em `organizer_balances`: organizador ve apenas seus registros
- RLS em `withdrawal_requests`: organizador ve/cria apenas seus registros
- Edge function `request-withdrawal` valida JWT do usuario
- Saldo calculado server-side para evitar manipulacao

