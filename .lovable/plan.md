
# Adicionar Navegacao de Usuario no Painel Admin

## O que muda

Adicionar uma segunda secao na sidebar do admin com links para as paginas de usuario (Feed, Torneios, Ranking, Perfil), permitindo que o admin navegue pela plataforma como usuario sem sair do contexto.

## Alteracoes

### Arquivo: `src/pages/admin/AdminLayout.tsx`

1. Importar icones adicionais: `Rss`, `Medal`, `User` do lucide-react
2. Criar um segundo array de navegacao para paginas de usuario:

```text
const userNavItems = [
  { title: "Feed", url: "/feed", icon: Rss },
  { title: "Torneios", url: "/tournaments", icon: Trophy },
  { title: "Ranking", url: "/ranking", icon: Medal },
  { title: "Perfil", url: "/profile", icon: User },
];
```

3. Adicionar um segundo `SidebarGroup` na sidebar, abaixo do grupo "Navegacao", com o label "Navegar como Usuario"
4. Os links deste grupo abrirao as paginas normais da plataforma (saindo do layout admin)
5. Remover o botao "Voltar" do header, ja que a navegacao de usuario agora esta na sidebar

### Resultado visual na sidebar:

```text
MOOD PLAY
Painel Admin

-- Navegacao --
  Dashboard
  Usuarios
  Torneios
  Inscricoes
  Financeiro

-- Navegar como Usuario --
  Feed
  Torneios
  Ranking
  Perfil
```
