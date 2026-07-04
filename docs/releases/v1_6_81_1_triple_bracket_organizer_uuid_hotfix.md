# v1.6.81.1 — Hotfix Sistema de 3 Chaves: organizer_id UUID

## Objetivo

Corrigir falha ao criar torneio do formato Sistema de 3 Chaves no Supabase.

## Erro corrigido

`column "organizer_id" is of type uuid but expression is of type text`

## Causa

A RPC `sbw_create_tournament_for_organizer` da v1.6.81 inseria `target_organizer.id::text` na coluna `organizer_id`. Em ambientes onde essa coluna é UUID, o PostgreSQL rejeita a inserção.

## Correção

- A RPC passa a inserir `target_organizer.id` como UUID.
- O payload JS também passa a enviar `organizer_id` somente quando o valor é UUID válido; caso contrário envia `null`.

## SQL

Executar no Supabase:

`docs/sql/v1_6_81_1_triple_bracket_organizer_uuid_hotfix.sql`

## Observação

Este hotfix não altera a lógica do formato Sistema de 3 Chaves. Ele apenas corrige o vínculo da organização no momento da criação do torneio.
