

# Reformulacao da Pagina de Criar Torneio

## Resumo

Reestruturar completamente a pagina de criacao de torneio com novos campos, sistema de tags adicionaveis, busca de CEP automatica, upload de regulamento, vagas por combinacao de categoria/genero/modalidade, e checkbox de termos na inscricao.

---

## Mudancas no Banco de Dados

Adicionar novas colunas na tabela `tournaments`:

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `modality` | text | "Volei de Praia" ou "Volei de Quadra" |
| `gender` | text[] | Array de generos adicionados (Masculino, Feminino, Misto, custom) |
| `categories` | text[] | Array de categorias (Iniciante, Intermediario, Open, custom) |
| `types` | text[] | Array de tipos (Individual, Duplas, Trios, Quartetos, Equipes, custom) |
| `arena` | text | Nome da arena |
| `zip_code` | text | CEP |
| `entry_fee_2` | numeric | Valor da segunda inscricao |
| `entry_fee_3` | numeric | Valor da terceira inscricao |
| `rules_file_url` | text | URL do arquivo de regulamento |
| `slot_config` | jsonb | Vagas por combinacao (ex: `[{"type":"Dupla","category":"Iniciante","gender":"Masculino","slots":16}]`) |

Criar bucket de storage `tournament-files` para upload de regulamentos.

---

## Sistema de Vagas por Combinacao

O campo `max_slots` (vagas totais) atual sera substituido por um sistema onde o organizador define vagas **por combinacao** de Tipo + Categoria + Genero.

### Como funciona:

1. O organizador adiciona os valores de Tipo (ex: Dupla, Trio), Categoria (ex: Iniciante, Open) e Genero (ex: Masculino, Feminino)
2. O sistema gera automaticamente todas as combinacoes possiveis
3. Para cada combinacao, o organizador define a quantidade de vagas
4. Exemplo visual:

```text
VAGAS POR CATEGORIA

Dupla | Iniciante | Masculino   [ 16 ] vagas
Dupla | Iniciante | Feminino    [ 16 ] vagas
Dupla | Open      | Masculino   [ 8  ] vagas
Trio  | Misto     | Feminino    [ 12 ] vagas

Total de vagas: 52
```

5. O organizador pode remover combinacoes que nao deseja (ex: nao quer "Trio Iniciante Masculino")
6. Os dados sao salvos como JSON no campo `slot_config`

---

## Estrutura do Formulario (ordem dos campos)

1. **Nome do Torneio** - texto (ja existe)
2. **Modalidade** - Select: "Volei de Praia" / "Volei de Quadra"
3. **Genero** - Tags adicionaveis (sugestoes: Masculino, Feminino, Misto + custom)
4. **Tipo** - Tags adicionaveis (sugestoes: Individual, Duplas, Trios, Quartetos, Equipes + custom)
5. **Categoria** - Tags adicionaveis (sugestoes: Iniciante, Intermediario, Open + custom)
6. **Vagas por combinacao** - Tabela gerada automaticamente a partir das tags acima, com campo de vagas para cada linha
7. **Arena** - texto livre
8. **CEP** - com busca automatica via ViaCEP
9. **Endereco** - auto-preenchido pelo CEP ou manual
10. **Cidade / Estado** - auto-preenchido pelo CEP ou manual
11. **Data inicio / Data fim**
12. **Valor inscricao (R$)**
13. **Valor 2a inscricao (R$)** e **Valor 3a inscricao (R$)**
14. **Prazo pagamento (dias)**
15. **Regulamento** - Textarea + botao upload de arquivo
16. **Match** - Switch ativado por padrao

---

## Componente TagInput

Componente reutilizavel que:
- Mostra botoes com sugestoes pre-definidas
- Permite digitar valor customizado e adicionar com Enter
- Tags adicionadas aparecem como chips com botao X para remover
- Usado para Genero, Tipo e Categoria

---

## Busca de CEP (ViaCEP)

- Ao digitar 8 digitos, busca `https://viacep.com.br/ws/{cep}/json/`
- Se encontrar, preenche cidade, estado e endereco automaticamente
- Se nao encontrar, permite preenchimento manual
- Feedback visual durante a busca (loading)

---

## Checkbox de Termos na Inscricao

Na pagina `TournamentDetail.tsx`, antes do botao de inscricao:

> "Declaro que li o regulamento e aceito os termos para divulgacao de minha imagem nos perfis de torneios e divulgacoes vinculados a Mood Play"

Botao de inscricao so habilita quando marcado.

---

## Detalhes Tecnicos

### Migration SQL

```sql
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS modality text DEFAULT 'Vôlei de Praia',
  ADD COLUMN IF NOT EXISTS gender text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS categories text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS types text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS arena text,
  ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS entry_fee_2 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS entry_fee_3 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rules_file_url text,
  ADD COLUMN IF NOT EXISTS slot_config jsonb DEFAULT '[]';

INSERT INTO storage.buckets (id, name, public)
VALUES ('tournament-files', 'tournament-files', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "Auth users upload tournament files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'tournament-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Public view tournament files"
ON storage.objects FOR SELECT
USING (bucket_id = 'tournament-files');
```

### Formato do slot_config (JSONB)

```json
[
  { "type": "Dupla", "category": "Iniciante", "gender": "Masculino", "slots": 16 },
  { "type": "Dupla", "category": "Open", "gender": "Feminino", "slots": 8 }
]
```

### Arquivos a Criar/Modificar

| Arquivo | Acao |
|---------|------|
| `src/components/ui/tag-input.tsx` | Criar - componente de tags adicionaveis |
| `src/pages/CreateTournament.tsx` | Modificar - formulario completo reformulado |
| `src/pages/TournamentDetail.tsx` | Modificar - checkbox de termos na inscricao |
| Migration SQL | Executar - novas colunas + bucket de storage |

