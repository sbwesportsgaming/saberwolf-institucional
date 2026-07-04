# v1.6.86 — Vantagem automática da Grande Final do Sistema de 3 Chaves

## Objetivo

Aplicar automaticamente a vantagem da Chave Alta na Grande Final do Sistema de 3 Chaves.

## Entregas

- Detecta automaticamente se o desafiante da Grande Final veio da Chave Média ou da Chave Baixa.
- Aplica vantagem para o vencedor da Chave Alta:
  - Alta vs Média: Grande Final inicia 1–0 para a Chave Alta.
  - Alta vs Baixa: Grande Final inicia 2–0 para a Chave Alta.
- Mantém a Grande Final em FT5 sem reset.
- Pré-preenche o placar inicial da Grande Final com a vantagem aplicada.
- Valida que o placar final da Grande Final não pode ficar abaixo da vantagem inicial da Chave Alta.
- Exibe aviso no painel do organizador explicando que o placar deve ser lançado já incluindo a vantagem.
- Exibe a vantagem na página pública do torneio.
- Mantém o avanço automático da v1.6.85.

## Fora do escopo

- Reset de Grande Final.
- Formatos com mais ou menos de 8 equipes.
- Segunda série de final.
- Ajustes visuais profundos do bracket.

A regra oficial continua: FT5 sem reset, com vantagem automática para a Chave Alta.
