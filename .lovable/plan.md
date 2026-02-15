
# Perfil: Time/Arena Badge + Genero + Campos Obrigatorios no Cadastro

## Resumo

Tres alteracoes principais:
1. No badge de time no perfil, exibir no formato "Time / Arena" (dois campos separados)
2. Adicionar campo "genero" ao perfil (usado internamente para ads/relatorios, nao aparece no perfil publico)
3. Tornar campos basicos obrigatorios no cadastro: Nome, Cidade, Estado, Genero, Email, WhatsApp

---

## 1. Migracao SQL

Adicionar duas colunas na tabela `profiles`:
- `arena` (text, nullable) -- nome da arena/quadra do usuario
- `gender` (text, nullable) -- masculino, feminino, outro, prefiro_nao_informar

---

## 2. Tela de Cadastro (Register.tsx)

Adicionar campos obrigatorios ao formulario de registro (tanto atleta quanto organizador):
- Nome completo (ja existe)
- Email (ja existe)
- Senha (ja existe)
- **Cidade** (novo, obrigatorio)
- **Estado** (novo, obrigatorio -- select com UFs)
- **Genero** (novo, obrigatorio -- select: Masculino, Feminino, Outro, Prefiro nao informar)
- **WhatsApp** (novo, obrigatorio)

Esses dados serao salvos no `auth.signUp` via `options.data` e depois sincronizados com a tabela `profiles` (o trigger de criacao de perfil ja existe e salva `full_name`; precisaremos atualizar o perfil apos signup ou ajustar o trigger para incluir os novos campos).

Abordagem: apos o `signUp`, fazer um `profiles.update` com city, state, gender e whatsapp usando o user.id retornado.

---

## 3. Editar Perfil (Profile.tsx)

- Adicionar campo "Arena" ao formulario de edicao, ao lado do campo "Time"
- Adicionar campo "Genero" (select) ao formulario -- com label discreta tipo "Usado para relatorios"
- Incluir `arena` e `gender` no state do form e no handleSave

---

## 4. Badge no Perfil (ProfileHeader.tsx)

Alterar o badge de time para exibir "Time / Arena" quando ambos estiverem preenchidos:
- Se so time: "Estrelas FC"
- Se so arena: "Arena X"
- Se ambos: "Estrelas FC / Arena X"

Adicionar prop `arena` ao ProfileHeader.

---

## 5. UserProfile.tsx

Passar o campo `arena` para o ProfileHeader.

---

## Detalhes tecnicos

### Arquivos a criar
- Nenhum

### Arquivos a editar
- Migracao SQL (2 colunas novas em profiles)
- `src/pages/Register.tsx` (adicionar campos cidade, estado, genero, whatsapp)
- `src/pages/Profile.tsx` (campos arena e gender no form)
- `src/components/profile/ProfileHeader.tsx` (prop arena, badge atualizado)
- `src/pages/UserProfile.tsx` (passar arena)

### Regras
- Genero NAO aparece no perfil publico
- Arena aparece junto ao time no badge
- Campos basicos obrigatorios no cadastro
