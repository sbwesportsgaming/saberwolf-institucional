-- v1.6.81.1 — Hotfix Sistema de 3 Chaves: organizer_id UUID
-- Corrige a RPC de criação de torneios quando public.tournaments.organizer_id é UUID.
-- Causa do erro: a v1.6.81 tentava inserir target_organizer.id::text em organizer_id.

begin;

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
    target_organizer.id, target_organizer.id, target_organizer.slug, target_organizer.name,
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

commit;
