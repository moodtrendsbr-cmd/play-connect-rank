# 🏐 MOOD PLAY — Plano de Implementação

## Visão Geral

Plataforma de gestão de torneios esportivos com rede social, ranking e pagamentos via Mercado Pago. Design escuro e esportivo com cores vibrantes (verde neon, amarelo).

---

## Fase 1 — Design System & Landing Page

- Tema escuro com acentos verde neon (#39FF14) e amarelo
- Tipografia bold e esportiva
- Landing page com hero "Onde jogos viram ranking", CTAs para atleta e organizador
- Layout responsivo mobile-first

## Fase 2 — Backend (Lovable Cloud)

- **Autenticação**: Login/cadastro por email (organizadores e atletas)
- **Tabelas**: tournaments, enrollments, athlete_profiles, match_results, posts, comments, likes
- **Storage**: Bucket para imagens de torneios
- **Políticas de segurança (RLS)**: Organizador gerencia seus torneios, atleta vê seus dados

## Fase 3 — Fluxo do Organizador

- Dashboard com resumo (torneios, inscritos, confirmados, pendentes, saldo)
- Formulário completo de criação de torneio (nome, categoria, tipo, local, datas, valor, vagas, prazo de pagamento, regulamento, imagem)
- Tela de gerenciamento: lista de inscritos por status (✅ Pagos, ⏳ Pendentes, ❌ Expirados)
- Botão "Enviar lembrete" para pendentes
- Geração de chaveamento (eliminatórias simples)
- Lançamento de resultados das partidas

## Fase 4 — Fluxo do Atleta

- Página pública do torneio com informações e botão de inscrição
- Formulário de inscrição (nome, email, WhatsApp)
- Reserva de vaga com prazo definido pelo organizador
- Perfil do atleta com ranking, torneios jogados e vitórias
- Edição de perfil

## Fase 5 — Pagamento com Mercado Pago

- Integração via edge function com API do Mercado Pago (Checkout Pro)
- Fluxo: Inscrição → Pagamento → Confirmação automática
- Webhook para receber notificação de pagamento aprovado
- Ao aprovar: status muda para "paid", notificação para atleta e organizador
- Expiração automática de vagas não pagas dentro do prazo

## Fase 6 — Chaveamento & Ranking

- Geração automática de chaves (usuario escolhe chaveamento) insira 3 tipos e opção de personalizar chavemanto
- Visualização das chaves com resultados
- Sistema de pontuação (vitórias = pontos)
- Ranking geral com posição, nome e pontuação
- Link do ranking para perfil do atleta

## Fase 7 — Feed Social

- Feed com posts automáticos (vitórias, inscrições em torneios)
- Criação de posts manuais pelos atletas
- Curtir e comentar em posts
- Timeline cronológica

---

## Notas Técnicas

- **Mercado Pago**: Será necessário fornecer a Access Token do Mercado Pago para configurar os pagamentos
- **Expiração automática**: Implementada via lógica no backend (edge function schedulada ou verificação on-demand)
- **Rodapé**: "Mood Play — Powered by Grupo MOOD"