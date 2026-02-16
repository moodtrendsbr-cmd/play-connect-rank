
# Fluxo Sequencial por Genero + Data/Hora por Categoria + Campos de Endereco

## Resumo

Transformar o sistema de categorias para um fluxo sequencial onde o organizador configura **um genero por vez**, escolhendo tipos, categorias, vagas e agora tambem **data e horario** de cada combinacao. Adicionar campos de Numero e Complemento no endereco. Reorganizar a tabela de vagas para o formato: **Tipo - Gen. - Cat. - Vagas - Data/Hora** com abreviacoes para responsividade mobile.

---

## Mudancas no Banco de Dados

Migration SQL para adicionar colunas de endereco:

```sql
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS address_complement text;
```

O campo `slot_config` (jsonb, ja existe) passara a incluir `datetime` em cada item:
```json
[
  { "type": "Duplas", "category": "Iniciante", "gender": "Masculino", "slots": 16, "datetime": "2026-03-15T08:00" },
  { "type": "Duplas", "category": "Open", "gender": "Feminino", "slots": 8, "datetime": "2026-03-15T14:00" }
]
```

---

## Novo Fluxo de Categorias (Builder Sequencial)

### Como funciona

1. Organizador seleciona **1 Genero** (Select: Masculino, Feminino, Misto ou digitar custom)
2. Seleciona os **Tipos** para esse genero (TagInput: Duplas, Trios, etc.)
3. Seleciona as **Categorias** para esse genero (TagInput: Iniciante, Open, etc.)
4. Define **Vagas** (numero padrao, ex: 16)
5. Define **Data e Horario** (input datetime-local)
6. Clica **"+ Adicionar"** - gera combinacoes de tipo x categoria para o genero selecionado, cada uma com as vagas e datetime informados
7. As combinacoes aparecem na tabela abaixo
8. O builder limpa para o proximo genero
9. Na tabela, cada linha pode ter vagas e data/hora editados individualmente, ou ser removida

### Exemplo visual do builder

```text
[Genero: Masculino v]
[Tipos: + Duplas  + Trios]
[Categorias: + Iniciante  + Open]
[Vagas: 16]  [Data/Hora: 15/03/2026 08:00]
[ + Adicionar ]
```

---

## Tabela de Vagas (responsiva)

Colunas abreviadas para caber em mobile:

| Tipo | Gen. | Cat. | Vagas | Data/Hora |   |
|------|------|------|-------|-----------|---|
| Duplas | Masc | Inic | 16 | 15/03 08:00 | X |
| Duplas | Masc | Open | 16 | 15/03 08:00 | X |
| Trios | Fem | Open | 8 | 15/03 14:00 | X |

- Headers abreviados: "Gen." para Genero, "Cat." para Categoria
- Valores abreviados na celula: "Masc" em vez de "Masculino", "Fem", "Inic", etc.
- Data formatada como "DD/MM HH:mm" (sem ano para economizar espaco)
- Total de vagas exibido abaixo da tabela

---

## Campos de Endereco

Apos o campo Endereco, adicionar na mesma linha:
- **Numero** (campo curto)
- **Complemento** (campo texto)

Layout: `[Endereco (largo)] [N° (curto)] [Complemento (medio)]` ou em 2 linhas no mobile.

---

## Detalhes Tecnicos

### Interface SlotConfig atualizada

```typescript
interface SlotConfig {
  type: string;
  category: string;
  gender: string;
  slots: number;
  datetime: string; // formato ISO "YYYY-MM-DDTHH:mm"
}
```

### Estado do Builder

```typescript
const [builder, setBuilder] = useState({
  gender: '',
  types: [] as string[],
  categories: [] as string[],
  slots: 16,
  datetime: ''
});
```

### Logica "Adicionar"

Ao clicar "Adicionar":
- Valida que genero, pelo menos 1 tipo e 1 categoria estao preenchidos
- Gera combinacoes: `builder.types x builder.categories`, todas com o `builder.gender`, `builder.slots` e `builder.datetime`
- Evita duplicatas (mesma combinacao tipo+categoria+genero)
- Adiciona ao `slotConfig`
- Limpa o builder

### Funcao de abreviacao

```typescript
const abbreviate = (text: string) => {
  const map: Record<string, string> = {
    'Masculino': 'Masc', 'Feminino': 'Fem', 'Misto': 'Misto',
    'Iniciante': 'Inic', 'Intermediário': 'Inter', 'Open': 'Open',
    'Duplas': 'Duplas', 'Trios': 'Trios', 'Quartetos': 'Quart',
    'Individual': 'Indiv', 'Equipes': 'Equip'
  };
  return map[text] || text.substring(0, 5);
};
```

### Submit

Na hora do submit, derivar os arrays `gender`, `types` e `categories` unicos a partir do `slotConfig` para salvar tambem nos campos de array do banco.

### Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| `src/pages/CreateTournament.tsx` | Modificar - builder sequencial, datetime, tabela responsiva, campos endereco |
| Migration SQL | Executar - colunas address_number e address_complement |
