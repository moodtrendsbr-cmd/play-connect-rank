# Checkout Completo do Marketplace com Carrinho, Frete e Pagamento

## Resumo

Implementar a experiencia completa de compra no marketplace: carrinho de compras (restrito a mesma loja e lojas da mesma localização/cidade), calculo de frete por CEP (via ViaCEP) e mais uma como fallback o,3segundos checkout com pagamento via PIX ou cartao (Mercado Pago), saldo da empresa com confirmacao de entrega, e exibicao de contato/endereco no perfil publico da empresa.

---

## 1. Migracoes de banco de dados

### Novas colunas na tabela `companies`:

- `address` (text) - endereco completo
- `zip_code` (text) - CEP da empresa (obrigatorio para calculo de frete)
- `whatsapp` (text) - WhatsApp da empresa

### Novas colunas na tabela `marketplace_orders`:

- `shipping_cost` (numeric, default 0) - custo do frete
- `shipping_zip` (text) - CEP de entrega do comprador
- `payment_id` (text) - ID do pagamento no Mercado Pago
- `payment_method` (text) - pix ou credit_card
- `buyer_confirmed` (boolean, default false) - comprador confirmou recebimento
- `company_confirmed` (boolean, default false) - empresa confirmou envio/entrega
- `items` (jsonb) - array de itens do pedido `[{product_id, name, price, quantity}]`

### Nova tabela `cart_items` (opcional - sera gerenciado no frontend via estado local/localStorage para simplicidade e performance):

Nao sera criada tabela - o carrinho sera mantido em localStorage no navegador do usuario.

---

## 2. Arquivos novos

### `src/contexts/CartContext.tsx` - Contexto do carrinho

- Estado global do carrinho usando React Context + localStorage
- Funcoes: addToCart, removeFromCart, updateQuantity, clearCart, getTotal
- Validacao: so permite produtos da mesma empresa (company_id)
- Se usuario tentar adicionar de outra empresa, mostra alerta para limpar carrinho

### `src/pages/Cart.tsx` - Pagina do carrinho

- Lista de itens com imagem, nome, preco, controle de quantidade (+/-)
- Campo de CEP para calculo de frete
- Busca automatica do endereco via ViaCEP (`https://viacep.com.br/ws/{cep}/json/`)
- Calculo de frete simplificado:
  - Mesmo CEP (3 primeiros digitos iguais = mesma regiao): R$ 10,00
  - Mesmo estado: R$ 20,00
  - Estados diferentes: R$ 35,00
  - Gratis se mesma cidade (comparando cidade retornada pelo ViaCEP)
- Resumo: subtotal + frete = total
- Botao "Finalizar compra" -> navega para checkout

### `src/pages/MarketplaceCheckout.tsx` - Pagina de checkout

- Resumo do pedido (itens + frete + total)
- Dados do pagador (nome, email, CPF)
- Selecao de metodo: PIX ou Cartao
- Integracao com edge function `create-marketplace-payment`
- Tela de QR Code PIX ou confirmacao de cartao

### `src/components/marketplace/CartButton.tsx` - Botao flutuante do carrinho

- Icone de carrinho com badge de quantidade
- Visivel no AppLayout quando ha itens no carrinho

### `supabase/functions/create-marketplace-payment/index.ts` - Edge function de pagamento

- Recebe: items, shipping_cost, shipping_zip, payer info, payment_method
- Calcula comissoes:
  1. Taxa Mercado Pago (simulada ~5% para simplificar)
  2. Comissao Mood (commission_rate da empresa)
  3. Saldo liquido da empresa = total - taxa MP - comissao Mood
- Cria pagamento no Mercado Pago
- Cria registro(s) em marketplace_orders
- Se aprovado (cartao), atualiza status e credita saldo

### `supabase/functions/marketplace-webhook/index.ts` - Webhook para PIX marketplace

- Similar ao mercadopago-webhook existente
- Quando PIX aprovado, atualiza marketplace_orders e credita saldo da empresa

---

## 3. Arquivos editados

### `src/pages/MarketplaceProduct.tsx`

- Trocar botao "Comprar" direto por "Adicionar ao carrinho"
- Seletor de quantidade antes de adicionar
- Manter botao "Comprar no site" para produtos com external_link

### `src/pages/MarketplaceCompany.tsx`

- Adicionar secao de contato: email, whatsapp, telefone (obrigatorios)
- Adicionar endereco da empresa (cidade, estado, CEP)
- Botao de WhatsApp clicavel (link wa.me)

### `src/pages/MarketplaceRegister.tsx`

- Adicionar campos obrigatorios:
  - CEP (com busca automatica de endereco via ViaCEP)
  - Endereco completo
  - WhatsApp (obrigatorio)
  - Email (tornar obrigatorio)

### `src/pages/MyCompany.tsx`

- Adicionar secao de "Saldo disponivel" com valor acumulado
- Botao "Solicitar saque" (habilitado apenas quando buyer_confirmed e company_confirmed = true em todos os pedidos do saldo)
- Secao de pedidos com botao "Confirmar entrega" para empresa dar baixa
- Exibir campos de CEP/endereco/whatsapp para edicao

### `src/App.tsx`

- Adicionar rotas: `/marketplace/cart` e `/marketplace/checkout`
- Envolver app com CartProvider

### `src/components/layout/AppLayout.tsx`

- Adicionar CartButton flutuante

---

## 4. Fluxo completo do usuario

```text
1. Usuario navega no Marketplace e ve produtos
2. Clica em um produto -> pagina do produto
3. Seleciona quantidade e clica "Adicionar ao carrinho"
4. (Se adicionar de outra loja, alerta para limpar carrinho)
5. Acessa carrinho (icone flutuante ou link)
6. Digita CEP -> frete calculado automaticamente
7. Clica "Finalizar compra"
8. Preenche dados do pagador
9. Escolhe PIX ou Cartao
10. Paga -> pedido criado com status "paid"
11. Empresa ve pedido na pagina MyCompany
12. Empresa envia produto e clica "Confirmar envio"
13. Comprador recebe e clica "Confirmar recebimento"
14. Saldo fica disponivel para saque pela empresa
```

---

## 5. Calculo de saldo da empresa

```text
Valor do produto: R$ 100,00
Frete: R$ 20,00
Total cobrado: R$ 120,00

Taxa Mercado Pago (~4.99%): R$ 5,99
Comissao Mood (ex: 10%): R$ 12,00
Saldo empresa: R$ 120,00 - R$ 5,99 - R$ 12,00 = R$ 102,01

(O frete e repassado integralmente a empresa)
```

---

## Detalhes tecnicos

### ViaCEP - Calculo de frete

- Endpoint: `https://viacep.com.br/ws/{cep}/json/`
- Chamada no frontend (nao precisa de edge function)
- Fallback: se API falhar, permite digitar cidade/estado manualmente
- Comparacao de CEPs para definir faixa de frete

### Carrinho via localStorage

- Chave: `mood_cart`
- Formato: `{ companyId: string, items: [{productId, name, price, imageUrl, quantity}] }`
- Validacao: ao adicionar, verifica se companyId bate

### Edge function create-marketplace-payment

- Reutiliza padrao do create-payment existente
- Diferenca: nao cria enrollments, cria marketplace_orders
- external_reference: `{ order_ids: [...], type: "marketplace" }`

### Confirmacao de entrega

- Empresa clica "Confirmar envio" -> company_confirmed = true
- Comprador ve na pagina de pedidos "Confirmar recebimento" -> buyer_confirmed = true
- Quando ambos true, saldo fica "disponivel" para saque

### Rotas novas

- `/marketplace/cart` - Carrinho
- `/marketplace/checkout` - Checkout
- `/marketplace/orders` - Meus pedidos (comprador)