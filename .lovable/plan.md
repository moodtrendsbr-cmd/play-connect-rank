

# Plano: Criar Dados de Teste (Torneios, Perfis, Feed, Chaveamentos)

O banco de dados esta completamente vazio. Para popular com dados de teste, vou criar uma Edge Function de seed que usa a Admin API para criar usuarios reais e depois inserir todos os dados relacionados.

---

## O que sera criado

### Usuarios (6 no total)
- **2 Organizadores**: "Carlos Silva" e "Marina Santos"
- **3 Atletas**: "Lucas Oliveira", "Ana Costa", "Pedro Souza"
- **1 Admin**: "Admin Mood Play"

Cada usuario tera um email no formato `teste_xxx@moodplay.test` e senha `Test1234!`.

### Torneios (3 no total)
1. **Copa Mood Play 2026** - Masculino, Individual, 16 vagas, R$50 (Organizador: Carlos)
2. **Torneio Feminino de Praia** - Feminino, Duplas, 8 vagas, R$80 (Organizador: Marina)
3. **Arena Mista Inverno** - Misto, Equipes, 12 vagas, R$120 (Organizador: Carlos)

### Inscricoes
- Todos os 3 atletas inscritos nos 3 torneios (mistura de status: paid/pending)

### Chaveamentos (match_results)
- Copa Mood Play: 4 partidas (quartas e semi) com placares definidos
- Torneio Feminino: 2 partidas com resultados

### Feed (posts + likes + comments)
- 6 posts manuais dos atletas e organizadores
- 3 posts automaticos (tipo "enrollment" e "win")
- Likes distribuidos entre os usuarios
- Comentarios nos posts

---

## Implementacao Tecnica

### 1. Criar Edge Function `seed-test-data`
- Usa `SUPABASE_SERVICE_ROLE_KEY` para criar usuarios via `supabase.auth.admin.createUser()`
- O trigger `handle_new_user` criara automaticamente profiles e user_roles
- Depois atualiza profiles com cidade/estado/whatsapp
- Atualiza roles dos organizadores e admin
- Insere torneios, enrollments, match_results, posts, likes e comments
- Retorna um resumo do que foi criado

### 2. Chamar a Edge Function
- Executar a funcao uma vez para popular o banco
- Depois disso a funcao pode ser removida ou mantida para resets futuros

### Credenciais de Login para Teste

| Email | Senha | Role |
|-------|-------|------|
| `organizer1@moodplay.test` | `Test1234!` | organizer |
| `organizer2@moodplay.test` | `Test1234!` | organizer |
| `athlete1@moodplay.test` | `Test1234!` | athlete |
| `athlete2@moodplay.test` | `Test1234!` | athlete |
| `athlete3@moodplay.test` | `Test1234!` | athlete |
| `admin@moodplay.test` | `Test1234!` | admin |

> **Nota sobre a tela branca**: O tema escuro esta funcionando corretamente no codigo. Se voce ainda esta vendo fundo branco, tente abrir em uma aba anonima ou limpar o cache do navegador com Ctrl+Shift+R.

