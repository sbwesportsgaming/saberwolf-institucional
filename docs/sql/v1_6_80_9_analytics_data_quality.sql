-- =========================================================
-- v1.6.80.9 — Analytics: qualidade de dados e páginas normalizadas
-- =========================================================
-- Objetivo:
-- - Corrigir duplicações como "Início" aparecendo mais de uma vez.
-- - Agrupar páginas por chave prática, não por arquivo/URL crua.
-- - Exibir Top 10 de páginas, países e estados.
-- - Separar eventos com geo identificada e eventos ainda sem geo.
-- - Manter IP bruto fora do banco da -SBW-.
-- =========================================================

drop function if exists public.sbw_admin_get_site_analytics_summary(integer);
drop function if exists public.sbw_admin_get_site_analytics_summary(integer, date, date);

create or replace function public.sbw_admin_get_site_analytics_summary(
  p_days integer default 7,
  p_start_date date default null,
  p_end_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_days integer := least(greatest(coalesce(p_days, 7), 1), 180);
  safe_start date;
  safe_end date;
  temp_date date;
  range_days integer;
  start_at timestamptz;
  end_at timestamptz;
  result jsonb;
begin
  if to_regclass('public.site_analytics_events') is null then
    return jsonb_build_object(
      'ok', false,
      'message', 'A tabela site_analytics_events ainda não existe. Rode primeiro o SQL da base de analytics.'
    );
  end if;

  if not public.sbw_admin_panel_can_manage() then
    raise exception 'Apenas Admin Master/Admin SBW pode visualizar analytics agregados.';
  end if;

  if p_start_date is not null and p_end_date is not null then
    safe_start := p_start_date;
    safe_end := p_end_date;
  else
    safe_end := current_date;
    safe_start := safe_end - (safe_days - 1);
  end if;

  if safe_start > safe_end then
    temp_date := safe_start;
    safe_start := safe_end;
    safe_end := temp_date;
  end if;

  if safe_start < safe_end - 179 then
    safe_start := safe_end - 179;
  end if;

  range_days := (safe_end - safe_start) + 1;
  start_at := safe_start::timestamptz;
  end_at := (safe_end + 1)::timestamptz;

  with filtered as (
    select *
    from public.site_analytics_events
    where created_at >= start_at
      and created_at < end_at
  ),
  page_view_rows as (
    select
      *,
      coalesce(nullif(regexp_replace(lower(split_part(split_part(coalesce(page_path, '/'), '?', 1), '#', 1)), '/+$', ''), ''), '/') as clean_path
    from filtered
    where event_type = 'page_view'
  ),
  normalized_page_rows as (
    select
      *,
      case
        when clean_path = '/' or clean_path like '%/index.html' or clean_path = 'index.html' then 'home'
        when clean_path like '%/admin/admin.html%' or clean_path like '%/admin/%' then 'admin'
        when clean_path like '%/equipes/minha-equipe.html%' then 'team_my'
        when clean_path like '%/equipes/criar-equipe.html%' or clean_path like '%/equipes/criar-subequipe.html%' then 'team_create'
        when clean_path like '%/equipes/equipes.html%' or clean_path = '/equipes' then 'teams'
        when clean_path like '%/equipes/equipe.html%' then 'team_public'
        when clean_path like '%/torneios/criar%' then 'tournament_create'
        when clean_path like '%/torneios/torneio%' or clean_path like '%/torneio-detalhe%' then 'tournament_detail'
        when clean_path like '%/torneios/%' or clean_path = '/torneios' then 'tournament_list'
        when clean_path like '%/organizadores/%' then 'organizers'
        when clean_path like '%/rankings/%' then 'rankings'
        when clean_path like '%/perfis/perfil%' then 'profile_public'
        when clean_path like '%/perfis/%' then 'profiles'
        when clean_path like '%/comunidades/%' then 'communities'
        when clean_path like '%/creators/%' then 'creators'
        when clean_path like '%/blog/noticia%' then 'news_detail'
        when clean_path like '%/blog/%' then 'news'
        when clean_path like '%/pages/loja%' or clean_path like '%/loja%' then 'shop'
        when clean_path like '%/transferencias/%' then 'transfers'
        when clean_path like '%/sobre%' then 'about'
        else 'other:' || left(clean_path, 72)
      end as page_key,
      case
        when clean_path = '/' or clean_path like '%/index.html' or clean_path = 'index.html' then 'Início'
        when clean_path like '%/admin/admin.html%' or clean_path like '%/admin/%' then 'Admin Master'
        when clean_path like '%/equipes/minha-equipe.html%' then 'Minha equipe'
        when clean_path like '%/equipes/criar-equipe.html%' or clean_path like '%/equipes/criar-subequipe.html%' then 'Criar equipe'
        when clean_path like '%/equipes/equipes.html%' or clean_path = '/equipes' then 'Equipes'
        when clean_path like '%/equipes/equipe.html%' then 'Perfil público de equipe'
        when clean_path like '%/torneios/criar%' then 'Criar torneio'
        when clean_path like '%/torneios/torneio%' or clean_path like '%/torneio-detalhe%' then 'Detalhe do torneio'
        when clean_path like '%/torneios/%' or clean_path = '/torneios' then 'Torneios'
        when clean_path like '%/organizadores/%' then 'Organizadores'
        when clean_path like '%/rankings/%' then 'Rankings'
        when clean_path like '%/perfis/perfil%' then 'Perfil público'
        when clean_path like '%/perfis/%' then 'Perfis'
        when clean_path like '%/comunidades/%' then 'Comunidades'
        when clean_path like '%/creators/%' then 'Creators'
        when clean_path like '%/blog/noticia%' then 'Notícia'
        when clean_path like '%/blog/%' then 'Notícias'
        when clean_path like '%/pages/loja%' or clean_path like '%/loja%' then 'Loja'
        when clean_path like '%/transferencias/%' then 'Transferências'
        when clean_path like '%/sobre%' then 'Sobre'
        else left(coalesce(nullif(page_title, ''), nullif(clean_path, ''), 'Página não informada'), 80)
      end as page_label
    from page_view_rows
  ),
  totals as (
    select
      count(*)::integer as events,
      count(*) filter (where event_type = 'page_view')::integer as page_views,
      count(*) filter (where event_type = 'click')::integer as clicks,
      count(*) filter (where event_type = 'page_view' and is_pwa = true)::integer as pwa_views,
      count(*) filter (where event_type = 'page_view' and coalesce(is_pwa, false) = false)::integer as browser_views
    from filtered
  ),
  daily_source as (
    select gs::date as day
    from generate_series(safe_start::timestamp, safe_end::timestamp, interval '1 day') gs
  ),
  daily_counts as (
    select
      ds.day,
      count(f.id) filter (where f.event_type = 'page_view')::integer as views
    from daily_source ds
    left join filtered f on f.created_at::date = ds.day
    group by ds.day
  ),
  daily as (
    select jsonb_agg(
      jsonb_build_object(
        'date', to_char(day, 'YYYY-MM-DD'),
        'views', coalesce(views, 0)
      ) order by day
    ) as data
    from daily_counts
  ),
  pages as (
    select coalesce(jsonb_agg(row order by (row->>'views')::integer desc, row->>'label'), '[]'::jsonb) as data
    from (
      select jsonb_build_object(
        'path', page_key,
        'label', page_label,
        'page_title', page_label,
        'views', count(*)::integer
      ) as row
      from normalized_page_rows
      group by page_key, page_label
      order by count(*) desc, page_label
      limit 10
    ) q
  ),
  categories as (
    select coalesce(jsonb_agg(row order by (row->>'views')::integer desc), '[]'::jsonb) as data
    from (
      select jsonb_build_object(
        'category', coalesce(nullif(page_category, ''), 'site'),
        'views', count(*)::integer
      ) as row
      from page_view_rows
      group by coalesce(nullif(page_category, ''), 'site')
      order by count(*) desc
      limit 10
    ) q
  ),
  devices as (
    select coalesce(jsonb_agg(row order by (row->>'views')::integer desc), '[]'::jsonb) as data
    from (
      select jsonb_build_object(
        'device', coalesce(nullif(device_type, ''), 'unknown'),
        'views', count(*)::integer
      ) as row
      from page_view_rows
      group by coalesce(nullif(device_type, ''), 'unknown')
      order by count(*) desc
      limit 6
    ) q
  ),
  geo_rows as (
    select
      nullif(upper(coalesce(metadata->>'country_code', metadata->>'geo_country_code')), '') as country_code,
      nullif(coalesce(metadata->>'country_name', metadata->>'country'), '') as country_label,
      nullif(upper(coalesce(metadata->>'state_code', metadata->>'region_code')), '') as state_code,
      nullif(coalesce(metadata->>'state', metadata->>'region_name', metadata->>'region'), '') as state_name,
      nullif(metadata->>'brazil_region', '') as brazil_region,
      nullif(metadata->>'geo_source', '') as geo_source,
      nullif(metadata->>'timezone', '') as timezone_label,
      nullif(metadata->>'browser_language', '') as browser_language
    from page_view_rows
  ),
  geo_quality as (
    select
      count(*)::integer as page_views,
      count(*) filter (where country_code is not null or country_label is not null)::integer as geo_known_views,
      count(*) filter (where country_code is null and country_label is null)::integer as geo_unknown_views,
      count(*) filter (where geo_source = 'ipapi_ephemeral')::integer as ip_lookup_views,
      count(*) filter (where geo_source is not null and geo_source <> 'ipapi_ephemeral')::integer as geo_fallback_views,
      count(*) filter (where geo_source is null)::integer as legacy_views
    from geo_rows
  ),
  countries as (
    select coalesce(jsonb_agg(row order by (row->>'views')::integer desc, row->>'label'), '[]'::jsonb) as data
    from (
      select jsonb_build_object(
        'label', left(case
          when coalesce(country_code, '') = 'BR' then 'Brasil'
          when country_label is not null then country_label
          when country_code is not null then country_code
          else 'Não identificado'
        end, 80),
        'code', left(coalesce(country_code, ''), 12),
        'views', count(*)::integer
      ) as row
      from geo_rows
      where country_label is not null or country_code is not null
      group by coalesce(country_code, ''), case
          when coalesce(country_code, '') = 'BR' then 'Brasil'
          when country_label is not null then country_label
          when country_code is not null then country_code
          else 'Não identificado'
        end
      order by count(*) desc
      limit 10
    ) q
  ),
  states as (
    select coalesce(jsonb_agg(row order by (row->>'views')::integer desc, row->>'label'), '[]'::jsonb) as data
    from (
      select jsonb_build_object(
        'label', left(case
          when country_code = 'BR' and state_code is not null then concat(state_code, ' · ', coalesce(state_name, 'Estado não identificado'))
          when state_name is not null and country_label is not null then concat(state_name, ' · ', country_label)
          when state_name is not null then state_name
          else 'Não identificado'
        end, 90),
        'code', left(coalesce(state_code, ''), 12),
        'views', count(*)::integer
      ) as row
      from geo_rows
      where state_code is not null or state_name is not null
      group by country_code, country_label, state_code, state_name
      order by count(*) desc
      limit 10
    ) q
  ),
  regions as (
    select coalesce(jsonb_agg(row order by (row->>'views')::integer desc, row->>'label'), '[]'::jsonb) as data
    from (
      select jsonb_build_object(
        'label', left(brazil_region, 80),
        'views', count(*)::integer
      ) as row
      from geo_rows
      where brazil_region is not null
      group by brazil_region
      order by count(*) desc
      limit 10
    ) q
  ),
  pwa_split as (
    select jsonb_build_array(
      jsonb_build_object('label', 'App/PWA', 'views', (select pwa_views from totals)),
      jsonb_build_object('label', 'Navegador', 'views', (select browser_views from totals))
    ) as data
  )
  select jsonb_build_object(
    'ok', true,
    'mode', case when p_start_date is not null and p_end_date is not null then 'custom' else 'days' end,
    'days', range_days,
    'period', jsonb_build_object(
      'start_date', to_char(safe_start, 'YYYY-MM-DD'),
      'end_date', to_char(safe_end, 'YYYY-MM-DD')
    ),
    'totals', jsonb_build_object(
      'events', t.events,
      'page_views', t.page_views,
      'clicks', t.clicks,
      'pwa_views', t.pwa_views,
      'browser_views', t.browser_views
    ),
    'quality', jsonb_build_object(
      'page_views', q.page_views,
      'geo_known_views', q.geo_known_views,
      'geo_unknown_views', q.geo_unknown_views,
      'ip_lookup_views', q.ip_lookup_views,
      'geo_fallback_views', q.geo_fallback_views,
      'legacy_views', q.legacy_views
    ),
    'daily', coalesce(daily.data, '[]'::jsonb),
    'pages', coalesce(pages.data, '[]'::jsonb),
    'categories', coalesce(categories.data, '[]'::jsonb),
    'devices', coalesce(devices.data, '[]'::jsonb),
    'pwa', coalesce(pwa_split.data, '[]'::jsonb),
    'countries', coalesce(countries.data, '[]'::jsonb),
    'states', coalesce(states.data, '[]'::jsonb),
    'regions', coalesce(regions.data, '[]'::jsonb)
  ) into result
  from totals t, geo_quality q, daily, pages, categories, devices, countries, states, regions, pwa_split;

  return result;
end;
$$;

grant execute on function public.sbw_admin_get_site_analytics_summary(integer, date, date) to authenticated;

notify pgrst, 'reload schema';
