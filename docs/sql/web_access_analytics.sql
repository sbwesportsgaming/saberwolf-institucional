-- SBW: acessos próprios, separados por projeto. Histórico anterior preservado.
create schema if not exists sbw_analytics_private;
revoke all on schema sbw_analytics_private from public, anon;
grant usage on schema sbw_analytics_private to authenticated, service_role;

create table if not exists sbw_analytics_private.access_sessions (
  id uuid primary key,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  source_kind text not null check (source_kind in ('direct','internal','search','social','streamer','referral','campaign')),
  source_name text not null check (source_name ~ '^[a-z0-9][a-z0-9_.-]{0,179}$'),
  streamer text not null default '' check (streamer = '' or streamer ~ '^[a-z0-9][a-z0-9_.-]{0,79}$'),
  medium text not null default '' check (medium = '' or medium ~ '^[a-z0-9][a-z0-9_.-]{0,79}$'),
  campaign text not null default '' check (campaign = '' or campaign ~ '^[a-z0-9][a-z0-9_.-]{0,79}$'),
  referrer_host text not null default '' check (length(referrer_host) <= 180 and referrer_host !~ '[/@?#]'),
  entry_path text not null check (length(entry_path) between 1 and 180 and entry_path like '/%' and entry_path !~ '[?@#]'),
  is_test boolean not null default false,
  check ((source_kind = 'streamer') = (streamer <> ''))
);
create table if not exists sbw_analytics_private.access_events (
  id uuid primary key,
  session_id uuid not null references sbw_analytics_private.access_sessions(id),
  created_at timestamptz not null default now(),
  event_type text not null check (event_type in ('page_view','link_click')),
  page_path text not null check (length(page_path) between 1 and 180 and page_path like '/%' and page_path !~ '[?@#]'),
  browser text not null check (browser in ('Chrome','Firefox','Edge','Safari','Opera','Samsung Internet','Outro')),
  device text not null check (device in ('mobile','tablet','desktop')),
  access_mode text not null check (access_mode in ('browser','pwa','app','embedded')),
  destination_host text not null default '' check (length(destination_host) <= 180 and destination_host !~ '[/@?#]')
);
alter table sbw_analytics_private.access_sessions enable row level security;
alter table sbw_analytics_private.access_events enable row level security;
revoke all on sbw_analytics_private.access_sessions, sbw_analytics_private.access_events from public, anon, authenticated, service_role;
create index if not exists sbw_access_events_period_idx on sbw_analytics_private.access_events(created_at, session_id);
create index if not exists sbw_access_events_session_idx on sbw_analytics_private.access_events(session_id);
create index if not exists sbw_access_sessions_streamer_idx on sbw_analytics_private.access_sessions(streamer) where streamer <> '';

create or replace function sbw_analytics_private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $fn$
  select auth.uid() is not null and exists (select 1 from public.site_permissions where auth_user_id=auth.uid() and status='active' and (is_master_admin or is_sbw_admin));
$fn$;
revoke all on function sbw_analytics_private.is_admin() from public, anon;
grant execute on function sbw_analytics_private.is_admin() to authenticated;

create or replace function sbw_analytics_private.record_event(p_event jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $fn$
declare
  v_id uuid;
  v_session uuid;
  v_last_seen timestamptz;
  v_inserted integer;
begin
  if jsonb_typeof(p_event) <> 'object' or p_event->'consent_analytics' is distinct from 'true'::jsonb then
    raise exception 'invalid_access_consent' using errcode='22023';
  end if;
  v_id := (p_event->>'event_id')::uuid;
  v_session := (p_event->>'session_id')::uuid;
  if v_id is null or v_session is null then raise exception 'invalid_access_event' using errcode='22023'; end if;
  if exists (select 1 from sbw_analytics_private.access_events where id=v_id) then
    return jsonb_build_object('ok',true,'duplicate',true);
  end if;
  insert into sbw_analytics_private.access_sessions
    (id,source_kind,source_name,streamer,medium,campaign,referrer_host,entry_path,is_test)
  values (v_session,p_event->>'source_kind',p_event->>'source_name',coalesce(p_event->>'streamer',''),
    coalesce(p_event->>'medium',''),coalesce(p_event->>'campaign',''),coalesce(p_event->>'referrer_host',''),
    p_event->>'page_path',coalesce((p_event->>'is_test')::boolean,false))
  on conflict (id) do nothing;
  select last_seen_at into v_last_seen from sbw_analytics_private.access_sessions where id=v_session for update;
  if v_last_seen < now()-interval '30 minutes' then raise exception 'access_session_expired' using errcode='22023'; end if;
  insert into sbw_analytics_private.access_events
    (id,session_id,event_type,page_path,browser,device,access_mode,destination_host)
  values (v_id,v_session,p_event->>'event_type',p_event->>'page_path',p_event->>'browser',
    p_event->>'device',p_event->>'access_mode',coalesce(p_event->>'destination_host',''))
  on conflict (id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted > 0 then update sbw_analytics_private.access_sessions set last_seen_at=now() where id=v_session; end if;
  return jsonb_build_object('ok',true,'duplicate',v_inserted=0);
end;
$fn$;
revoke all on function sbw_analytics_private.record_event(jsonb) from public,anon,authenticated;
grant execute on function sbw_analytics_private.record_event(jsonb) to service_role;

create or replace function public.sbw_record_access_event(p_event jsonb)
returns jsonb language sql security invoker set search_path=''
as $fn$ select sbw_analytics_private.record_event(p_event); $fn$;
revoke all on function public.sbw_record_access_event(jsonb) from public,anon,authenticated;
grant execute on function public.sbw_record_access_event(jsonb) to service_role;

create or replace function sbw_analytics_private.report(
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
  if auth.uid() is null or sbw_analytics_private.is_admin() is not true then
    raise exception 'Apenas administradores autorizados podem consultar os acessos.' using errcode='42501';
  end if;
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
revoke all on function sbw_analytics_private.report(integer,date,date,text) from public,anon;
grant execute on function sbw_analytics_private.report(integer,date,date,text) to authenticated;

create or replace function public.sbw_admin_get_access_analytics_summary(
  p_days integer default 7,p_start_date date default null,p_end_date date default null,p_streamer text default null)
returns jsonb language sql security invoker set search_path=''
as $fn$ select sbw_analytics_private.report(p_days,p_start_date,p_end_date,p_streamer); $fn$;
revoke all on function public.sbw_admin_get_access_analytics_summary(integer,date,date,text) from public,anon;
grant execute on function public.sbw_admin_get_access_analytics_summary(integer,date,date,text) to authenticated;

-- A consulta histórica da SaberWolf também passa pela verificação estrita do banco.
do $do$
declare v_definition text;
begin
  if to_regprocedure('public.sbw_admin_get_site_analytics_summary(integer,date,date)') is not null then
    select pg_get_functiondef(to_regprocedure('public.sbw_admin_get_site_analytics_summary(integer,date,date)')) into v_definition;
    if position('public.sbw_admin_panel_can_manage()' in v_definition)>0 then
      execute replace(v_definition,'public.sbw_admin_panel_can_manage()','sbw_analytics_private.is_admin()');
    end if;
    revoke all on function public.sbw_admin_get_site_analytics_summary(integer,date,date) from public,anon;
  end if;
end;
$do$;

notify pgrst, 'reload schema';
