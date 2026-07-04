# v1.6.82.1 — Sistema de 3 Chaves: estrutura modelo com vagas em aberto

## Objetivo
Permitir gerar a estrutura inicial do Sistema de 3 Chaves mesmo quando o torneio ainda não possui 8 inscritos/equipes reais.

## Ajustes
- A geração da fase todos contra todos aceita de 0 a 8 participantes válidos.
- Quando houver menos de 8 participantes, o sistema completa a estrutura com vagas placeholder (`Vaga 1`, `Vaga 2`, etc.).
- A estrutura salva marca `templateMode`, `realPlayersUsed` e `placeholderSlots`.
- A confirmação no Admin avisa quando a estrutura será gerada como modelo.
- O bloqueio genérico de mínimo de 2 inscritos foi removido apenas para o formato `triple-bracket`.

## Limite importante
Estrutura com vagas em aberto é modelo operacional, não estrutura final para lançamento de resultados oficiais. Antes de registrar resultados reais, o organizador deve preencher as 8 vagas reais e regenerar/atualizar a estrutura.

## SQL
Não há SQL novo nesta versão.
