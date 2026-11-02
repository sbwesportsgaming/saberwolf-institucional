-- Executado dentro de uma transação descartada. Não cria contas ou dados reais.
do $check$
begin
  if not (select relrowsecurity from pg_class where oid='sbw_analytics_private.access_events'::regclass)
    or not (select relrowsecurity from pg_class where oid='sbw_analytics_private.access_sessions'::regclass) then raise exception 'RLS missing'; end if;
  if has_table_privilege('anon','sbw_analytics_private.access_events','select')
    or has_table_privilege('authenticated','sbw_analytics_private.access_events','select')
    or has_table_privilege('anon','sbw_analytics_private.access_events','insert')
    or has_table_privilege('authenticated','sbw_analytics_private.access_events','insert') then raise exception 'Raw events exposed'; end if;
  if has_function_privilege('anon','public.sbw_admin_get_access_analytics_summary(integer,date,date,text)','execute')
    or has_function_privilege('anon','public.sbw_record_access_event(jsonb)','execute')
    or has_function_privilege('authenticated','public.sbw_record_access_event(jsonb)','execute') then raise exception 'Unexpected execute privilege'; end if;
end;
$check$;

select set_config('request.jwt.claim.sub','__ADMIN_UID__',true);
select set_config('request.jwt.claims','{"sub":"__ADMIN_UID__","role":"authenticated"}',true);
set local role authenticated;
do $check$
begin
  if (public.sbw_admin_get_access_analytics_summary(7,null,null,null)->>'ok')::boolean is not true then raise exception 'Admin denied'; end if;
end;
$check$;
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $check$
begin
  begin perform public.sbw_admin_get_access_analytics_summary(); raise exception 'Non-admin saw report'; exception when insufficient_privilege then null; end;
  begin perform public.sbw_record_access_event('{}'::jsonb); raise exception 'Browser wrote events directly'; exception when insufficient_privilege then null; end;
  begin perform count(*) from sbw_analytics_private.access_events; raise exception 'Browser read raw events'; exception when insufficient_privilege then null; end;
end;
$check$;
reset role;
set local role anon;
do $check$
begin
  begin perform public.sbw_admin_get_access_analytics_summary(); raise exception 'Visitor saw report'; exception when insufficient_privilege then null; end;
  begin perform public.sbw_record_access_event('{}'::jsonb); raise exception 'Visitor wrote directly'; exception when insufficient_privilege then null; end;
end;
$check$;
reset role;

set local role service_role;
select public.sbw_record_access_event('{
  "event_id":"839573fe-f50f-47cf-891c-76605a6d7111","session_id":"5792871e-af71-4716-bef0-7c8812ac1122",
  "event_type":"page_view","page_path":"/","consent_analytics":true,
  "source_kind":"streamer","source_name":"tigerfurious","streamer":"tigerfurious","medium":"colaborador","campaign":"comerciais_sbw",
  "referrer_host":"","browser":"Chrome","device":"desktop","access_mode":"browser","is_test":false
}'::jsonb);
-- Mesmo ID não duplica. Outra página da mesma sessão mantém o streamer inicial.
select public.sbw_record_access_event('{
  "event_id":"839573fe-f50f-47cf-891c-76605a6d7111","session_id":"5792871e-af71-4716-bef0-7c8812ac1122",
  "event_type":"page_view","page_path":"/","consent_analytics":true
}'::jsonb);
select public.sbw_record_access_event('{
  "event_id":"839573fe-f50f-47cf-891c-76605a6d7222","session_id":"5792871e-af71-4716-bef0-7c8812ac1122",
  "event_type":"page_view","page_path":"/pages/sobre","consent_analytics":true,
  "source_kind":"direct","source_name":"direct","streamer":"","medium":"","campaign":"",
  "referrer_host":"","browser":"Chrome","device":"desktop","access_mode":"pwa","is_test":false
}'::jsonb);
select public.sbw_record_access_event('{
  "event_id":"839573fe-f50f-47cf-891c-76605a6d7333","session_id":"5792871e-af71-4716-bef0-7c8812ac1133",
  "event_type":"page_view","page_path":"/","consent_analytics":true,
  "source_kind":"streamer","source_name":"elitz","streamer":"elitz","medium":"streamer","campaign":"qa",
  "referrer_host":"","browser":"Chrome","device":"desktop","access_mode":"browser","is_test":true
}'::jsonb);
reset role;

select set_config('request.jwt.claim.sub','__ADMIN_UID__',true);
select set_config('request.jwt.claims','{"sub":"__ADMIN_UID__","role":"authenticated"}',true);
set local role authenticated;
do $check$
declare v jsonb;
begin
  v:=public.sbw_admin_get_access_analytics_summary(7,null,null,'tigerfurious');
  if (v->'totals'->>'page_views')::integer<>2 then raise exception 'Wrong page views or duplicate count'; end if;
  if (v->'totals'->>'sessions')::integer<>1 then raise exception 'Two pages were counted as two visits'; end if;
  if (v->'totals'->>'pages')::integer<>2 then raise exception 'Missing pages'; end if;
  if jsonb_array_length(v->'modes')<>2 then raise exception 'Browser/PWA missing'; end if;
  if jsonb_array_length(v->'daily')<>7 then raise exception 'Period gaps'; end if;
  v:=public.sbw_admin_get_access_analytics_summary(7,null,null,'elitz');
  if (v->'totals'->>'page_views')::integer<>0 then raise exception 'Test traffic leaked into public results'; end if;
  begin perform public.sbw_admin_get_access_analytics_summary(181); raise exception 'Oversized range accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.sbw_admin_get_access_analytics_summary(7,current_date,current_date-1); raise exception 'Reversed range accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.sbw_admin_get_access_analytics_summary(7,current_date,null); raise exception 'Partial range accepted'; exception when invalid_parameter_value then null; end;
end;
$check$;
reset role;

update sbw_analytics_private.access_sessions set last_seen_at=now()-interval '31 minutes' where id='5792871e-af71-4716-bef0-7c8812ac1122';
set local role service_role;
do $check$
begin
  begin
    perform public.sbw_record_access_event('{
      "event_id":"839573fe-f50f-47cf-891c-76605a6d7444","session_id":"5792871e-af71-4716-bef0-7c8812ac1122",
      "event_type":"page_view","page_path":"/","consent_analytics":true,
      "source_kind":"direct","source_name":"direct","browser":"Chrome","device":"desktop","access_mode":"browser"
    }'::jsonb);
    raise exception 'Expired session accepted';
  exception when invalid_parameter_value then null;
  end;
end;
$check$;
reset role;
