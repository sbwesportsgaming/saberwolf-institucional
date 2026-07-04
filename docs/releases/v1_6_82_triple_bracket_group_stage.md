# v1.6.82 — Sistema de 3 Chaves: fase todos contra todos

## Objetivo

Adicionar a primeira etapa operacional do modo **Sistema de 3 Chaves**: geração da fase inicial todos contra todos para exatamente 8 equipes.

## Escopo entregue

- Geração da fase todos contra todos para `format = triple-bracket`.
- Validação de exatamente 8 inscritos/equipes válidas.
- Criação de 7 rodadas e 28 partidas.
- Salvamento da estrutura real no Supabase via `settings.structure`.
- Tabela de classificação geral da fase inicial.
- Lançamento de resultados da fase inicial no painel de gerenciamento.
- Recalculo da classificação geral após resultados.
- Exibição pública básica da fase todos contra todos no perfil do torneio.
- Cache/versionamento atualizado para `v1.6.82`.

## O que ainda não entra

- Geração da Chave Alta.
- Geração da Chave Média.
- Geração da Chave Baixa.
- Avanço automático entre chaves.
- Final intermediária.
- Grande Final com vantagem de 1–0 ou 2–0.

Essas partes devem entrar em versões posteriores. A fase todos contra todos precisa ficar estável antes de construir as chaves.

## Teste mínimo obrigatório

1. Criar torneio com formato `Sistema de 3 Chaves`.
2. Ter exatamente 8 inscritos/equipes válidas.
3. Gerar estrutura.
4. Confirmar 7 rodadas e 28 partidas.
5. Lançar alguns resultados.
6. Conferir se a classificação geral muda.
7. Abrir a página pública do torneio e conferir tabela/rodadas.

## Supabase

Não há nova tabela nesta versão. O SQL apenas valida a existência das colunas usadas para salvar a estrutura.
