
# Cadastro Unificado com Seletor de Perfil

## Resumo
Transformar a tela de cadastro em um formulario unificado onde o usuario primeiro escolhe seu perfil (Atleta, Organizador, Arena, Empresa) e o formulario se adapta dinamicamente. Todos os CTAs da landing page apontam para `/register`.

## O que muda

### 1. Landing Page (Index.tsx)
- Todos os links de CTA dos perfis (Atleta, Organizador, Arena, Empresa) passam a apontar para `/register` em vez de `/register?role=...`
- Os botoes "Entrar" e "Cadastrar" do header ja apontam corretamente

### 2. Pagina de Cadastro (Register.tsx) - Redesign completo
- Adicionar seletor de perfil com 4 opcoes visuais (cards/botoes): **Atleta**, **Organizador**, **Arena**, **Empresa**
- O formulario se adapta conforme a opcao selecionada:

**Campos comuns a todos:**
- Nome completo, Email, Senha, Cidade, Estado, WhatsApp

**Atleta** (campos atuais):
- Genero (obrigatorio)

**Organizador:**
- Genero (obrigatorio)

**Arena:**
- Nome da Arena, Endereco, CEP (com busca ViaCEP como ja existe no MarketplaceRegister)

**Empresa:**
- Nome da Empresa, CNPJ (opcional, "caso possua"), Categoria, Endereco, CEP (com busca ViaCEP)

### 3. Banco de Dados
- Adicionar os valores `arena` e `company` ao enum `app_role` para que possam ser armazenados na tabela `user_roles`
- Adicionar coluna `cnpj` (text, nullable) na tabela `companies`

### 4. Logica de Cadastro
- Ao submeter o formulario, cria a conta via `supabase.auth.signUp`
- Atualiza o perfil na tabela `profiles` com cidade, estado, genero, whatsapp
- Insere o papel correspondente na tabela `user_roles`
- Se for **Empresa**: tambem cria o registro na tabela `companies` (com CNPJ, nome da empresa, categoria, etc.)
- Se for **Arena**: salva o campo arena no perfil e dados de endereco

### 5. Pos-Cadastro
- Todos os perfis sao redirecionados para `/feed` apos o cadastro
- O acesso ao painel/dashboard de cada perfil fica no menu do perfil (ProfileSwitcher), como ja funciona hoje

## Detalhes Tecnicos

### Migracao SQL
```sql
-- Adicionar novos valores ao enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'arena';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'company';

-- Adicionar coluna CNPJ na tabela companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS cnpj text;
```

### Estrutura do componente Register.tsx
- Estado `selectedRole` controla qual perfil foi selecionado
- Renderizacao condicional dos campos extras baseada no `selectedRole`
- Reutilizar a logica de busca CEP do MarketplaceRegister para os perfis Arena e Empresa
- Validacao dinamica conforme o perfil selecionado

### Arquivos modificados
1. `src/pages/Register.tsx` - Redesign com seletor de perfil e formularios adaptativos
2. `src/pages/Index.tsx` - Atualizar links dos CTAs dos perfis para `/register`
3. Migracao SQL para o enum e coluna CNPJ
