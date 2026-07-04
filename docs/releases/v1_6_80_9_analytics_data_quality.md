# v1.6.80.9 — Analytics: qualidade de dados e páginas normalizadas

## Objetivo

Refinar o painel de Analytics do Admin Master para reduzir ruído nos dados antes de usar o painel para decisão real.

## Ajustes

- Normaliza páginas por chave prática, evitando duplicações como “Início” aparecer mais de uma vez.
- Corrige prioridade das rotas de Equipes para não confundir `/equipes/equipes.html` com perfil público de equipe.
- Agrupa páginas por nome prático em vez de URL/arquivo cru.
- Ajusta Top 10 de páginas, países e estados.
- Adiciona indicador de qualidade dos dados geográficos: page views com origem identificada, sem origem e eventos por IP temporário.
- Mantém IP bruto fora do banco da -SBW-.

## Arquivos

- `admin/admin.html`
- `js/admin/admin-page.js`
- `js/analytics/sbw-analytics.js`
- `js/supabase/supabase-client.js`
- `docs/sql/v1_6_80_9_analytics_data_quality.sql`

## Pós-patch

Rode no Supabase:

```sql
-- docs/sql/v1_6_80_9_analytics_data_quality.sql
```

Depois acesse páginas diferentes e valide o painel em:

`Admin Master > Analytics`
