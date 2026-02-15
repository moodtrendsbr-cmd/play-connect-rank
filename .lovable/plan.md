# Ajustar CTAs do Marketplace

## O que muda

Na pagina principal do Marketplace, os dois links atuais ("+ Cadastrar empresa" e "Gerenciar minha empresa") serao removidos e substituidos por um unico CTA fixo no rodape da tela com o texto **"Quero vender meus produtos"**.

## Detalhes

### `src/pages/Marketplace.tsx`

1. **Remover** o link "+ Cadastrar empresa" que aparece ao lado da contagem de produtos (linha ~93).
2. **Remover** o bloco "Gerenciar minha empresa" que aparece no final da pagina (linhas ~127-135). e colocar visivel na pagina da empresa
3. **Adicionar** um botao/CTA fixo no rodape (acima do bottom nav), visivel para todos os usuarios, com o texto "Quero vender meus produtos". Ao clicar:
  - Se o usuario estiver logado e ja tiver empresa, redireciona para `/marketplace/my-company`
  - Caso contrario, redireciona para `/marketplace/register`
4. O CTA tera estilo destacado com a cor verde da marca (#2BFF88), posicionado fixo na parte inferior com `fixed bottom-16` (acima da nav bar).