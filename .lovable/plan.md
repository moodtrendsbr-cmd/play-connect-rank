

# Mencoes, Mensagens Diretas e Melhorias nos Clips

## Resumo

Adicionar sistema de mencoes (@usuario) em posts e comentarios, sistema de mensagens diretas acessivel pelo perfil, e opcao de gravar ao vivo nos clips. A funcionalidade de "collab/parceria com empresas" sera preparada com um placeholder, ja que o cadastro de empresas sera implementado futuramente.

---

## 1. Banco de Dados (Migracao SQL)

### Nova tabela `messages`
- id (uuid PK default gen_random_uuid())
- sender_id (uuid NOT NULL)
- receiver_id (uuid NOT NULL)
- content (text NOT NULL)
- read (boolean default false)
- created_at (timestamptz default now())
- RLS: SELECT onde auth.uid() = sender_id OR auth.uid() = receiver_id
- INSERT onde auth.uid() = sender_id
- UPDATE onde auth.uid() = receiver_id (para marcar como lido)
- Habilitar realtime para atualizacoes em tempo real

### Nova tabela `mentions`
- id (uuid PK default gen_random_uuid())
- mentioned_user_id (uuid NOT NULL)
- mentioner_id (uuid NOT NULL)
- post_id (uuid nullable)
- comment_id (uuid nullable)
- created_at (timestamptz default now())
- RLS: SELECT onde auth.uid() = mentioned_user_id OR auth.uid() = mentioner_id, INSERT autenticado

---

## 2. Mencoes (@usuario) em Posts e Comentarios

### Autocomplete de mencoes
- Criar componente `MentionInput.tsx`:
  - Ao digitar `@`, abrir um dropdown com busca de perfis (query `profiles` com `ilike full_name`)
  - Ao selecionar, inserir `@NomeCompleto` no texto
  - Debounce de 300ms na busca

### No CreatePostDialog
- Substituir o Textarea por MentionInput (ou adicionar logica de deteccao de @)
- Ao publicar, extrair mencoes do texto via regex `/@(\w+[\w\s]*)/` e salvar na tabela `mentions`

### No PostComments
- Aplicar a mesma logica de autocomplete no campo de comentario
- Ao enviar comentario, extrair e salvar mencoes

### Renderizacao
- No PostCard e PostComments, renderizar `@NomeUsuario` em cor `#2BFF88` (mesmo estilo das hashtags)

---

## 3. Collab/Parceria (Placeholder)

- No CreatePostDialog, adicionar um botao "Marcar parceiro" com icone de handshake
- Ao clicar, mostrar um toast: "Em breve! Cadastro de empresas em desenvolvimento."
- Nao implementar tabela ainda, apenas o botao visual com placeholder

---

## 4. Opcao de Gravar ao Vivo nos Clips

### CreateClipDialog
- Adicionar duas abas/botoes: "Enviar video" e "Gravar ao vivo"
- Aba "Enviar video": comportamento atual (upload de arquivo)
- Aba "Gravar ao vivo":
  - Usar `navigator.mediaDevices.getUserMedia({ video: true, audio: true })` para acessar a camera
  - Exibir preview ao vivo em um `<video>` element
  - Usar `MediaRecorder` API para gravar
  - Botoes: Iniciar gravacao, Parar, Descartar
  - Limite de 60 segundos (timer visual)
  - Ao parar, converter o Blob gravado em File e seguir o fluxo de upload normal

---

## 5. Mensagens Diretas

### Nova pagina `Messages.tsx` (rota `/messages`)
- Lista de conversas: agrupa mensagens por outro usuario
- Para cada conversa: avatar, nome, ultima mensagem, indicador de nao lida
- Ordenar por ultima mensagem mais recente

### Nova pagina/componente `ChatView.tsx` (rota `/messages/:userId`)
- Header: avatar + nome do outro usuario + botao voltar
- Lista de mensagens scrollavel (bolhas estilo WhatsApp)
- Mensagens do usuario atual a direita (fundo verde neon), do outro a esquerda (fundo cinza escuro)
- Campo de input fixo na parte inferior com botao enviar
- Realtime: subscribe no canal `messages` para receber novas mensagens instantaneamente
- Marcar mensagens como lidas ao abrir a conversa

### Botao "Enviar mensagem" no perfil
- Em `ProfileHeader.tsx` e `UserProfile.tsx`, ao visualizar perfil de outro usuario:
  - Botao "Mensagem" ao lado do botao "Seguir"
  - Ao clicar, navegar para `/messages/${profileUserId}`

### Indicador na navegacao
- No `FeedBottomNav.tsx`, adicionar icone de mensagem (Mail) com badge de contagem de nao lidas
- Substituir um dos icones existentes ou adicionar como novo item

---

## Resumo de Arquivos

### Criar
- `src/components/feed/MentionInput.tsx` -- componente de input com autocomplete de @mencoes
- `src/pages/Messages.tsx` -- lista de conversas
- `src/pages/ChatView.tsx` -- conversa individual com realtime

### Editar
- `src/components/feed/CreateClipDialog.tsx` -- adicionar aba de gravacao ao vivo com MediaRecorder
- `src/components/feed/CreatePostDialog.tsx` -- integrar mencoes (@) e botao placeholder de collab
- `src/components/feed/PostComments.tsx` -- autocomplete de mencoes no campo de comentario
- `src/components/feed/PostCard.tsx` -- renderizar @mencoes em cor neon
- `src/components/profile/ProfileHeader.tsx` -- botao "Mensagem" para outros perfis
- `src/pages/UserProfile.tsx` -- botao "Mensagem"
- `src/components/feed/FeedBottomNav.tsx` -- icone de mensagens com badge
- `src/App.tsx` -- novas rotas /messages e /messages/:userId

### Migracao SQL
- Criar tabela `messages` com RLS e realtime
- Criar tabela `mentions` com RLS

