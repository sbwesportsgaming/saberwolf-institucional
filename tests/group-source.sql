do $test$
declare a jsonb; b jsonb;
begin
  if has_function_privilege('anon','public.sbw_project_get_access_analytics_summary(integer,date,date,text)','execute')
    or has_function_privilege('authenticated','public.sbw_project_get_access_analytics_summary(integer,date,date,text)','execute')
    or not has_function_privilege('service_role','public.sbw_project_get_access_analytics_summary(integer,date,date,text)','execute') then
    raise exception 'Permissões incorretas no relatório da central';
  end if;
  perform set_config('request.jwt.claim.sub','__LOCAL_ADMIN_UID__',true);
  a := public.sbw_admin_get_access_analytics_summary(7,null,null,null);
  b := public.sbw_project_get_access_analytics_summary(7,null,null,null);
  if (a - 'generated_at') is distinct from (b - 'generated_at') then raise exception 'A central divergiu do relatório local'; end if;
  if b->>'site' <> 'saberwolf-esports' then raise exception 'Site incorreto'; end if;
end;
$test$;
set local role authenticated;
do $test$
begin
  begin
    perform public.sbw_project_get_access_analytics_summary(7,null,null,null);
    raise exception 'Usuário ganhou leitura do endpoint de servidor';
  exception when insufficient_privilege then null;
  end;
end;
$test$;
reset role;
set local role anon;
do $test$
begin
  begin
    perform public.sbw_project_get_access_analytics_summary(7,null,null,null);
    raise exception 'Visitante ganhou leitura do endpoint de servidor';
  exception when insufficient_privilege then null;
  end;
end;
$test$;
reset role;
set local role service_role;
do $test$
declare result jsonb;
begin
  result := public.sbw_project_get_access_analytics_summary(30,null,null,'tigerfurious');
  if result->>'ok' <> 'true' then raise exception 'Consulta pelo servidor falhou'; end if;
  begin
    perform public.sbw_project_get_access_analytics_summary(181,null,null,null);
    raise exception 'Intervalo excessivo foi aceito';
  exception when invalid_parameter_value then null;
  end;
end;
$test$;
reset role;
select 'permissoes_preservadas_e_relatorios_identicos' as verificacao;
