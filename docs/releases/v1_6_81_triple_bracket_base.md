# v1.6.81 — Base do modo Sistema de 3 Chaves

## Objetivo

Adicionar a base estrutural do novo formato **Sistema de 3 Chaves** (`triple-bracket`) na plataforma -SBW-, já integrado ao Supabase e ao painel de criação de torneios.

## Escopo desta versão

- Registra o formato no catálogo competitivo do front-end.
- Adiciona a opção **Sistema de 3 Chaves (8 equipes beta)** na criação de torneios.
- Trava o MVP em exatamente **8 equipes**.
- Salva configuração estruturada no `settings` e `metadata` do torneio.
- Adiciona SQL para registrar o formato no Supabase.
- Atualiza a RPC `sbw_create_tournament_for_organizer` para validar/enriquecer torneios `triple-bracket`.

## O que ainda não entra nesta versão

- Geração automática da fase todos contra todos.
- Cálculo automático de classificação.
- Geração automática das Chave Alta, Média e Baixa.
- Avanço automático entre chaves.
- Final intermediária automática.
- Grande Final com placar/vantagem aplicada automaticamente.

Essas partes devem entrar em versões posteriores. Tentar colocar tudo agora aumentaria risco de bug e perda de rastreabilidade.

## Regras fixas do MVP

- 8 equipes.
- Fase inicial todos contra todos.
- 28 partidas na fase inicial.
- 1º ao 4º entram na Chave Alta.
- 5º ao 8º entram na Chave Média.
- Perdedor da Chave Alta cai para a Média.
- Perdedor da Chave Média cai para a Baixa.
- Perdedor da Chave Baixa é eliminado.
- Grande Final FT5 sem reset.
- Chave Alta começa 1–0 contra desafiante da Média.
- Chave Alta começa 2–0 contra desafiante da Baixa.

## SQL obrigatório

Rodar no Supabase:

```sql
docs/sql/v1_6_81_triple_bracket_base.sql
```

## Teste local mínimo

1. Abrir criação de torneio.
2. Selecionar **Sistema de 3 Chaves**.
3. Conferir se o limite muda para 8 equipes e fica travado.
4. Criar torneio como rascunho.
5. Confirmar no Supabase que o torneio foi salvo com `format = 'triple-bracket'`.
6. Confirmar `settings.tripleBracket` e `metadata.tripleBracket`.
