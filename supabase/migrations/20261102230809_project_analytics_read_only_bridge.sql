-- Consulta agregada para a central SBW Project. Somente servidor; sem cópia dos eventos.
create or replace function sbw_analytics_private.group_report(
  p_days integer default 7,p_start_date date default null,p_end_date date default null,p_streamer text default null)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
  v_start date;
  v_end date;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_result jsonb;
begin
  if (p_start_date is null) <> (p_end_date is null) then raise exception 'Informe as duas datas.' using errcode='22023'; end if;
  if p_start_date is null then
    if coalesce(p_days,7) not between 1 and 180 then raise exception 'Período inválido.' using errcode='22023'; end if;
    v_end := (now() at time zone 'America/Sao_Paulo')::date;
    v_start := v_end-(coalesce(p_days,7)-1);
  else
    v_start := p_start_date; v_end := p_end_date;
  end if;
  if not isfinite(v_start) or not isfinite(v_end) or v_start>v_end or v_end-v_start>179 then
    raise exception 'Selecione até 180 dias em ordem cronológica.' using errcode='22023';
  end if;
  if p_streamer is not null and p_streamer !~ '^[a-z0-9][a-z0-9_.-]{0,79}$' then raise exception 'Origem inválida.' using errcode='22023'; end if;
  v_start_at := v_start::timestamp at time zone 'America/Sao_Paulo';
  v_end_at := (v_end+1)::timestamp at time zone 'America/Sao_Paulo';
  with all_rows as materialized (
    select e.*,s.source_kind,s.source_name,s.streamer,s.medium,s.campaign,s.referrer_host
    from sbw_analytics_private.access_events e join sbw_analytics_private.access_sessions s on s.id=e.session_id
    where not s.is_test and e.created_at>=v_start_at and e.created_at<v_end_at
  ), filtered as materialized (
    select * from all_rows where p_streamer is null or streamer=p_streamer
  ), views as materialized (
    select * from filtered where event_type='page_view'
  ), days as (
    select v_start+i as day from generate_series(0,v_end-v_start) as n(i)
  ), daily_counts as (
    select (created_at at time zone 'America/Sao_Paulo')::date as day,count(*) as views,count(distinct session_id) as visits from views group by 1
  )
  select jsonb_build_object(
    'ok',true,'site','saberwolf-esports','timezone','America/Sao_Paulo',
    'period',jsonb_build_object('start_date',v_start,'end_date',v_end),
    'days',v_end-v_start+1,'streamer',p_streamer,
    'totals',jsonb_build_object(
      'page_views',(select count(*) from views),'sessions',(select count(distinct session_id) from views),
      'pages',(select count(distinct page_path) from views),
      'streamer_sessions',(select count(distinct session_id) from views where streamer<>''),
      'link_clicks',(select count(*) from filtered where event_type='link_click')),
    'daily',(select coalesce(jsonb_agg(jsonb_build_object('date',d.day,'views',coalesce(c.views,0),'visits',coalesce(c.visits,0)) order by d.day),'[]'::jsonb) from days d left join daily_counts c on c.day=d.day),
    'pages',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select page_path as path,count(*) as views,count(distinct session_id) as visits from views group by page_path order by count(*) desc,page_path limit 30) x),
    'sources',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select source_kind as kind,source_name as name,count(*) as views,count(distinct session_id) as visits from views group by source_kind,source_name order by count(*) desc,source_name limit 30) x),
    'streamers',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select streamer as name,count(*) as views,count(distinct session_id) as visits from views where streamer<>'' group by streamer order by count(*) desc,streamer limit 30) x),
    'campaigns',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select campaign as name,medium,count(*) as views,count(distinct session_id) as visits from views where campaign<>'' group by campaign,medium order by count(*) desc,campaign limit 20) x),
    'browsers',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select browser as name,count(*) as views from views group by browser order by count(*) desc,browser) x),
    'devices',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select device as name,count(*) as views from views group by device order by count(*) desc,device) x),
    'modes',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select access_mode as name,count(*) as views from views group by access_mode order by count(*) desc,access_mode) x),
    'referrers',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select referrer_host as name,count(*) as views,count(distinct session_id) as visits from views where referrer_host<>'' group by referrer_host order by count(*) desc,referrer_host limit 20) x),
    'streamer_options',(select coalesce(jsonb_agg(x.streamer order by x.streamer),'[]'::jsonb) from (select distinct streamer from all_rows where streamer<>'') x),
    'legacy',jsonb_build_object('page_views',case when p_streamer is null then (select count(*) from public.site_analytics_events where event_type='page_view' and created_at>=v_start_at and created_at<v_end_at) else 0 end,'attribution_available',false),
    'collection_started_at',(select min(created_at) from sbw_analytics_private.access_events),
    'generated_at',now()
  ) into v_result;
  return v_result;
end;
$fn$;

revoke all on function sbw_analytics_private.group_report(integer,date,date,text) from public,anon,authenticated;
grant execute on function sbw_analytics_private.group_report(integer,date,date,text) to service_role;

create or replace function public.sbw_project_get_access_analytics_summary(
  p_days integer default 7,p_start_date date default null,p_end_date date default null,p_streamer text default null)
returns jsonb language sql security invoker set search_path=''
as $fn$ select sbw_analytics_private.group_report(p_days,p_start_date,p_end_date,p_streamer); $fn$;
revoke all on function public.sbw_project_get_access_analytics_summary(integer,date,date,text) from public,anon,authenticated;
grant execute on function public.sbw_project_get_access_analytics_summary(integer,date,date,text) to service_role;
notify pgrst, 'reload schema';
