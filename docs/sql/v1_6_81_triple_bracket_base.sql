-- =========================================================
-- -SBW- v1.6.81 — Base Supabase do Sistema de 3 Chaves
-- Objetivo:
--   Registrar o formato triple-bracket no Supabase e garantir que
--   torneios criados com esse formato nasçam com configuração consistente.
--
-- Decisão de produto:
--   MVP travado em 8 equipes. Não tentar generalizar para 12/16/32 agora.
-- =========================================================

create table if not exists public.tournament_format_definitions (
  key text primary key,
  label text not null,
  short_label text,
  family text not null default 'custom',
  category text not null default 'custom',
  status text not null default 'planned',
  schema_version text,
  description text,
  public_note text,
  config jsonb not null default '{}'::jsonb,
  capabilities jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tournament_format_definitions enable row level security;

drop policy if exists "Public can read tournament format definitions" on public.tournament_format_definitions;
create policy "Public can read tournament format definitions"
  on public.tournament_format_definitions
  for select
  using (true);

insert into public.tournament_format_definitions (
  key, label, short_label, family, category, status, schema_version, description, public_note, config, capabilities, updated_at
) values (
  'triple-bracket',
  'Sistema de 3 Chaves',
  '3 Chaves',
  'triple_bracket',
  'advanced',
  'beta',
  'triplebracket.v1',
  'Formato avançado para 8 equipes com fase todos contra todos, Chave Alta, Chave Média, Chave Baixa e Grande Final sem reset com vantagem competitiva.',
  'MVP estrutural: exatamente 8 equipes, classificação geral, três chaves e final FT5 com vantagem para quem veio da Chave Alta.',
  jsonb_build_object(
    'formatKey', 'triple-bracket',
    'schemaVersion', 'triplebracket.v1',
    'requiredTeams', 8,
    'groupStageType', 'round_robin',
    'groupStageMatches', 28,
    'highBracketQualifiers', 4,
    'middleBracketQualifiers', 4,
    'brackets', jsonb_build_array('high', 'middle', 'low'),
    'finalSeries', jsonb_build_object(
      'type', 'single_series_with_advantage',
      'matchFormat', 'FT5',
      'noReset', true,
      'highAdvantageVsMiddle', 1,
      'highAdvantageVsLow', 2,
      'advantageUnit', 'games'
    ),
    'automationStage', 'base_config'
  ),
  jsonb_build_object(
    'teams', true,
    'requiredTeams', 8,
    'exactTeamCount', true,
    'roundRobin', true,
    'tripleBracket', true,
    'highBracket', true,
    'middleBracket', true,
    'lowBracket', true,
    'intermediaryFinal', true,
    'finalAdvantage', true,
    'rankingCompatible', true,
    'controlledBeta', true,
    'realTeamsOnly', true,
    'mvpOnlyEightTeams', true
  ),
  now()
)
on conflict (key) do update set
  label = excluded.label,
  short_label = excluded.short_label,
  family = excluded.family,
  category = excluded.category,
  status = excluded.status,
  schema_version = excluded.schema_version,
  description = excluded.description,
  public_note = excluded.public_note,
  config = excluded.config,
  capabilities = excluded.capabilities,
  updated_at = now();

create or replace function public.sbw_is_triple_bracket_format(p_format text)
returns boolean
language sql
immutable
as $$
  select lower(trim(coalesce(p_format, ''))) in ('triple-bracket', 'triple_bracket', 'triple-bracket-8', 'sistema-3-chaves', 'sistema-de-3-chaves')
$$;

create or replace function public.sbw_build_triple_bracket_config(p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  payload jsonb := coalesce(p_payload, '{}'::jsonb);
  source_config jsonb := coalesce(payload->'settings'->'tripleBracket', payload->'settings'->'triple_bracket', payload->'metadata'->'tripleBracket', payload->'metadata'->'triple_bracket', '{}'::jsonb);
begin
  return jsonb_build_object(
    'formatKey', 'triple-bracket',
    'schemaVersion', 'triplebracket.v1',
    'requiredTeams', 8,
    'groupStageType', 'round_robin',
    'groupStageLabel', 'Todos contra todos',
    'groupStageMatches', 28,
    'highBracketQualifiers', 4,
    'middleBracketQualifiers', 4,
    'brackets', jsonb_build_array('high', 'middle', 'low'),
    'bracketLabels', jsonb_build_object('high', 'Chave Alta', 'middle', 'Chave Média', 'low', 'Chave Baixa'),
    'finalSeries', jsonb_build_object(
      'type', 'single_series_with_advantage',
      'matchFormat', 'FT5',
      'noReset', true,
      'highAdvantageVsMiddle', 1,
      'highAdvantageVsLow', 2,
      'advantageUnit', 'games'
    ),
    'automationStage', 'base_config',
    'createdFromPayload', source_config
  );
end;
$$;

grant execute on function public.sbw_is_triple_bracket_format(text) to anon, authenticated;
grant execute on function public.sbw_build_triple_bracket_config(jsonb) to authenticated;

-- Recria a RPC de criação de torneio para validar/enriquecer o formato triple-bracket.
create or replace function public.sbw_create_tournament_for_organizer(p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  payload jsonb := coalesce(p_payload, '{}'::jsonb);
  organizer_key text := nullif(trim(coalesce(payload->>'tournament_organizer_id', payload->>'organizer_id', payload->'organizer'->>'id', payload->>'organizerSlug', payload->>'organizer_slug', payload->'organizer'->>'slug', '')), '');
  raw_title text := nullif(trim(coalesce(payload->>'title', payload->>'name', '')), '');
  raw_game text := nullif(trim(coalesce(payload->>'game_name', payload->>'gameName', payload->>'game', '')), '');
  base_slug text;
  slug_try text;
  counter integer := 1;
  target_organizer public.tournament_organizers;
  current_profile public.profiles;
  saved_tournament public.tournaments;
  status_value text := lower(trim(coalesce(payload->>'status', 'draft')));
  visibility_value text := lower(trim(coalesce(payload->>'visibility', 'public')));
  format_value text := lower(trim(coalesce(payload->>'format', 'double-elimination')));
  max_participants_value integer := nullif(payload->>'max_participants', '')::integer;
  settings_value jsonb := coalesce(payload->'settings', '{}'::jsonb);
  metadata_value jsonb := coalesce(payload->'metadata', '{}'::jsonb);
  triple_config jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta para criar torneios.';
  end if;

  if organizer_key is null or organizer_key = '' then
    raise exception 'Crie o torneio a partir do Painel do Organizador para vincular uma organização real.';
  end if;

  select * into target_organizer
  from public.tournament_organizers o
  where o.id::text = organizer_key or lower(o.slug) = lower(organizer_key)
  limit 1;

  if target_organizer.id is null then
    raise exception 'Organização de Torneios não encontrada.';
  end if;

  if not public.sbw_can_create_tournament_for_organizer(target_organizer.id::text)
     and not public.sbw_can_create_tournament_for_organizer(target_organizer.slug)
  then
    raise exception 'Você não tem permissão para criar torneios nesta organização.';
  end if;

  if raw_title is null then raise exception 'Informe o nome do torneio.'; end if;
  if raw_game is null then raise exception 'Informe o jogo do torneio.'; end if;

  if public.sbw_is_triple_bracket_format(format_value) then
    format_value := 'triple-bracket';
    max_participants_value := coalesce(max_participants_value, 8);

    if max_participants_value <> 8 then
      raise exception 'Sistema de 3 Chaves exige exatamente 8 equipes nesta primeira versão.';
    end if;

    triple_config := public.sbw_build_triple_bracket_config(payload);
    settings_value := settings_value
      || jsonb_build_object(
        'maxPlayers', 8,
        'maxParticipants', 8,
        'participantCapacityUnit', 'teams',
        'capacityUnit', 'teams',
        'formatKey', 'triple-bracket',
        'schemaVersion', 'triplebracket.v1',
        'tripleBracket', triple_config,
        'triple_bracket', triple_config
      );
    metadata_value := metadata_value
      || jsonb_build_object(
        'formatKey', 'triple-bracket',
        'schemaVersion', 'triplebracket.v1',
        'tripleBracket', triple_config,
        'triple_bracket', triple_config,
        'mvpScope', '8_equipes'
      );
  end if;

  if status_value not in ('draft', 'registration-open', 'open', 'published', 'scheduled', 'structure-generated', 'in-progress', 'running', 'finished', 'completed', 'cancelled', 'archived') then
    status_value := 'draft';
  end if;

  if visibility_value not in ('public', 'private', 'unlisted') then
    visibility_value := 'public';
  end if;

  select * into current_profile
  from public.profiles p
  where p.auth_user_id = auth.uid() or p.id::text = auth.uid()::text
  limit 1;

  base_slug := public.sbw_slugify(coalesce(nullif(payload->>'slug', ''), raw_title));

  loop
    slug_try := case when counter = 1 then base_slug else base_slug || '-' || counter::text end;
    exit when not exists (select 1 from public.tournaments t where t.slug = slug_try);
    counter := counter + 1;
  end loop;

  insert into public.tournaments (
    slug, title, description, rules, prize_text, game_id, game_name, platform, format, status, visibility,
    tournament_organizer_id, organizer_id, organizer_slug, organizer_name,
    max_participants, current_participants,
    registration_opens_at, registration_closes_at, checkin_starts_at, checkin_ends_at,
    starts_at, ends_at, cover_url, settings, metadata,
    created_by_auth_user_id, created_by_profile_id, created_at, updated_at
  ) values (
    slug_try, raw_title, nullif(payload->>'description', ''), nullif(payload->>'rules', ''), nullif(coalesce(payload->>'prize_text', payload->>'prizeText', ''), ''),
    coalesce(nullif(payload->>'game_id', ''), public.sbw_slugify(raw_game)), raw_game, coalesce(nullif(payload->>'platform', ''), 'crossplay'),
    format_value, status_value, visibility_value,
    target_organizer.id, target_organizer.id::text, target_organizer.slug, target_organizer.name,
    max_participants_value, coalesce(nullif(payload->>'current_participants', '')::integer, 0),
    nullif(payload->>'registration_opens_at', '')::timestamptz,
    nullif(payload->>'registration_closes_at', '')::timestamptz,
    nullif(payload->>'checkin_starts_at', '')::timestamptz,
    nullif(payload->>'checkin_ends_at', '')::timestamptz,
    nullif(payload->>'starts_at', '')::timestamptz,
    nullif(payload->>'ends_at', '')::timestamptz,
    nullif(coalesce(payload->>'cover_url', payload->>'coverUrl', ''), ''),
    settings_value,
    metadata_value || jsonb_build_object(
      'source', 'organizer-tournament-create-v1.6.81',
      'organizerId', target_organizer.id,
      'organizerSlug', target_organizer.slug,
      'organizerName', target_organizer.name,
      'createdByProfileSlug', coalesce(current_profile.slug, current_profile.username, '')
    ),
    auth.uid(), current_profile.id, now(), now()
  ) returning * into saved_tournament;

  return jsonb_build_object('ok', true, 'message', 'Torneio criado e vinculado à Organização de Torneios.', 'tournament', to_jsonb(saved_tournament));
end;
$$;

grant execute on function public.sbw_create_tournament_for_organizer(jsonb) to authenticated;
