function sbwGetStorageConfig() {
  return typeof SBW_TOURNAMENTS_CONFIG !== "undefined"
    ? SBW_TOURNAMENTS_CONFIG
    : {
      storageKey: "sbw_tournaments",
      registrationKey: "sbw_demo_registrations",
      appMode: "local-demo"
    };
}

function sbwIsSupabaseEnabled() {
  return Boolean(
    window.SBWSupabase &&
    typeof window.SBWSupabase.isEnabled === "function" &&
    window.SBWSupabase.isEnabled()
  );
}

function sbwTournamentLocalDemoFallbackAllowed() {
  const host = String(window.location?.hostname || "").toLowerCase();
  const config = sbwGetStorageConfig();

  if (sbwIsSupabaseEnabled()) {
    return Boolean(config.allowLocalDemoFallback === true && config.forceLocalDemoFallback === true);
  }

  return Boolean(
    config.allowLocalDemoFallback === true ||
    config.appMode === "local-demo" ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === ""
  );
}

function sbwGetTournamentsTableName() {
  const config = window.SBWSupabaseConfig || {};

  if (config.tables && config.tables.tournaments) {
    return config.tables.tournaments;
  }

  return "tournaments";
}

function sbwGetTournamentOrganizersTableName() {
  const config = window.SBWSupabaseConfig || {};

  if (config.tables && config.tables.tournamentOrganizers) {
    return config.tables.tournamentOrganizers;
  }

  return "tournament_organizers";
}

function sbwGetTournamentOrganizerMembersTableName() {
  const config = window.SBWSupabaseConfig || {};

  if (config.tables && config.tables.tournamentOrganizerMembers) {
    return config.tables.tournamentOrganizerMembers;
  }

  return "tournament_organizer_members";
}

function sbwGetTournamentParticipantsTableName() {
  const config = window.SBWSupabaseConfig || {};

  if (config.tables && config.tables.tournamentParticipants) {
    return config.tables.tournamentParticipants;
  }

  return "tournament_participants";
}

function sbwGetTeamsTableName() {
  const config = window.SBWSupabaseConfig || {};

  if (config.tables && config.tables.teams) {
    return config.tables.teams;
  }

  return "teams";
}

function sbwGetTeamMembersTableName() {
  const config = window.SBWSupabaseConfig || {};

  if (config.tables && config.tables.teamMembers) {
    return config.tables.teamMembers;
  }

  return "team_members";
}

const SBW_TOURNAMENT_PARTICIPANT_SELECT_COLUMNS = [
  "id",
  "tournament_id",
  "tournament_slug",
  "tournament_name",
  "auth_user_id",
  "profile_id",
  "player_name",
  "player_slug",
  "team_name",
  "status",
  "check_in_status",
  "checked_in_at",
  "seed",
  "metadata",
  "created_at",
  "updated_at"
].join(",");


const SBW_TOURNAMENT_ORGANIZER_OVERRIDES_KEY = "sbw_tournament_organizer_overrides_v1_5_7_5";

function sbwGetTournamentOrganizerLocalOverrides() {
  try {
    const raw = localStorage.getItem(SBW_TOURNAMENT_ORGANIZER_OVERRIDES_KEY);

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return parsed;
  } catch (error) {
    console.warn("[SaberWolf Local] Não foi possível ler overrides de organizadores:", error);
    return {};
  }
}

function sbwSetTournamentOrganizerLocalOverrides(overrides) {
  localStorage.setItem(
    SBW_TOURNAMENT_ORGANIZER_OVERRIDES_KEY,
    JSON.stringify(overrides || {})
  );
}

function sbwGetTournamentOrganizerOverrideKey(value) {
  if (value && typeof value === "object") {
    return sbwNormalizeTournamentOrganizerKey(value.slug || value.id || value.name || value.displayName || value.tag);
  }

  return sbwNormalizeTournamentOrganizerKey(value);
}

function sbwNormalizeOrganizerLinks(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return {
    website: String(value.website || value.site || value.url || "").trim(),
    discord: String(value.discord || value.discordUrl || value.discord_url || "").trim(),
    instagram: String(value.instagram || value.instagramUrl || value.instagram_url || "").trim(),
    youtube: String(value.youtube || value.youtubeUrl || value.youtube_url || "").trim(),
    twitch: String(value.twitch || value.twitchUrl || value.twitch_url || "").trim(),
    x: String(value.x || value.twitter || value.twitterUrl || value.twitter_url || "").trim()
  };
}

function sbwApplyTournamentOrganizerLocalOverride(organizer) {
  if (!organizer) {
    return organizer;
  }

  const overrides = sbwGetTournamentOrganizerLocalOverrides();
  const matchKeys = sbwGetOrganizerMatchKeys(organizer);
  const overrideKey = matchKeys.find((key) => overrides[key]);

  if (!overrideKey) {
    return organizer;
  }

  const override = overrides[overrideKey] || {};
  const theme = sbwBuildTournamentOrganizerThemeFromSources(
    organizer.theme,
    override.theme
  );

  return {
    ...organizer,
    ...override,
    id: organizer.id,
    slug: override.slug || organizer.slug,
    name: override.name || organizer.name,
    displayName: override.displayName || override.name || organizer.displayName || organizer.name,
    tag: override.tag || organizer.tag,
    status: override.status || organizer.status,
    statusLabel: sbwGetOrganizerStatusLabel(override.status || organizer.status),
    verified: typeof override.verified === "boolean" ? override.verified : organizer.verified,
    games: Array.isArray(override.games) ? override.games : organizer.games,
    aliases: Array.isArray(override.aliases) ? override.aliases : organizer.aliases,
    links: sbwNormalizeOrganizerLinks({
      ...(organizer.links || {}),
      ...(override.links || {})
    }),
    theme,
    source: organizer.source,
    localOverride: true,
    localOverrideKey: overrideKey,
    raw: organizer.raw
  };
}

function sbwSaveTournamentOrganizerLocalOverride(slugOrOrganizer, updates = {}) {
  const key = sbwGetTournamentOrganizerOverrideKey(slugOrOrganizer);

  if (!key) {
    throw new Error("Organizador inválido para salvar override local.");
  }

  const overrides = sbwGetTournamentOrganizerLocalOverrides();
  const previous = overrides[key] || {};

  const sanitizedUpdates = {
    ...updates,
    links: sbwNormalizeOrganizerLinks(updates.links || previous.links || {}),
    theme: sbwNormalizeTournamentOrganizerTheme(updates.theme || previous.theme || {}),
    updatedAt: new Date().toISOString()
  };

  overrides[key] = {
    ...previous,
    ...sanitizedUpdates
  };

  sbwSetTournamentOrganizerLocalOverrides(overrides);

  return overrides[key];
}

function sbwClearTournamentOrganizerLocalOverride(slugOrOrganizer) {
  const key = sbwGetTournamentOrganizerOverrideKey(slugOrOrganizer);

  if (!key) {
    return false;
  }

  const overrides = sbwGetTournamentOrganizerLocalOverrides();

  if (!overrides[key]) {
    return false;
  }

  delete overrides[key];
  sbwSetTournamentOrganizerLocalOverrides(overrides);

  return true;
}

function sbwNormalizeOrganizerStatus(status) {
  const value = String(status || "")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-");

  if (["active", "approved", "published", "public"].includes(value)) {
    return "active";
  }

  if (["pending", "review"].includes(value)) {
    return "pending";
  }

  if (["inactive", "disabled", "archived"].includes(value)) {
    return "inactive";
  }

  return value || "active";
}

function sbwIsTournamentOrganizerPubliclyVisible(organizer) {
  if (!organizer) return false;

  const raw = organizer.raw && typeof organizer.raw === "object" ? organizer.raw : {};
  const metadata = organizer.metadata && typeof organizer.metadata === "object" ? organizer.metadata : {};
  const status = sbwNormalizeOrganizerStatus(organizer.status || raw.status || metadata.status);

  return !(
    ["inactive", "archived", "deleted", "removed", "disabled"].includes(status) ||
    metadata.adminArchived === true ||
    metadata.admin_archived === true ||
    metadata.adminDeleted === true ||
    metadata.admin_deleted === true ||
    raw.is_public === false ||
    raw.public === false ||
    raw.visibility === "private"
  );
}

function sbwGetOrganizerStatusLabel(status) {
  const normalized = sbwNormalizeOrganizerStatus(status);

  const labels = {
    active: "Ativo",
    pending: "Em análise",
    inactive: "Inativo",
    draft: "Rascunho"
  };

  return labels[normalized] || "Ativo";
}

function sbwNormalizeOrganizerListValue(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).map(String);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function sbwNormalizeOrganizerThemeColor(value, fallback) {
  const raw = String(value || "").trim();

  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toLowerCase();
  }

  if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
    return raw.toLowerCase();
  }

  return fallback;
}

function sbwHexColorToRgbText(hex) {
  const value = sbwNormalizeOrganizerThemeColor(hex, "#38bdf8").replace("#", "");

  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16)
  ].join(", ");
}

function sbwNormalizeTournamentOrganizerTheme(themeSource = {}) {
  const source = themeSource && typeof themeSource === "object" ? themeSource : {};

  const primary = sbwNormalizeOrganizerThemeColor(
    source.primary || source.themePrimary || source.primaryColor || source.theme_primary,
    "#38bdf8"
  );

  const secondary = sbwNormalizeOrganizerThemeColor(
    source.secondary || source.themeSecondary || source.secondaryColor || source.theme_secondary,
    "#7c3cff"
  );

  const accent = sbwNormalizeOrganizerThemeColor(
    source.accent || source.themeAccent || source.accentColor || source.theme_accent,
    "#facc15"
  );

  const text = sbwNormalizeOrganizerThemeColor(
    source.text || source.themeText || source.textColor || source.theme_text,
    "#f8fafc"
  );

  return {
    primary,
    secondary,
    accent,
    text,
    primaryRgb: sbwHexColorToRgbText(primary),
    secondaryRgb: sbwHexColorToRgbText(secondary),
    accentRgb: sbwHexColorToRgbText(accent)
  };
}

function sbwBuildTournamentOrganizerThemeFromSources(...sources) {
  const merged = {};

  sources.forEach((source) => {
    if (!source || typeof source !== "object") {
      return;
    }

    Object.entries(source).forEach(([key, value]) => {
      const normalizedValue = String(value || "").trim();

      if (normalizedValue) {
        merged[key] = value;
      }
    });
  });

  return sbwNormalizeTournamentOrganizerTheme(merged);
}

function sbwGetTournamentOrganizerFallbackThemeSource(value) {
  const key = sbwNormalizeTournamentOrganizerKey(value);

  const fallbackThemes = {
    "sbw-championship": {
      primary: "#38bdf8",
      secondary: "#7c3cff",
      accent: "#facc15",
      text: "#f8fafc"
    },
    "sbw": {
      primary: "#38bdf8",
      secondary: "#7c3cff",
      accent: "#facc15",
      text: "#f8fafc"
    },
    "saberwolf": {
      primary: "#38bdf8",
      secondary: "#7c3cff",
      accent: "#facc15",
      text: "#f8fafc"
    },
    "rinha-online": {
      primary: "#ef4444",
      secondary: "#f97316",
      accent: "#facc15",
      text: "#fff7ed"
    },
    "rinha": {
      primary: "#ef4444",
      secondary: "#f97316",
      accent: "#facc15",
      text: "#fff7ed"
    }
  };

  return fallbackThemes[key] || {};
}

function sbwGetTournamentOrganizerTheme(organizer) {
  if (organizer?.theme && typeof organizer.theme === "object") {
    return sbwNormalizeTournamentOrganizerTheme(organizer.theme);
  }

  return sbwNormalizeTournamentOrganizerTheme();
}

function sbwGetTournamentOrganizerThemeStyle(organizer) {
  const theme = sbwGetTournamentOrganizerTheme(organizer);

  return [
    `--org-primary: ${theme.primary}`,
    `--org-secondary: ${theme.secondary}`,
    `--org-accent: ${theme.accent}`,
    `--org-text: ${theme.text}`,
    `--org-primary-rgb: ${theme.primaryRgb}`,
    `--org-secondary-rgb: ${theme.secondaryRgb}`,
    `--org-accent-rgb: ${theme.accentRgb}`
  ].join("; ");
}

function sbwNormalizeTournamentOrganizerKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function sbwGetOrganizerMatchKeys(organizer) {
  if (!organizer) {
    return [];
  }

  const values = [
    organizer.id,
    organizer.slug,
    organizer.name,
    organizer.displayName,
    organizer.tag
  ];

  if (Array.isArray(organizer.aliases)) {
    values.push(...organizer.aliases);
  }

  return values
    .filter(Boolean)
    .map(sbwNormalizeTournamentOrganizerKey)
    .filter(Boolean);
}

function sbwGetTournamentOrganizerMatchKeys(tournament) {
  const organizer = tournament?.organizer;
  const values = [
    tournament?.organizerId,
    tournament?.organizerSlug,
    tournament?.organizerName
  ];

  if (typeof organizer === "string") {
    values.push(organizer);
  }

  if (organizer && typeof organizer === "object") {
    values.push(
      organizer.id,
      organizer.slug,
      organizer.name,
      organizer.displayName,
      organizer.title
    );
  }

  return values
    .filter(Boolean)
    .map(sbwNormalizeTournamentOrganizerKey)
    .filter(Boolean);
}

function sbwTournamentBelongsToOrganizer(tournament, organizer) {
  const organizerKeys = sbwGetOrganizerMatchKeys(organizer);
  const tournamentKeys = sbwGetTournamentOrganizerMatchKeys(tournament);

  if (organizerKeys.length === 0 || tournamentKeys.length === 0) {
    return false;
  }

  return tournamentKeys.some((key) => organizerKeys.includes(key));
}

function sbwNormalizeSupabaseTournamentOrganizer(row) {
  const metadata = row.metadata && typeof row.metadata === "object"
    ? row.metadata
    : {};

  const settings = row.settings && typeof row.settings === "object"
    ? row.settings
    : {};

  const slug = row.slug || row.public_slug || row.public_id || row.id;
  const name = row.name || row.display_name || row.title || row.organizer_name || "Organizador";
  const status = sbwNormalizeOrganizerStatus(row.status || row.public_status || metadata.status);
  const fallbackTheme = sbwBuildTournamentOrganizerThemeFromSources(
    sbwGetTournamentOrganizerFallbackThemeSource(slug),
    sbwGetTournamentOrganizerFallbackThemeSource(name),
    sbwGetTournamentOrganizerFallbackThemeSource(row.tag || row.short_tag || row.acronym || metadata.tag)
  );

  const theme = sbwBuildTournamentOrganizerThemeFromSources(
    fallbackTheme,
    settings.theme,
    settings.visualIdentity,
    settings.visual_identity,
    metadata.theme,
    metadata.visualIdentity,
    metadata.visual_identity,
    row.theme,
    row.theme_config,
    row.visual_identity,
    {
      primary: row.theme_primary || row.primary_color || row.color_primary,
      secondary: row.theme_secondary || row.secondary_color || row.color_secondary,
      accent: row.theme_accent || row.accent_color || row.color_accent,
      text: row.theme_text || row.text_color || row.color_text
    }
  );

  return {
    id: String(row.id || slug || name),
    slug: String(slug || row.id || name),
    name,
    displayName: name,
    tag: row.tag || row.short_tag || row.acronym || metadata.tag || "",
    description:
      row.description ||
      row.short_description ||
      row.bio ||
      metadata.description ||
      "Organizador autorizado para publicar eventos competitivos na plataforma -SBW-.",
    status,
    statusLabel: sbwGetOrganizerStatusLabel(status),
    verified: Boolean(row.verified || row.is_verified || metadata.verified || status === "active"),
    logoUrl: row.logo_url || row.avatar_url || row.image_url || metadata.logoUrl || metadata.logo_url || "",
    bannerUrl: row.banner_url || row.cover_url || metadata.bannerUrl || metadata.banner_url || "",
    games: sbwNormalizeOrganizerListValue(
      row.games ||
      row.game_tags ||
      row.modalities ||
      settings.games ||
      metadata.games ||
      []
    ),
    aliases: sbwNormalizeOrganizerListValue(
      row.aliases ||
      row.match_aliases ||
      metadata.aliases ||
      metadata.matchAliases ||
      []
    ),
    links: sbwNormalizeOrganizerLinks(
      row.links ||
      row.social_links ||
      settings.links ||
      metadata.links ||
      metadata.socialLinks ||
      metadata.social_links ||
      {}
    ),
    type:
      row.type ||
      row.organizer_type ||
      metadata.type ||
      "Organizador de torneios",
    theme,
    metadata,
    organizerAssets: (
      metadata.organizerAssets ||
      metadata.organizer_assets ||
      metadata.assetFrames ||
      {}
    ),
    source: "supabase",
    raw: row
  };
}

function sbwGetDemoTournamentOrganizers() {
  return [
    {
      id: "sbw-championship",
      slug: "sbw-championship",
      name: "-SBW- Championship",
      displayName: "-SBW- Championship",
      tag: "SBW",
      description: "Organização oficial para campeonatos, ligas e eventos competitivos do ecossistema -SBW-.",
      status: "active",
      statusLabel: "Ativo",
      verified: true,
      logoUrl: "",
      bannerUrl: "",
      games: ["FGC", "Eventos oficiais"],
      aliases: ["SaberWolf", "SaberWolf eSports", "SBW", "-SBW-"],
      links: {
        website: "",
        discord: "",
        instagram: "",
        youtube: "",
        twitch: "",
        x: ""
      },
      type: "Organizador oficial",
      theme: sbwNormalizeTournamentOrganizerTheme({
        primary: "#38bdf8",
        secondary: "#7c3cff",
        accent: "#facc15",
        text: "#f8fafc"
      }),
      source: "demo"
    },
    {
      id: "rinha-online",
      slug: "rinha-online",
      name: "Rinha Online",
      displayName: "Rinha Online",
      tag: "RINHA",
      description: "Entidade parceira preparada para publicar torneios próprios, editar identidade visual e gerenciar eventos autorizados.",
      status: "active",
      statusLabel: "Ativo",
      verified: true,
      logoUrl: "",
      bannerUrl: "",
      games: ["FGC", "Comunidade"],
      aliases: ["Rinha", "Rinha Online"],
      links: {
        website: "",
        discord: "",
        instagram: "",
        youtube: "",
        twitch: "",
        x: ""
      },
      type: "Organizador parceiro",
      theme: sbwNormalizeTournamentOrganizerTheme({
        primary: "#ef4444",
        secondary: "#f97316",
        accent: "#facc15",
        text: "#fff7ed"
      }),
      source: "demo"
    }
  ];
}

async function sbwGetSupabaseTournamentOrganizers() {
  if (!sbwIsSupabaseEnabled()) {
    return [];
  }

  const tableName = sbwGetTournamentOrganizersTableName();

  try {
    const { data, error } = await window.SBWSupabase.client
      .from(tableName)
      .select("*");

    if (error) {
      console.error("[SaberWolf Supabase] Erro ao buscar organizadores de torneio:", error);
      return [];
    }

    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map(sbwNormalizeSupabaseTournamentOrganizer)
      .filter(sbwIsTournamentOrganizerPubliclyVisible);
  } catch (error) {
    console.error("[SaberWolf Supabase] Falha inesperada ao buscar organizadores de torneio:", error);
    return [];
  }
}

async function sbwGetAllTournamentOrganizersAsync() {
  if (sbwIsSupabaseEnabled()) {
    const supabaseOrganizers = await sbwGetSupabaseTournamentOrganizers();

    if (supabaseOrganizers.length > 0) {
      return supabaseOrganizers.map(sbwApplyTournamentOrganizerLocalOverride);
    }

    if (!sbwTournamentLocalDemoFallbackAllowed()) {
      console.warn("[SaberWolf Supabase] Nenhum organizador retornado. Exibindo estado vazio em produção.");
      return [];
    }

    console.warn("[SaberWolf Supabase] Nenhum organizador retornado. Usando fallback local-demo apenas em ambiente local.");
  }

  return sbwTournamentLocalDemoFallbackAllowed()
    ? sbwGetDemoTournamentOrganizers().map(sbwApplyTournamentOrganizerLocalOverride)
    : [];
}

async function sbwGetTournamentOrganizerBySlugAsync(slug) {
  const requestedKey = sbwNormalizeTournamentOrganizerKey(slug);

  if (!requestedKey) {
    return null;
  }

  const organizers = await sbwGetAllTournamentOrganizersAsync();

  return organizers.find((organizer) => {
    return sbwGetOrganizerMatchKeys(organizer).includes(requestedKey);
  }) || null;
}


function sbwBuildTournamentOrganizerPayload(organizer = {}) {
  const links = organizer.links && typeof organizer.links === "object" ? organizer.links : {};
  const theme = organizer.theme && typeof organizer.theme === "object" ? organizer.theme : {};

  return {
    slug: String(organizer.slug || "").trim(),
    name: String(organizer.name || organizer.displayName || "").trim(),
    displayName: String(organizer.displayName || organizer.name || "").trim(),
    tag: String(organizer.tag || "").trim().slice(0, 24),
    type: String(organizer.type || "Organizador de torneios").trim(),
    status: String(organizer.status || "active").trim(),
    description: String(organizer.description || "").trim(),
    games: sbwNormalizeOrganizerListValue(organizer.games),
    aliases: sbwNormalizeOrganizerListValue(organizer.aliases),
    logoUrl: String(organizer.logoUrl || organizer.logo_url || "").trim(),
    bannerUrl: String(organizer.bannerUrl || organizer.banner_url || "").trim(),
    links: sbwNormalizeOrganizerLinks(links),
    theme: sbwNormalizeTournamentOrganizerTheme(theme),
    organizerAssets: organizer.organizerAssets && typeof organizer.organizerAssets === "object"
      ? organizer.organizerAssets
      : {},
    metadata: {
      ...(organizer.metadata && typeof organizer.metadata === "object" ? organizer.metadata : {}),
      organizerAssets: organizer.organizerAssets && typeof organizer.organizerAssets === "object"
        ? organizer.organizerAssets
        : ((organizer.metadata && typeof organizer.metadata === "object" && organizer.metadata.organizerAssets) || {})
    }
  };
}

function sbwNormalizeTournamentOrganizerRpcResult(data) {
  const result = data && typeof data === "object" ? data : {};
  const organizer = result.organizer || result.data || result.row || result;
  const normalized = sbwNormalizeSupabaseTournamentOrganizer(organizer);

  return {
    ok: result.ok !== false,
    message: result.message || "Organização salva.",
    organizer: normalized,
    raw: result
  };
}

async function sbwCreateTournamentOrganizerAsync(organizer = {}) {
  if (!sbwIsSupabaseEnabled()) {
    throw new Error("Supabase não está ativo. A criação real da Organização de Torneios exige conexão com o Supabase.");
  }

  const payload = sbwBuildTournamentOrganizerPayload(organizer);

  if (!payload.name) {
    throw new Error("Informe o nome público da Organização de Torneios.");
  }

  try {
    const { data, error } = await window.SBWSupabase.client.rpc("sbw_create_tournament_organizer", {
      p_payload: payload
    });

    if (error) {
      throw error;
    }

    const result = sbwNormalizeTournamentOrganizerRpcResult(data);

    if (!result.ok) {
      throw new Error(result.message || "Não foi possível criar a Organização de Torneios.");
    }

    return result;
  } catch (error) {
    console.error("[SaberWolf Supabase] Erro ao criar Organização de Torneios:", error);
    throw error;
  }
}

async function sbwUpdateTournamentOrganizerProfileAsync(slug, updates = {}) {
  if (!sbwIsSupabaseEnabled()) {
    throw new Error("Supabase não está ativo. A edição real da Organização de Torneios exige conexão com o Supabase.");
  }

  const organizerSlug = String(slug || updates.slug || "").trim();

  if (!organizerSlug) {
    throw new Error("Organização não informada para edição.");
  }

  const payload = sbwBuildTournamentOrganizerPayload(updates);

  try {
    const { data, error } = await window.SBWSupabase.client.rpc("sbw_update_tournament_organizer_profile", {
      p_slug: organizerSlug,
      p_payload: payload
    });

    if (error) {
      throw error;
    }

    const result = sbwNormalizeTournamentOrganizerRpcResult(data);

    if (!result.ok) {
      throw new Error(result.message || "Não foi possível salvar a Organização de Torneios.");
    }

    return result;
  } catch (error) {
    console.error("[SaberWolf Supabase] Erro ao atualizar Organização de Torneios:", error);
    throw error;
  }
}

function sbwNormalizeSupabaseTournamentOrganizerMember(row) {
  const profile = row.profile && typeof row.profile === "object"
    ? row.profile
    : {};

  const metadata = row.metadata && typeof row.metadata === "object"
    ? row.metadata
    : {};

  const name =
    row.display_name ||
    row.member_name ||
    row.name ||
    profile.display_name ||
    profile.username ||
    metadata.name ||
    "Membro autorizado";

  const role = row.role || row.member_role || metadata.role || "member";

  const roleLabels = {
    owner: "Dono",
    admin: "Administrador",
    manager: "Gestor",
    staff: "Staff",
    member: "Membro"
  };

  return {
    id: String(row.id || row.user_id || row.profile_id || name),
    userId: row.user_id || row.profile_id || row.profileId || "",
    name,
    role,
    roleLabel: roleLabels[String(role).toLowerCase()] || role,
    status: row.status || metadata.status || "active",
    avatarUrl: row.avatar_url || profile.avatar_url || metadata.avatarUrl || "",
    source: "supabase",
    raw: row
  };
}

function sbwGetDemoTournamentOrganizerMembers(organizer) {
  const slug = sbwNormalizeTournamentOrganizerKey(organizer?.slug || organizer?.id || organizer?.name);

  if (slug === "rinha-online") {
    return [
      {
        id: "demo-rinha-owner",
        name: "Gestor Rinha Online",
        role: "owner",
        roleLabel: "Dono",
        status: "active",
        source: "demo"
      },
      {
        id: "demo-rinha-admin",
        name: "Admin de torneios",
        role: "admin",
        roleLabel: "Administrador",
        status: "active",
        source: "demo"
      }
    ];
  }

  return [
    {
      id: "demo-sbw-owner",
      name: "Gestão -SBW-",
      role: "owner",
      roleLabel: "Dono",
      status: "active",
      source: "demo"
    },
    {
      id: "demo-sbw-admin",
      name: "Staff competitivo",
      role: "admin",
      roleLabel: "Administrador",
      status: "active",
      source: "demo"
    }
  ];
}

async function sbwGetSupabaseTournamentOrganizerMembers(organizer) {
  if (!sbwIsSupabaseEnabled() || !organizer) {
    return [];
  }

  const tableName = sbwGetTournamentOrganizerMembersTableName();
  const organizerKeys = sbwGetOrganizerMatchKeys(organizer);
  const id = organizer.raw?.id || organizer.id;
  const slug = organizer.raw?.slug || organizer.slug;

  try {
    let query = window.SBWSupabase.client.from(tableName).select("*");

    if (id) {
      query = query.eq("organizer_id", id);
    } else if (slug) {
      query = query.eq("organizer_slug", slug);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[SaberWolf Supabase] Erro ao buscar membros do organizador:", error);
      return [];
    }

    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .filter((row) => {
        const rowKeys = [
          row.organizer_id,
          row.tournament_organizer_id,
          row.organizer_slug,
          row.tournament_organizer_slug
        ]
          .filter(Boolean)
          .map(sbwNormalizeTournamentOrganizerKey);

        return rowKeys.length === 0 || rowKeys.some((key) => organizerKeys.includes(key));
      })
      .map(sbwNormalizeSupabaseTournamentOrganizerMember);
  } catch (error) {
    console.error("[SaberWolf Supabase] Falha inesperada ao buscar membros do organizador:", error);
    return [];
  }
}

async function sbwGetTournamentOrganizerMembersAsync(organizer) {
  const members = await sbwGetSupabaseTournamentOrganizerMembers(organizer);

  if (members.length > 0) {
    return members;
  }

  return sbwTournamentLocalDemoFallbackAllowed() ? sbwGetDemoTournamentOrganizerMembers(organizer) : [];
}

async function sbwGetTournamentsByOrganizerAsync(organizer) {
  const tournaments = await sbwGetAllTournamentsAsync();

  if (!organizer) {
    return [];
  }

  return tournaments.filter((tournament) => sbwTournamentBelongsToOrganizer(tournament, organizer));
}

function sbwFormatSupabaseDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("pt-BR");
}

function sbwFormatSupabaseTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}


function sbwLooksLikeSupabaseUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function sbwJoinDateAndTimeToISOString(dateValue, timeValue) {
  const date = String(dateValue || "").trim();
  const time = String(timeValue || "00:00").trim() || "00:00";

  if (!date) {
    return null;
  }

  const parsed = new Date(`${date}T${time}:00`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function sbwBuildSafeTournamentSlug(title, fallbackId) {
  const base = typeof sbwGenerateSlug === "function"
    ? sbwGenerateSlug(title || fallbackId || "torneio")
    : String(title || fallbackId || "torneio")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

  const suffix = String(Date.now()).slice(-6);
  return `${base || "torneio"}-${suffix}`;
}

function sbwNormalizeTournamentSlug(value) {
  const slug = typeof sbwGenerateSlug === "function"
    ? sbwGenerateSlug(value || "torneio")
    : String(value || "torneio")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

  return slug || "torneio";
}

function sbwBuildTournamentSlugCandidate(baseSlug, index) {
  const normalizedBase = sbwNormalizeTournamentSlug(baseSlug || "torneio");
  return index <= 1 ? normalizedBase : `${normalizedBase}-${index}`;
}

async function sbwDoesSupabaseTournamentSlugExist(slug, tableName) {
  if (!slug || !sbwIsSupabaseEnabled()) {
    return false;
  }

  try {
    const { data, error } = await window.SBWSupabase.client
      .from(tableName || sbwGetTournamentsTableName())
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      console.warn("[SaberWolf Supabase] Não foi possível verificar slug do torneio:", error);
      return false;
    }

    return Boolean(data?.id);
  } catch (error) {
    console.warn("[SaberWolf Supabase] Falha inesperada ao verificar slug do torneio:", error);
    return false;
  }
}

async function sbwBuildUniqueSupabaseTournamentSlug(baseSlug, tableName) {
  const normalizedBase = sbwNormalizeTournamentSlug(baseSlug || "torneio");

  for (let index = 1; index <= 50; index += 1) {
    const candidate = sbwBuildTournamentSlugCandidate(normalizedBase, index);
    const exists = await sbwDoesSupabaseTournamentSlugExist(candidate, tableName);

    if (!exists) {
      return candidate;
    }
  }

  return `${normalizedBase}-${Date.now()}`;
}

function sbwBuildUniqueLocalTournamentSlug(baseSlug) {
  const normalizedBase = sbwNormalizeTournamentSlug(baseSlug || "torneio");
  const usedSlugs = new Set(
    sbwGetSavedTournaments()
      .map((tournament) => String(tournament.slug || "").trim())
      .filter(Boolean)
  );

  for (let index = 1; index <= 50; index += 1) {
    const candidate = sbwBuildTournamentSlugCandidate(normalizedBase, index);

    if (!usedSlugs.has(candidate)) {
      return candidate;
    }
  }

  return `${normalizedBase}-${Date.now()}`;
}


function sbwIsTripleBracketTournamentFormat(format) {
  const normalized = String(format || "").trim().toLowerCase();
  return ["triple-bracket", "triple_bracket", "triple-bracket-8", "sistema-3-chaves", "sistema-de-3-chaves"].includes(normalized);
}

function sbwGetTripleBracketPayloadData(tournament = {}) {
  const settings = tournament.settings && typeof tournament.settings === "object" ? tournament.settings : {};
  const metadata = tournament.metadata && typeof tournament.metadata === "object" ? tournament.metadata : {};

  return (
    settings.tripleBracket ||
    settings.triple_bracket ||
    metadata.tripleBracket ||
    metadata.triple_bracket ||
    null
  );
}

function sbwBuildSupabaseTournamentPayload(tournament, options = {}) {
  const authUser = options.authUser || null;
  const profile = options.profile || null;
  const selectedOrganizer = options.organizer || tournament?.selectedOrganizer || null;
  const schedule = tournament?.schedule || {};
  const settings = tournament?.settings || {};
  const title = tournament?.title || tournament?.name || "Torneio -SBW-";
  const game = tournament?.game || tournament?.gameName || "Jogo não informado";
  const startsAt = sbwJoinDateAndTimeToISOString(
    schedule.startDate || tournament?.startDate || tournament?.date,
    schedule.startTime || tournament?.startTime || tournament?.time
  );
  const registrationOpensAt = sbwJoinDateAndTimeToISOString(
    schedule.registrationOpensDate || tournament?.registrationOpensDate || tournament?.registrationStartDate,
    schedule.registrationOpensTime || tournament?.registrationOpensTime || tournament?.registrationStartTime
  ) || tournament?.registrationOpensAt || tournament?.registration_opens_at || null;
  const registrationClosesAt = sbwJoinDateAndTimeToISOString(
    schedule.registrationClosesDate || tournament?.registrationClosesDate || tournament?.registrationEndDate,
    schedule.registrationClosesTime || tournament?.registrationClosesTime || tournament?.registrationEndTime
  ) || tournament?.registrationClosesAt || tournament?.registration_closes_at || null;
  const checkinStartsAt = sbwJoinDateAndTimeToISOString(
    schedule.checkinStartsDate || tournament?.checkinStartsDate || tournament?.checkInStartsDate,
    schedule.checkinStartsTime || tournament?.checkinStartsTime || tournament?.checkInStartsTime
  ) || tournament?.checkinStartsAt || tournament?.checkInStartsAt || tournament?.check_in_starts_at || null;
  const checkinEndsAt = sbwJoinDateAndTimeToISOString(
    schedule.checkinEndsDate || tournament?.checkinEndsDate || tournament?.checkInEndsDate,
    schedule.checkinEndsTime || tournament?.checkinEndsTime || tournament?.checkInEndsTime
  ) || tournament?.checkinEndsAt || tournament?.checkInEndsAt || tournament?.check_in_ends_at || null;

  const organizerId = selectedOrganizer?.id || tournament?.organizerId || tournament?.organizer?.id || "";
  const organizerSlug = selectedOrganizer?.slug || tournament?.organizerSlug || tournament?.organizer?.slug || "";
  const organizerName = selectedOrganizer?.name || selectedOrganizer?.displayName || tournament?.organizerName || tournament?.organizer?.name || tournament?.organizer || "SaberWolf";
  const slug = sbwNormalizeTournamentSlug(tournament?.slug || title || tournament?.id);
  const formatValue = tournament?.format || settings.formatKey || "double-elimination";
  const isTripleBracket = sbwIsTripleBracketTournamentFormat(formatValue);
  const tripleBracketData = sbwGetTripleBracketPayloadData(tournament);

  const normalizedStatus = String(tournament?.status || "draft").trim() || "draft";

  const payload = {
    slug,
    title,
    description: tournament?.description || "",
    rules: tournament?.rules || "",
    prize_text: tournament?.prize || tournament?.prizeText || "",

    game_id: typeof sbwGenerateSlug === "function" ? sbwGenerateSlug(game) : sbwNormalizeTournamentOrganizerKey(game),
    game_name: game,
    platform: tournament?.platform || "crossplay",
    format: isTripleBracket ? "triple-bracket" : formatValue,
    status: normalizedStatus,
    visibility: tournament?.visibility || "public",

    tournament_organizer_id: sbwLooksLikeSupabaseUuid(organizerId) ? organizerId : null,
    organizer_id: sbwLooksLikeSupabaseUuid(organizerId) ? organizerId : null,
    organizer_slug: String(organizerSlug || ""),
    organizer_name: String(organizerName || "SaberWolf"),

    max_participants: isTripleBracket ? 8 : (Number(tournament?.maxParticipants || settings.maxPlayers || tournament?.limit || 0) || null),
    current_participants: Array.isArray(tournament?.participants) ? tournament.participants.length : 0,

    starts_at: startsAt,
    checkin_starts_at: checkinStartsAt,
    checkin_ends_at: checkinEndsAt,
    registration_opens_at: registrationOpensAt || (normalizedStatus === "registration-open" ? new Date().toISOString() : null),
    registration_closes_at: registrationClosesAt,
    ends_at: null,
    cover_url: tournament?.coverUrl || "",

    settings: {
      ...settings,
      ...(isTripleBracket ? {
        maxPlayers: 8,
        maxParticipants: 8,
        participantCapacityUnit: "teams",
        capacityUnit: "teams",
        formatKey: "triple-bracket",
        schemaVersion: "triplebracket.v1",
        tripleBracket: tripleBracketData,
        triple_bracket: tripleBracketData
      } : {}),
      matchFormat: settings.matchFormat || tournament?.matchFormat || "",
      schedule: {
        startDate: schedule.startDate || tournament?.startDate || "",
        startTime: schedule.startTime || tournament?.startTime || "",
        checkin: schedule.checkin || tournament?.checkin || "",
        registrationOpensAt: registrationOpensAt || "",
        registrationClosesAt: registrationClosesAt || "",
        checkinStartsAt: checkinStartsAt || "",
        checkinEndsAt: checkinEndsAt || ""
      }
    },

    metadata: {
      ...(tournament?.metadata || {}),
      source: "site-admin",
      localId: tournament?.id || "",
      ...(isTripleBracket ? {
        formatKey: "triple-bracket",
        schemaVersion: "triplebracket.v1",
        tripleBracket: tripleBracketData,
        triple_bracket: tripleBracketData
      } : {}),
      formatLabel: tournament?.formatLabel || "",
      createdFrom: window.location.pathname + window.location.search,
      organizer: selectedOrganizer ? {
        id: selectedOrganizer.id || "",
        slug: selectedOrganizer.slug || "",
        name: selectedOrganizer.name || selectedOrganizer.displayName || "",
        source: selectedOrganizer.source || ""
      } : null,
      createdBy: {
        authUserId: authUser?.id || "",
        profileId: profile?.id || "",
        name: profile?.display_name || profile?.nickname || profile?.username || authUser?.email || ""
      }
    },

    created_by_auth_user_id: authUser?.id || null,
    created_by_profile_id: profile?.id || null
  };

  return payload;
}

function sbwNormalizeSupabaseTournament(row) {
  const settings = row.settings && typeof row.settings === "object"
    ? row.settings
    : {};

  const metadata = row.metadata && typeof row.metadata === "object"
    ? row.metadata
    : {};

  return {
    id: row.slug || row.id,
    supabaseId: row.id,

    slug: row.slug,
    title: row.title,
    name: row.title,

    gameId: row.game_id,
    game: row.game_name || row.game_id || "Jogo não informado",
    gameName: row.game_name || row.game_id || "Jogo não informado",

    platform: row.platform || "Plataforma não informada",
    format: row.format || "single_elimination",

    status: row.status || "draft",
    visibility: row.visibility || "public",

    description: row.description || "",
    rules: row.rules || "",
    prize: row.prize_text || "",
    prizeText: row.prize_text || "",

    organizer: row.organizer_name || metadata.organizerName || metadata.organizer_name || "SaberWolf",
    organizerName: row.organizer_name || metadata.organizerName || metadata.organizer_name || "SaberWolf",
    organizerId:
      row.organizer_id ||
      row.tournament_organizer_id ||
      metadata.organizerId ||
      metadata.organizer_id ||
      "",
    organizerSlug:
      row.organizer_slug ||
      metadata.organizerSlug ||
      metadata.organizer_slug ||
      "",

    maxParticipants: Number(row.max_participants || 0),
    currentParticipants: Number(row.current_participants || 0),
    participantsCount: Number(row.current_participants || 0),
    participants: Array.from({ length: Number(row.current_participants || 0) }, (_, index) => ({
      id: `supabase-participant-count-${index + 1}`,
      name: `Inscrito ${index + 1}`,
      source: "supabase-count"
    })),

    structure: settings.structure || metadata.structure || null,
    matches: Array.isArray(settings.matches) ? settings.matches : (Array.isArray(metadata.matches) ? metadata.matches : []),
    standings: Array.isArray(settings.standings) ? settings.standings : (Array.isArray(metadata.standings) ? metadata.standings : []),

    registrationOpensAt: row.registration_opens_at || "",
    registrationClosesAt: row.registration_closes_at || "",
    checkinStartsAt: row.checkin_starts_at || "",
    checkInStartsAt: row.checkin_starts_at || "",
    checkinEndsAt: row.checkin_ends_at || "",
    checkInEndsAt: row.checkin_ends_at || "",
    startsAt: row.starts_at || "",
    endsAt: row.ends_at || "",

    date: sbwFormatSupabaseDate(row.starts_at),
    time: sbwFormatSupabaseTime(row.starts_at),
    startDate: sbwFormatSupabaseDate(row.starts_at),
    startTime: sbwFormatSupabaseTime(row.starts_at),

    coverUrl: row.cover_url || "",

    settings,
    metadata,

    createdByAuthUserId: row.created_by_auth_user_id || metadata.createdByAuthUserId || metadata.created_by_auth_user_id || "",
    createdByProfileId: row.created_by_profile_id || metadata.createdByProfileId || metadata.created_by_profile_id || "",
    raw: row,

    source: "supabase"
  };
}

async function sbwGetSupabaseTournaments() {
  if (!sbwIsSupabaseEnabled()) {
    return [];
  }

  const tableName = sbwGetTournamentsTableName();

  try {
    const { data, error } = await window.SBWSupabase.client
      .from(tableName)
      .select("*")
      .order("starts_at", {
        ascending: true,
        nullsFirst: false
      });

    if (error) {
      console.error("[SaberWolf Supabase] Erro ao buscar torneios:", error);
      return [];
    }

    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map(sbwNormalizeSupabaseTournament)
      .filter(sbwIsTournamentPubliclyVisible);
  } catch (error) {
    console.error("[SaberWolf Supabase] Falha inesperada ao buscar torneios:", error);
    return [];
  }
}

function sbwGetDemoTournaments() {
  if (typeof SBW_DEMO_TOURNAMENTS === "undefined") {
    return [];
  }

  return SBW_DEMO_TOURNAMENTS.map((tournament) => ({
    ...tournament,
    source: "demo"
  }));
}

function sbwGetSavedTournaments() {
  const config = sbwGetStorageConfig();
  const data = localStorage.getItem(config.storageKey);

  if (!data) {
    return [];
  }

  try {
    const parsed = JSON.parse(data);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((tournament) => ({
      ...tournament,
      source: "local"
    }));
  } catch (error) {
    console.error("Erro ao ler torneios salvos:", error);
    return [];
  }
}

function sbwSaveTournaments(tournaments) {
  const config = sbwGetStorageConfig();

  const cleanTournaments = Array.isArray(tournaments)
    ? tournaments.map((tournament) => {
      const copy = { ...tournament };
      delete copy.source;
      return copy;
    })
    : [];

  localStorage.setItem(config.storageKey, JSON.stringify(cleanTournaments));
}

function sbwGetLocalTournaments() {
  const saved = sbwFilterPublicTournaments(sbwGetSavedTournaments());

  if (!sbwTournamentLocalDemoFallbackAllowed()) {
    return saved;
  }

  return sbwFilterPublicTournaments([
    ...saved,
    ...sbwGetDemoTournaments()
  ]);
}

function sbwGetTournamentDatabaseId(tournament) {
  if (!tournament) {
    return "";
  }

  return String(
    tournament.raw?.id ||
    tournament.supabaseId ||
    tournament.tournamentId ||
    tournament.id ||
    tournament.slug ||
    ""
  );
}

function sbwGetTournamentPublicId(tournament) {
  if (!tournament) {
    return "";
  }

  return String(tournament.slug || tournament.id || tournament.supabaseId || "");
}

function sbwGetTournamentMetadata(tournament) {
  const metadata = tournament?.metadata;
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
}

function sbwNormalizeTournamentStatusValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
}

function sbwIsTournamentAdminArchivedOrDeleted(tournament) {
  const metadata = sbwGetTournamentMetadata(tournament);
  const raw = tournament?.raw || {};
  const rawMetadata = raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
    ? raw.metadata
    : {};
  const status = sbwNormalizeTournamentStatusValue(tournament?.status || raw.status);
  const visibility = sbwNormalizeTournamentStatusValue(tournament?.visibility || raw.visibility);

  return Boolean(
    metadata.adminDeleted === true ||
    metadata.adminArchived === true ||
    metadata.deleted === true ||
    metadata.archived === true ||
    rawMetadata.adminDeleted === true ||
    rawMetadata.adminArchived === true ||
    rawMetadata.deleted === true ||
    rawMetadata.archived === true ||
    status === "deleted" ||
    status === "removed" ||
    status === "archived" ||
    status === "hidden" ||
    visibility === "private" ||
    visibility === "hidden"
  );
}

function sbwIsTournamentPubliclyVisible(tournament) {
  if (!tournament || sbwIsTournamentAdminArchivedOrDeleted(tournament)) {
    return false;
  }

  const status = sbwNormalizeTournamentStatusValue(tournament.status);
  const visibility = sbwNormalizeTournamentStatusValue(tournament.visibility || "public");

  if (["draft", "cancelled", "canceled", "rejected", "blocked"].includes(status)) {
    return false;
  }

  if (visibility && visibility !== "public") {
    return false;
  }

  return true;
}

function sbwFilterPublicTournaments(tournaments) {
  return Array.isArray(tournaments)
    ? tournaments.filter(sbwIsTournamentPubliclyVisible)
    : [];
}

function sbwGetTournamentName(tournament) {
  return String(tournament?.name || tournament?.title || "Torneio");
}

function sbwAsCleanString(value) {
  return String(value || "").trim();
}

function sbwNormalizeParticipantLookupValue(value) {
  return sbwAsCleanString(value).toLowerCase();
}

function sbwGetSupabaseParticipantProfileKeys(row = {}) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return [
    row.profile_id,
    row.profile_slug,
    row.player_slug,
    row.username,
    row.slug,
    metadata.profileId,
    metadata.profile_id,
    metadata.profileSlug,
    metadata.profile_slug,
    metadata.playerSlug,
    metadata.player_slug
  ]
    .map(sbwAsCleanString)
    .filter(Boolean);
}

function sbwGetSupabaseParticipantAuthKey(row = {}) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return sbwAsCleanString(row.auth_user_id || row.user_id || metadata.authUserId || metadata.auth_user_id || metadata.userId || metadata.user_id);
}

function sbwGetSupabaseTeamTag(team = {}, member = {}) {
  const teamMeta = team.metadata && typeof team.metadata === "object" ? team.metadata : {};
  const memberMeta = member.metadata && typeof member.metadata === "object" ? member.metadata : {};

  return sbwAsCleanString(
    team.tag ||
    team.team_tag ||
    team.teamTag ||
    team.acronym ||
    team.short_name ||
    team.shortName ||
    team.abbr ||
    team.code ||
    teamMeta.tag ||
    teamMeta.teamTag ||
    teamMeta.team_tag ||
    member.team_tag ||
    member.teamTag ||
    member.team_acronym ||
    member.teamAcronym ||
    memberMeta.teamTag ||
    memberMeta.team_tag
  );
}

function sbwGetSupabaseTeamName(team = {}, member = {}) {
  const teamMeta = team.metadata && typeof team.metadata === "object" ? team.metadata : {};
  const memberMeta = member.metadata && typeof member.metadata === "object" ? member.metadata : {};

  return sbwAsCleanString(
    team.name ||
    team.display_name ||
    team.displayName ||
    team.team_name ||
    team.teamName ||
    team.title ||
    teamMeta.name ||
    teamMeta.teamName ||
    teamMeta.team_name ||
    member.team_name ||
    member.teamName ||
    memberMeta.teamName ||
    memberMeta.team_name
  );
}

function sbwMapActiveTeamMember(member = {}, teamsMap = new Map()) {
  const teamSlug = sbwAsCleanString(member.team_slug || member.teamSlug || member.team_id || member.teamId);
  const team = teamsMap.get(teamSlug) || {};
  const tag = sbwGetSupabaseTeamTag(team, member);
  const name = sbwGetSupabaseTeamName(team, member);

  return {
    member,
    team,
    teamSlug,
    tag,
    name
  };
}

function sbwIndexTeamMemberForParticipant(index, member = {}, teamInfo) {
  const metadata = member.metadata && typeof member.metadata === "object" ? member.metadata : {};
  const keys = [
    member.auth_user_id,
    member.user_id,
    member.profile_slug,
    member.profile_id,
    member.user_slug,
    member.player_slug,
    metadata.authUserId,
    metadata.auth_user_id,
    metadata.profileSlug,
    metadata.profile_slug,
    metadata.profileId,
    metadata.profile_id
  ];

  keys
    .map(sbwNormalizeParticipantLookupValue)
    .filter(Boolean)
    .forEach((key) => {
      if (!index.has(key)) {
        index.set(key, teamInfo);
      }
    });
}

async function sbwSelectActiveTournamentTeamMembers(column, values) {
  const cleanValues = Array.from(new Set((values || []).map(sbwAsCleanString).filter(Boolean)));

  if (!cleanValues.length || !sbwIsSupabaseEnabled()) {
    return [];
  }

  try {
    const result = await window.SBWSupabase.client
      .from(sbwGetTeamMembersTableName())
      .select("*")
      .in(column, cleanValues)
      .eq("status", "active")
      .order("joined_at", { ascending: false });

    if (result.error) {
      console.warn(`[SaberWolf Supabase] Não foi possível buscar team_members por ${column}:`, result.error);
      return [];
    }

    return Array.isArray(result.data) ? result.data : [];
  } catch (error) {
    console.warn(`[SaberWolf Supabase] Falha inesperada ao buscar team_members por ${column}:`, error);
    return [];
  }
}

async function sbwEnrichTournamentParticipantsWithTeamTags(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];

  if (!safeRows.length || !sbwIsSupabaseEnabled()) {
    return safeRows;
  }

  const authKeys = [];
  const profileKeys = [];

  safeRows.forEach((row) => {
    const authKey = sbwGetSupabaseParticipantAuthKey(row);

    if (authKey) {
      authKeys.push(authKey);
    }

    profileKeys.push(...sbwGetSupabaseParticipantProfileKeys(row));
  });

  if (!authKeys.length && !profileKeys.length) {
    return safeRows;
  }

  const memberRows = [];
  const seenMembers = new Set();

  const appendMembers = (rowsToAppend) => {
    (Array.isArray(rowsToAppend) ? rowsToAppend : []).forEach((member) => {
      const key = sbwAsCleanString(member.id || `${member.auth_user_id || ""}:${member.profile_slug || ""}:${member.team_slug || ""}`);

      if (!key || seenMembers.has(key)) {
        return;
      }

      seenMembers.add(key);
      memberRows.push(member);
    });
  };

  appendMembers(await sbwSelectActiveTournamentTeamMembers("auth_user_id", authKeys));
  appendMembers(await sbwSelectActiveTournamentTeamMembers("profile_slug", profileKeys));

  if (!memberRows.length) {
    return safeRows;
  }

  const teamSlugs = Array.from(
    new Set(
      memberRows
        .map((member) => sbwAsCleanString(member.team_slug || member.teamSlug || member.team_id || member.teamId))
        .filter(Boolean)
    )
  );

  const teamsMap = new Map();

  if (teamSlugs.length) {
    try {
      const teamsResult = await window.SBWSupabase.client
        .from(sbwGetTeamsTableName())
        .select("*")
        .in("slug", teamSlugs);

      if (teamsResult.error) {
        console.warn("[SaberWolf Supabase] Não foi possível buscar teams para exibir tag dos participantes:", teamsResult.error);
      } else if (Array.isArray(teamsResult.data)) {
        teamsResult.data.forEach((team) => {
          const key = sbwAsCleanString(team.slug || team.id);

          if (key) {
            teamsMap.set(key, team);
          }
        });
      }
    } catch (error) {
      console.warn("[SaberWolf Supabase] Falha inesperada ao buscar teams dos participantes:", error);
    }
  }

  const teamIndex = new Map();

  memberRows.forEach((member) => {
    const teamInfo = sbwMapActiveTeamMember(member, teamsMap);

    if (!teamInfo.tag && !teamInfo.name) {
      return;
    }

    sbwIndexTeamMemberForParticipant(teamIndex, member, teamInfo);
  });

  if (!teamIndex.size) {
    return safeRows;
  }

  return safeRows.map((row) => {
    const lookupKeys = [
      sbwGetSupabaseParticipantAuthKey(row),
      ...sbwGetSupabaseParticipantProfileKeys(row)
    ]
      .map(sbwNormalizeParticipantLookupValue)
      .filter(Boolean);

    const teamInfo = lookupKeys.map((key) => teamIndex.get(key)).find(Boolean);

    if (!teamInfo) {
      return row;
    }

    const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
    const teamName = teamInfo.name || row.team_name || metadata.teamName || metadata.team_name || "";
    const teamTag = teamInfo.tag || row.team_tag || metadata.teamTag || metadata.team_tag || "";

    return Object.assign({}, row, {
      team_name: teamName || row.team_name,
      team_tag: teamTag || row.team_tag,
      team: Object.assign({}, teamInfo.team || {}, {
        slug: teamInfo.teamSlug || teamInfo.team?.slug || "",
        name: teamName || teamInfo.team?.name || "",
        tag: teamTag || teamInfo.team?.tag || ""
      }),
      metadata: Object.assign({}, metadata, {
        teamName: teamName || metadata.teamName || metadata.team_name || "",
        team_name: teamName || metadata.team_name || metadata.teamName || "",
        teamTag: teamTag || metadata.teamTag || metadata.team_tag || "",
        team_tag: teamTag || metadata.team_tag || metadata.teamTag || ""
      })
    });
  });
}

function sbwNormalizeSupabaseTournamentParticipant(row = {}) {
  const profile = row.profile && typeof row.profile === "object"
    ? row.profile
    : {};

  const metadata = row.metadata && typeof row.metadata === "object"
    ? row.metadata
    : {};

  const name =
    row.player_name ||
    row.display_name ||
    row.nickname ||
    profile.display_name ||
    profile.nickname ||
    profile.username ||
    metadata.playerName ||
    metadata.displayName ||
    "Jogador";

  const teamTag = row.team_tag || row.teamTag || metadata.teamTag || metadata.team_tag || profile.team_tag || "";
  const teamName = row.team_name || metadata.teamName || metadata.team_name || profile.team_name || "Sem equipe";

  return {
    id: String(row.id || row.profile_id || row.auth_user_id || name),
    participantId: row.id || "",
    tournamentId: row.tournament_id || "",
    authUserId: row.auth_user_id || "",
    profileId: row.profile_id || "",
    name,
    nickname: name,
    displayName: name,
    playerName: name,
    playerSlug: row.player_slug || profile.slug || profile.username || "",
    team: teamName,
    teamName,
    teamTag,
    team_tag: teamTag,
    status: row.status || "registered",
    checkedIn: ["checked_in", "checked-in", "confirmed"].includes(String(row.check_in_status || row.checked_in || "").toLowerCase()),
    checkInStatus: row.check_in_status || "pending",
    checkedInAt: row.checked_in_at || row.checkedInAt || "",
    seed: row.seed || null,
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
    source: "supabase",
    raw: row
  };
}

function sbwGetTournamentRegistrationLookupKeys(tournament) {
  const keys = [];
  const databaseId = sbwGetTournamentDatabaseId(tournament);
  const publicId = sbwGetTournamentPublicId(tournament);

  [databaseId, publicId].forEach((value) => {
    const key = String(value || "").trim();

    if (key && !keys.includes(key)) {
      keys.push(key);
    }
  });

  return keys;
}

function sbwDeduplicateSupabaseParticipants(rows) {
  const seen = new Set();
  const uniqueRows = [];

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = String(row?.id || `${row?.tournament_id || ""}:${row?.auth_user_id || ""}:${row?.profile_id || ""}`);

    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    uniqueRows.push(row);
  });

  return uniqueRows;
}

async function sbwGetSupabaseTournamentParticipants(tournament) {
  if (!sbwIsSupabaseEnabled() || !tournament) {
    return [];
  }

  const lookupKeys = sbwGetTournamentRegistrationLookupKeys(tournament);

  if (lookupKeys.length === 0) {
    return [];
  }

  const tableName = sbwGetTournamentParticipantsTableName();
  const allRows = [];

  try {
    for (const key of lookupKeys) {
      const byTournamentId = await window.SBWSupabase.client
        .from(tableName)
        .select(SBW_TOURNAMENT_PARTICIPANT_SELECT_COLUMNS)
        .eq("tournament_id", key)
        .in("status", ["registered", "waitlist"])
        .order("created_at", { ascending: true });

      if (byTournamentId.error) {
        console.warn("[SaberWolf Supabase] Não foi possível buscar participantes por tournament_id:", byTournamentId.error);
      } else if (Array.isArray(byTournamentId.data)) {
        allRows.push(...byTournamentId.data);
      }

      const byTournamentSlug = await window.SBWSupabase.client
        .from(tableName)
        .select(SBW_TOURNAMENT_PARTICIPANT_SELECT_COLUMNS)
        .eq("tournament_slug", key)
        .in("status", ["registered", "waitlist"])
        .order("created_at", { ascending: true });

      if (byTournamentSlug.error) {
        console.warn("[SaberWolf Supabase] Não foi possível buscar participantes por tournament_slug:", byTournamentSlug.error);
      } else if (Array.isArray(byTournamentSlug.data)) {
        allRows.push(...byTournamentSlug.data);
      }
    }

    const deduplicatedRows = sbwDeduplicateSupabaseParticipants(allRows);
    const enrichedRows = await sbwEnrichTournamentParticipantsWithTeamTags(deduplicatedRows);

    return enrichedRows.map(sbwNormalizeSupabaseTournamentParticipant);
  } catch (error) {
    console.warn("[SaberWolf Supabase] Falha inesperada ao buscar participantes:", error);
    return [];
  }
}

async function sbwGetCurrentTournamentRegistrationAsync(tournament, authUser) {
  if (!sbwIsSupabaseEnabled() || !tournament || !authUser?.id) {
    return null;
  }

  const lookupKeys = sbwGetTournamentRegistrationLookupKeys(tournament);

  if (lookupKeys.length === 0) {
    return null;
  }

  const tableName = sbwGetTournamentParticipantsTableName();

  try {
    for (const key of lookupKeys) {
      const byTournamentId = await window.SBWSupabase.client
        .from(tableName)
        .select("*")
        .eq("tournament_id", key)
        .eq("auth_user_id", authUser.id)
        .in("status", ["registered", "waitlist"])
        .order("created_at", { ascending: false })
        .limit(1);

      if (byTournamentId.error) {
        console.warn("[SaberWolf Supabase] Não foi possível verificar inscrição por tournament_id:", byTournamentId.error);
      } else if (Array.isArray(byTournamentId.data) && byTournamentId.data[0]) {
        return sbwNormalizeSupabaseTournamentParticipant(byTournamentId.data[0]);
      }

      const byTournamentSlug = await window.SBWSupabase.client
        .from(tableName)
        .select("*")
        .eq("tournament_slug", key)
        .eq("auth_user_id", authUser.id)
        .in("status", ["registered", "waitlist"])
        .order("created_at", { ascending: false })
        .limit(1);

      if (byTournamentSlug.error) {
        console.warn("[SaberWolf Supabase] Não foi possível verificar inscrição por tournament_slug:", byTournamentSlug.error);
      } else if (Array.isArray(byTournamentSlug.data) && byTournamentSlug.data[0]) {
        return sbwNormalizeSupabaseTournamentParticipant(byTournamentSlug.data[0]);
      }
    }

    return null;
  } catch (error) {
    console.warn("[SaberWolf Supabase] Falha inesperada ao verificar inscrição:", error);
    return null;
  }
}

async function sbwCreateTournamentRegistrationAsync(tournament, options = {}) {
  if (!sbwIsSupabaseEnabled()) {
    return {
      success: false,
      message: "Supabase não está ativo para inscrições reais."
    };
  }

  if (!tournament) {
    return {
      success: false,
      message: "Torneio não encontrado."
    };
  }

  const authUser = options.authUser || null;
  const profile = options.profile || null;

  if (!authUser?.id) {
    return {
      success: false,
      requiresLogin: true,
      message: "Você precisa entrar com sua conta -SBW- para se inscrever."
    };
  }

  const tournamentId = sbwGetTournamentDatabaseId(tournament) || sbwGetTournamentPublicId(tournament);

  if (!tournamentId) {
    return {
      success: false,
      message: "Este torneio ainda não possui ID válido para inscrição."
    };
  }

  try {
    const { data, error } = await window.SBWSupabase.client.rpc("sbw_register_tournament_participant", {
      p_tournament: tournamentId,
      p_payload: {
        profile_id: profile?.id || null,
        player_name:
          profile?.display_name ||
          profile?.nickname ||
          profile?.username ||
          authUser.user_metadata?.display_name ||
          authUser.email?.split("@")[0] ||
          "Jogador -SBW-",
        player_slug: profile?.slug || profile?.username || "",
        allow_waitlist: true,
        metadata: {
          source: "site-public-registration",
          tournamentSource: tournament.source || "unknown",
          game: tournament.game || tournament.gameName || "",
          platform: tournament.platform || "",
          organizerId: tournament.organizerId || "",
          organizerSlug: tournament.organizerSlug || "",
          organizerName: tournament.organizerName || tournament.organizer || "",
          registeredFrom: window.location.pathname + window.location.search
        }
      }
    });

    if (error) {
      console.error("[SaberWolf Supabase] Erro ao registrar inscrição via RPC:", error);
      return {
        success: false,
        message: error.message || "Não foi possível registrar a inscrição no Supabase.",
        error
      };
    }

    const result = data && typeof data === "object" ? data : {};
    const row = result.participant || result.row || result.data || null;

    return {
      success: result.ok !== false,
      alreadyRegistered: result.alreadyRegistered === true || result.already_registered === true,
      message: result.message || "Inscrição realizada com sucesso.",
      registration: row ? sbwNormalizeSupabaseTournamentParticipant(row) : null,
      stats: result.stats || {},
      raw: data
    };
  } catch (error) {
    console.error("[SaberWolf Supabase] Falha inesperada ao registrar inscrição via RPC:", error);
    return {
      success: false,
      message: "Erro inesperado ao salvar inscrição no Supabase.",
      error
    };
  }
}

async function sbwCheckInTournamentParticipantAsync(tournament, options = {}) {
  if (!sbwIsSupabaseEnabled()) {
    return {
      success: false,
      message: "Supabase não está ativo para check-in real."
    };
  }

  if (!tournament) {
    return {
      success: false,
      message: "Torneio não encontrado."
    };
  }

  const authUser = options.authUser || null;

  if (!authUser?.id) {
    return {
      success: false,
      requiresLogin: true,
      message: "Você precisa entrar com sua conta -SBW- para fazer check-in."
    };
  }

  const tournamentId = sbwGetTournamentDatabaseId(tournament) || sbwGetTournamentPublicId(tournament);

  if (!tournamentId) {
    return {
      success: false,
      message: "Este torneio ainda não possui ID válido para check-in."
    };
  }

  try {
    const { data, error } = await window.SBWSupabase.client.rpc("sbw_check_in_tournament_participant", {
      p_tournament: tournamentId,
      p_payload: {
        source: "site-public-checkin",
        checkedInFrom: window.location.pathname + window.location.search
      }
    });

    if (error) {
      console.error("[SaberWolf Supabase] Erro ao confirmar check-in via RPC:", error);
      return {
        success: false,
        message: error.message || "Não foi possível confirmar o check-in.",
        error
      };
    }

    const result = data && typeof data === "object" ? data : {};
    const row = result.participant || result.row || result.data || null;

    return {
      success: result.ok !== false,
      alreadyCheckedIn: result.alreadyCheckedIn === true || result.already_checked_in === true,
      message: result.message || "Check-in confirmado.",
      registration: row ? sbwNormalizeSupabaseTournamentParticipant(row) : null,
      participant: row ? sbwNormalizeSupabaseTournamentParticipant(row) : null,
      stats: result.stats || {},
      raw: data
    };
  } catch (error) {
    console.error("[SaberWolf Supabase] Falha inesperada ao confirmar check-in via RPC:", error);
    return {
      success: false,
      message: "Erro inesperado ao confirmar check-in.",
      error
    };
  }
}


function sbwNormalizeParticipantCheckInStatus(value) {
  const normalized = String(value || "").trim().toLowerCase().replaceAll("-", "_");

  if (["checked", "checked_in", "confirmed", "confirmado"].includes(normalized)) {
    return "checked_in";
  }

  if (["missed", "ausente", "no_show", "no-show"].includes(normalized)) {
    return "missed";
  }

  if (["waived", "dispensado", "sem_checkin", "sem-checkin"].includes(normalized)) {
    return "waived";
  }

  return "pending";
}

function sbwNormalizeParticipantStatus(value) {
  const normalized = String(value || "").trim().toLowerCase().replaceAll("-", "_");

  if (["waitlist", "lista_espera", "lista-de-espera"].includes(normalized)) {
    return "waitlist";
  }

  if (["cancelled", "canceled", "cancelado"].includes(normalized)) {
    return "cancelled";
  }

  if (["removed", "removido"].includes(normalized)) {
    return "removed";
  }

  if (["disqualified", "desclassificado"].includes(normalized)) {
    return "disqualified";
  }

  return "registered";
}

async function sbwUpdateSupabaseTournamentParticipantAsync(participant, updates = {}) {
  if (!sbwIsSupabaseEnabled()) {
    return {
      success: false,
      message: "Supabase não está ativo para gestão de inscrições."
    };
  }

  const participantId = String(participant?.participantId || participant?.id || participant?.raw?.id || "").trim();

  if (!participantId) {
    return {
      success: false,
      message: "Inscrição inválida para atualização."
    };
  }

  const payload = {};

  if (Object.prototype.hasOwnProperty.call(updates, "checkInStatus")) {
    payload.check_in_status = sbwNormalizeParticipantCheckInStatus(updates.checkInStatus);
  }

  if (Object.prototype.hasOwnProperty.call(updates, "check_in_status")) {
    payload.check_in_status = sbwNormalizeParticipantCheckInStatus(updates.check_in_status);
  }

  if (Object.prototype.hasOwnProperty.call(updates, "status")) {
    payload.status = sbwNormalizeParticipantStatus(updates.status);
  }

  if (Object.prototype.hasOwnProperty.call(updates, "seed")) {
    const seed = Number(updates.seed);
    payload.seed = Number.isInteger(seed) && seed > 0 ? seed : null;
  }

  if (Object.keys(payload).length === 0) {
    return {
      success: false,
      message: "Nenhuma alteração enviada para a inscrição."
    };
  }

  const tableName = sbwGetTournamentParticipantsTableName();

  try {
    const { data, error } = await window.SBWSupabase.client
      .from(tableName)
      .update(payload)
      .eq("id", participantId)
      .select("*")
      .single();

    if (error) {
      const isRlsError =
        error?.code === "42501" ||
        String(error?.message || "").toLowerCase().includes("row-level security") ||
        String(error?.message || "").toLowerCase().includes("permission");

      console.error("[SaberWolf Supabase] Erro ao atualizar inscrição:", error);

      return {
        success: false,
        message: isRlsError
          ? "O Supabase bloqueou esta ação por RLS. Rode o SQL da v1.5.8.4 e confirme se você é o criador/gestor deste torneio."
          : (error.message || "Não foi possível atualizar a inscrição."),
        error
      };
    }

    return {
      success: true,
      message: "Inscrição atualizada.",
      participant: sbwNormalizeSupabaseTournamentParticipant(data),
      raw: data
    };
  } catch (error) {
    console.error("[SaberWolf Supabase] Falha inesperada ao atualizar inscrição:", error);
    return {
      success: false,
      message: "Erro inesperado ao atualizar inscrição no Supabase.",
      error
    };
  }
}

async function sbwSetSupabaseTournamentParticipantCheckInAsync(participant, checkedIn) {
  return await sbwUpdateSupabaseTournamentParticipantAsync(participant, {
    checkInStatus: checkedIn ? "checked_in" : "pending"
  });
}

async function sbwRemoveSupabaseTournamentParticipantAsync(participant) {
  return await sbwUpdateSupabaseTournamentParticipantAsync(participant, {
    status: "removed",
    checkInStatus: "missed"
  });
}


async function sbwGetTournamentParticipantsForOrganizerAsync(options = {}) {
  if (!sbwIsSupabaseEnabled()) {
    return {
      success: false,
      participants: [],
      message: "Supabase não está ativo para gestão de inscritos."
    };
  }

  const organizerKey = String(options?.organizer || options?.organizerSlug || options?.organizerId || "").trim();
  const tournamentKey = String(options?.tournament || options?.tournamentId || options?.id || "").trim();

  if (!organizerKey) {
    throw new Error("Organizador não informado para carregar inscritos.");
  }

  if (!tournamentKey) {
    throw new Error("Torneio não informado para carregar inscritos.");
  }

  try {
    const { data, error } = await window.SBWSupabase.client.rpc("sbw_get_tournament_participants_for_organizer", {
      p_organizer: organizerKey,
      p_tournament: tournamentKey
    });

    if (error) {
      console.error("[SaberWolf Supabase] Erro ao buscar inscritos do torneio para o organizador:", error);
      throw error;
    }

    const result = data && typeof data === "object" ? data : {};
    const rows = Array.isArray(result.participants) ? result.participants : [];

    return {
      success: result.ok !== false,
      message: result.message || "Inscritos carregados.",
      participants: rows.map(sbwNormalizeSupabaseTournamentParticipant),
      stats: result.stats || {},
      tournament: result.tournament || null,
      raw: data
    };
  } catch (error) {
    console.error("[SaberWolf Supabase] Falha ao carregar inscritos do organizador:", error);
    throw error;
  }
}

async function sbwUpdateTournamentParticipantForOrganizerAsync(options = {}) {
  if (!sbwIsSupabaseEnabled()) {
    return {
      success: false,
      message: "Supabase não está ativo para atualizar inscritos."
    };
  }

  const organizerKey = String(options?.organizer || options?.organizerSlug || options?.organizerId || "").trim();
  const tournamentKey = String(options?.tournament || options?.tournamentId || options?.id || "").trim();
  const participantId = String(options?.participantId || options?.participant || "").trim();
  const payload = options?.payload && typeof options.payload === "object" ? options.payload : {};

  if (!organizerKey) {
    throw new Error("Organizador não informado para atualizar inscrição.");
  }

  if (!tournamentKey) {
    throw new Error("Torneio não informado para atualizar inscrição.");
  }

  if (!participantId) {
    throw new Error("Inscrição não informada para atualização.");
  }

  try {
    const { data, error } = await window.SBWSupabase.client.rpc("sbw_update_tournament_participant_for_organizer", {
      p_organizer: organizerKey,
      p_tournament: tournamentKey,
      p_participant: participantId,
      p_payload: payload
    });

    if (error) {
      console.error("[SaberWolf Supabase] Erro ao atualizar inscrito pelo organizador:", error);
      throw error;
    }

    const result = data && typeof data === "object" ? data : {};
    const row = result.participant || result.row || result.data || null;

    return {
      success: result.ok !== false,
      message: result.message || "Inscrição atualizada.",
      participant: row ? sbwNormalizeSupabaseTournamentParticipant(row) : null,
      stats: result.stats || {},
      raw: data
    };
  } catch (error) {
    console.error("[SaberWolf Supabase] Falha ao atualizar inscrito pelo organizador:", error);
    throw error;
  }
}

async function sbwSaveSupabaseTournamentStructureAsync(tournament) {
  if (!sbwIsSupabaseEnabled()) {
    return {
      success: false,
      message: "Supabase não está ativo para salvar a estrutura do torneio."
    };
  }

  if (!tournament) {
    return {
      success: false,
      message: "Torneio não encontrado para salvar estrutura."
    };
  }

  if (!tournament.structure) {
    return {
      success: false,
      message: "Nenhuma estrutura foi gerada para salvar."
    };
  }

  const tableName = sbwGetTournamentsTableName();
  const databaseId = sbwGetTournamentDatabaseId(tournament);
  const publicId = sbwGetTournamentPublicId(tournament);
  const now = new Date().toISOString();
  const nextStatus = ["draft", "registration-open", "open", "published", "scheduled"].includes(String(tournament.status || ""))
    ? "structure-generated"
    : (tournament.status || "structure-generated");

  const settings = tournament.settings && typeof tournament.settings === "object"
    ? tournament.settings
    : {};

  const metadata = tournament.metadata && typeof tournament.metadata === "object"
    ? tournament.metadata
    : {};

  const payload = {
    status: nextStatus,
    settings: {
      ...settings,
      structure: tournament.structure,
      matches: Array.isArray(tournament.matches) ? tournament.matches : [],
      standings: Array.isArray(tournament.standings) ? tournament.standings : [],
      structureGeneratedAt: now,
      structureGeneratedFrom: "real-registrations"
    },
    metadata: {
      ...metadata,
      structureGeneratedAt: now,
      structureGeneratedFrom: "real-registrations",
      structurePlayersUsed: tournament.structure.playersUsed || 0
    }
  };

  try {
    let query = window.SBWSupabase.client
      .from(tableName)
      .update(payload);

    if (sbwLooksLikeSupabaseUuid(databaseId)) {
      query = query.eq("id", databaseId);
    } else if (publicId) {
      query = query.eq("slug", publicId);
    } else {
      return {
        success: false,
        message: "Não foi possível identificar o torneio real para salvar estrutura."
      };
    }

    const { data, error } = await query.select("*").single();

    if (error) {
      const isRlsError =
        error?.code === "42501" ||
        String(error?.message || "").toLowerCase().includes("row-level security") ||
        String(error?.message || "").toLowerCase().includes("permission");

      console.error("[SaberWolf Supabase] Erro ao salvar estrutura do torneio:", error);

      return {
        success: false,
        message: isRlsError
          ? "O Supabase bloqueou o salvamento da estrutura por RLS. Confirme se você é o criador/gestor do torneio e rode o SQL da v1.5.8.5."
          : (error.message || "Não foi possível salvar a estrutura no Supabase."),
        error
      };
    }

    return {
      success: true,
      message: "Estrutura salva no Supabase.",
      tournament: {
        ...sbwNormalizeSupabaseTournament(data),
        participants: Array.isArray(tournament.participants) ? tournament.participants : [],
        structure: tournament.structure,
        matches: Array.isArray(tournament.matches) ? tournament.matches : [],
        standings: Array.isArray(tournament.standings) ? tournament.standings : []
      },
      raw: data
    };
  } catch (error) {
    console.error("[SaberWolf Supabase] Falha inesperada ao salvar estrutura:", error);
    return {
      success: false,
      message: "Erro inesperado ao salvar estrutura no Supabase.",
      error
    };
  }
}

function sbwCountTournamentResultMatches(matches) {
  const normalizedMatches = Array.isArray(matches) ? matches : [];
  const playableMatches = normalizedMatches.filter((match) => match && match.playerA && match.playerB);
  const completedMatches = playableMatches.filter((match) => String(match.status || "").toLowerCase() === "completed");

  return {
    totalPlayable: playableMatches.length,
    completed: completedMatches.length
  };
}

async function sbwSaveSupabaseTournamentResultsAsync(tournament, options = {}) {
  if (!sbwIsSupabaseEnabled()) {
    return {
      success: false,
      message: "Supabase não está ativo para salvar resultados reais."
    };
  }

  if (!tournament || !tournament.structure) {
    return {
      success: false,
      message: "Nenhuma estrutura encontrada para salvar resultados."
    };
  }

  const tableName = sbwGetTournamentsTableName();
  const databaseId = sbwGetTournamentDatabaseId(tournament);
  const publicId = sbwGetTournamentPublicId(tournament);
  const now = new Date().toISOString();
  const matches = Array.isArray(tournament.matches) ? tournament.matches : [];
  const standings = Array.isArray(tournament.standings) ? tournament.standings : [];
  const counts = sbwCountTournamentResultMatches(matches);
  const hasCompletedMatch = counts.completed > 0;

  const previousStatus = String(tournament.status || "structure-generated");
  const nextStatus = options.status || (hasCompletedMatch ? "in-progress" : "structure-generated");
  const settings = tournament.settings && typeof tournament.settings === "object"
    ? tournament.settings
    : {};
  const metadata = tournament.metadata && typeof tournament.metadata === "object"
    ? tournament.metadata
    : {};
  const previousAudit = Array.isArray(metadata.resultsAudit)
    ? metadata.resultsAudit
    : [];

  const auditEntry = {
    action: options.action || "results-update",
    at: now,
    byAuthUserId: options.authUserId || "",
    byProfileId: options.profileId || "",
    completedMatches: counts.completed,
    totalPlayableMatches: counts.totalPlayable,
    previousStatus,
    nextStatus
  };

  const payload = {
    status: nextStatus,
    settings: {
      ...settings,
      structure: tournament.structure,
      matches,
      standings,
      resultsUpdatedAt: now,
      resultsUpdatedFrom: options.source || "admin-panel"
    },
    metadata: {
      ...metadata,
      resultsUpdatedAt: now,
      resultsUpdatedFrom: options.source || "admin-panel",
      resultsLastAction: auditEntry,
      resultsAudit: [...previousAudit.slice(-49), auditEntry]
    }
  };

  try {
    let query = window.SBWSupabase.client
      .from(tableName)
      .update(payload);

    if (sbwLooksLikeSupabaseUuid(databaseId)) {
      query = query.eq("id", databaseId);
    } else if (publicId) {
      query = query.eq("slug", publicId);
    } else {
      return {
        success: false,
        message: "Não foi possível identificar o torneio real para salvar resultados."
      };
    }

    const { data, error } = await query.select("*").single();

    if (error) {
      const isRlsError =
        error?.code === "42501" ||
        String(error?.message || "").toLowerCase().includes("row-level security") ||
        String(error?.message || "").toLowerCase().includes("permission");

      console.error("[SaberWolf Supabase] Erro ao salvar resultados do torneio:", error);

      return {
        success: false,
        message: isRlsError
          ? "O Supabase bloqueou o salvamento dos resultados por RLS. Confirme se você é criador/gestor deste torneio e rode o SQL da v1.5.8.7."
          : (error.message || "Não foi possível salvar os resultados no Supabase."),
        error
      };
    }

    return {
      success: true,
      message: "Resultados salvos no Supabase.",
      tournament: {
        ...sbwNormalizeSupabaseTournament(data),
        participants: Array.isArray(tournament.participants) ? tournament.participants : [],
        structure: tournament.structure,
        matches,
        standings
      },
      raw: data
    };
  } catch (error) {
    console.error("[SaberWolf Supabase] Falha inesperada ao salvar resultados:", error);
    return {
      success: false,
      message: "Erro inesperado ao salvar resultados no Supabase.",
      error
    };
  }
}



async function sbwGetMyTournamentOrganizerAccessAsync() {
  if (!sbwIsSupabaseEnabled()) {
    return [];
  }

  try {
    const { data, error } = await window.SBWSupabase.client.rpc("sbw_get_my_tournament_organizer_access");

    if (error) {
      console.error("[SaberWolf Supabase] Erro ao buscar organizações permitidas para torneios:", error);
      return [];
    }

    const rows = Array.isArray(data) ? data : [];

    return rows.map((row) => {
      const normalized = sbwNormalizeSupabaseTournamentOrganizer({
        id: row.id || row.organizer_id,
        slug: row.slug || row.organizer_slug,
        name: row.name || row.display_name,
        display_name: row.display_name || row.name,
        tag: row.tag || "",
        status: row.organizer_status || row.status || "active",
        logo_url: row.logo_url || "",
        banner_url: row.banner_url || "",
        metadata: row.metadata || {}
      });

      return {
        ...normalized,
        memberRole: row.member_role || row.role || "member",
        role: row.member_role || row.role || "member",
        canCreateTournament: row.can_create_tournaments === true || row.canCreateTournament === true,
        can_create_tournaments: row.can_create_tournaments === true || row.canCreateTournament === true,
        source: "supabase-access",
        access: row
      };
    });
  } catch (error) {
    console.error("[SaberWolf Supabase] Falha inesperada ao buscar organizações permitidas:", error);
    return [];
  }
}

function sbwNormalizeTournamentRpcResult(data, fallbackTournament = null) {
  const result = data && typeof data === "object" ? data : {};
  const tournamentRow = result.tournament || result.row || result.data || result;

  if (result.ok === false) {
    return {
      success: false,
      source: "supabase",
      message: result.message || "Não foi possível criar o torneio.",
      error: result
    };
  }

  return {
    success: true,
    source: "supabase",
    message: result.message || "Torneio criado no Supabase com sucesso.",
    tournament: tournamentRow ? sbwNormalizeSupabaseTournament(tournamentRow) : fallbackTournament,
    raw: tournamentRow || result
  };
}

async function sbwCreateSupabaseTournamentViaOrganizerRpc(tournament, options = {}) {
  const payload = sbwBuildSupabaseTournamentPayload(tournament, options);

  try {
    const { data, error } = await window.SBWSupabase.client.rpc("sbw_create_tournament_for_organizer", {
      p_payload: payload
    });

    if (error) {
      console.error("[SaberWolf Supabase] Erro ao criar torneio via organização:", error);
      return {
        success: false,
        source: "supabase",
        message: error.message || "Não foi possível criar o torneio pela organização selecionada.",
        error
      };
    }

    return sbwNormalizeTournamentRpcResult(data, tournament);
  } catch (error) {
    console.error("[SaberWolf Supabase] Falha inesperada ao criar torneio via organização:", error);
    return {
      success: false,
      source: "supabase",
      message: "Erro inesperado ao criar torneio pela organização selecionada.",
      error
    };
  }
}

async function sbwCreateSupabaseTournament(tournament, options = {}) {
  if (!sbwIsSupabaseEnabled()) {
    return {
      success: false,
      source: "local",
      message: "Supabase não está ativo para criação real de torneios."
    };
  }

  const authUser = options.authUser || null;

  if (!authUser?.id) {
    return {
      success: false,
      requiresLogin: true,
      message: "Você precisa entrar com Login -SBW- para criar torneios reais."
    };
  }

  const selectedOrganizer = options.organizer || tournament?.selectedOrganizer || null;

  if (!selectedOrganizer?.id && !selectedOrganizer?.slug) {
    return {
      success: false,
      source: "supabase",
      message: "Selecione uma Organização de Torneios válida para criar o torneio."
    };
  }

  return await sbwCreateSupabaseTournamentViaOrganizerRpc(tournament, options);

  const tableName = sbwGetTournamentsTableName();
  const payload = sbwBuildSupabaseTournamentPayload(tournament, options);
  payload.slug = await sbwBuildUniqueSupabaseTournamentSlug(payload.slug || tournament?.slug || tournament?.title, tableName);

  try {
    const { data, error } = await window.SBWSupabase.client
      .from(tableName)
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      const isDuplicateSlug = error?.code === "23505"
        && String(error?.message || "").includes("tournaments_slug_key");

      if (isDuplicateSlug) {
        payload.slug = `${payload.slug}-${String(Date.now()).slice(-4)}`;

        const retry = await window.SBWSupabase.client
          .from(tableName)
          .insert(payload)
          .select("*")
          .single();

        if (!retry.error && retry.data) {
          return {
            success: true,
            source: "supabase",
            message: "Torneio criado no Supabase com slug automático único.",
            tournament: sbwNormalizeSupabaseTournament(retry.data),
            raw: retry.data
          };
        }
      }

      console.error("[SaberWolf Supabase] Erro ao criar torneio:", error);
      return {
        success: false,
        source: "supabase",
        message: error.message || "Não foi possível criar o torneio no Supabase.",
        error
      };
    }

    return {
      success: true,
      source: "supabase",
      message: "Torneio criado no Supabase com sucesso.",
      tournament: sbwNormalizeSupabaseTournament(data),
      raw: data
    };
  } catch (error) {
    console.error("[SaberWolf Supabase] Falha inesperada ao criar torneio:", error);
    return {
      success: false,
      source: "supabase",
      message: "Erro inesperado ao criar torneio no Supabase.",
      error
    };
  }
}

async function sbwCreateTournamentAsync(tournament, options = {}) {
  if (sbwIsSupabaseEnabled()) {
    return await sbwCreateSupabaseTournament(tournament, options);
  }

  const tournaments = sbwGetSavedTournaments().map((savedTournament) => {
    const copy = { ...savedTournament };
    delete copy.source;
    return copy;
  });

  const localTournament = {
    ...tournament,
    slug: sbwBuildUniqueLocalTournamentSlug(tournament?.slug || tournament?.title || tournament?.id)
  };

  tournaments.push(localTournament);
  sbwSaveTournaments(tournaments);

  return {
    success: true,
    source: "local",
    message: "Supabase desativado. Torneio salvo localmente neste navegador.",
    tournament: {
      ...localTournament,
      source: "local"
    }
  };
}

function sbwGetAllTournaments() {
  return sbwGetLocalTournaments();
}

async function sbwGetAllTournamentsAsync() {
  if (sbwIsSupabaseEnabled()) {
    const supabaseTournaments = await sbwGetSupabaseTournaments();

    if (supabaseTournaments.length > 0) {
      return sbwFilterPublicTournaments(supabaseTournaments);
    }

    if (!sbwTournamentLocalDemoFallbackAllowed()) {
      console.warn("[SaberWolf Supabase] Nenhum torneio público retornado. Exibindo estado vazio real.");
      return [];
    }

    console.warn("[SaberWolf Supabase] Nenhum torneio público retornado. Usando fallback local-demo apenas em ambiente local sem Supabase real.");
  }

  return sbwGetLocalTournaments();
}

function sbwGetTournamentById(id) {
  return sbwGetAllTournaments().find((tournament) => {
    return String(tournament.id) === String(id);
  }) || null;
}

async function sbwGetTournamentByIdAsync(id) {
  const tournaments = await sbwGetAllTournamentsAsync();

  return tournaments.find((tournament) => {
    return (
      String(tournament.id) === String(id) ||
      String(tournament.slug) === String(id) ||
      String(tournament.supabaseId) === String(id)
    );
  }) || null;
}

function sbwGetRegistrations() {
  const config = sbwGetStorageConfig();
  const data = localStorage.getItem(config.registrationKey);

  if (!data) {
    return {};
  }

  try {
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.error("Erro ao ler inscrições:", error);
    return {};
  }
}

function sbwSaveRegistrations(registrations) {
  const config = sbwGetStorageConfig();

  const safeRegistrations = registrations && typeof registrations === "object"
    ? registrations
    : {};

  localStorage.setItem(config.registrationKey, JSON.stringify(safeRegistrations));
}

function sbwHasRegistration(tournamentId) {
  const registrations = sbwGetRegistrations();
  return Boolean(registrations[tournamentId]);
}

function sbwSaveRegistration(tournamentId, registrationData = {}) {
  const tournament = sbwGetTournamentById(tournamentId);

  if (!tournament) {
    return {
      success: false,
      message: "Torneio não encontrado."
    };
  }

  const registrations = sbwGetRegistrations();

  if (registrations[tournamentId]) {
    return {
      success: false,
      message: "Você já simulou inscrição neste torneio neste navegador."
    };
  }

  registrations[tournamentId] = {
    tournamentId,
    tournamentName: tournament.name || tournament.title || "Torneio",
    status: "pending-login",
    createdAt: new Date().toISOString(),
    note: "Inscrição simulada. Na versão final, o usuário precisará estar logado na SaberWolf.",
    ...registrationData
  };

  sbwSaveRegistrations(registrations);

  return {
    success: true,
    message: "Inscrição simulada registrada.",
    registration: registrations[tournamentId]
  };
}

function sbwIsOpenForRegistration(tournament) {
  const status = sbwGetStatusInfo(tournament?.status).className;
  const participantsCount = sbwGetParticipantsCount(tournament);
  const maxParticipants = Number(sbwGetMaxParticipants(tournament));

  if (status !== "open") {
    return false;
  }

  if (Number.isFinite(maxParticipants)) {
    return participantsCount < maxParticipants;
  }

  return true;
}
// =========================================================
// v1.6.61 — Gestão real dos torneios pelo Organizador
// =========================================================
async function sbwUpdateTournamentForOrganizerAsync(options = {}) {
  if (!sbwIsSupabaseEnabled()) {
    throw new Error("Supabase não está habilitado para editar torneios do organizador.");
  }

  const organizerKey = options?.organizer || options?.organizerSlug || options?.organizerId || "";
  const tournamentKey = options?.tournamentId || options?.tournament || options?.id || "";
  const payload = options?.payload && typeof options.payload === "object" ? options.payload : {};

  if (!organizerKey) {
    throw new Error("Organizador não informado para editar o torneio.");
  }

  if (!tournamentKey) {
    throw new Error("Torneio não informado para edição.");
  }

  const { data, error } = await window.SBWSupabase.client.rpc("sbw_update_tournament_for_organizer", {
    p_organizer: organizerKey,
    p_tournament: tournamentKey,
    p_payload: payload
  });

  if (error) {
    console.error("[SaberWolf Supabase] Erro ao atualizar torneio do organizador:", error);
    throw error;
  }

  const result = data && typeof data === "object" ? data : {};
  const row = result.tournament || result.row || result.data || result;

  return {
    ok: result.ok !== false,
    message: result.message || "Torneio atualizado.",
    tournament: row && typeof row === "object" ? sbwNormalizeSupabaseTournament(row) : row,
    raw: data
  };
}

// =========================================================
// v1.6.60 — Staff real do Organizador
// =========================================================
function sbwNormalizeOrganizerStaffListResponse(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (data && typeof data === "object") {
    if (Array.isArray(data.staff)) return data.staff;
    if (Array.isArray(data.members)) return data.members;
    if (Array.isArray(data.data)) return data.data;
  }

  return [];
}

function sbwNormalizeTournamentOrganizerStaffMember(row) {
  const raw = row && typeof row === "object" ? row : {};
  const metadata = raw.metadata && typeof raw.metadata === "object" ? raw.metadata : {};
  const role = String(raw.role || raw.memberRole || metadata.role || "staff").toLowerCase();
  const status = String(raw.status || metadata.status || "active").toLowerCase();
  const roleLabels = {
    owner: "Dono",
    admin: "Administrador",
    manager: "Gestor",
    organizer_admin: "Administrador",
    tournament_admin: "Admin. torneios",
    staff: "Staff",
    member: "Membro"
  };

  return {
    id: String(raw.id || raw.memberId || raw.profile_id || raw.profileId || raw.auth_user_id || raw.authUserId || raw.profile_slug || raw.profileSlug || ""),
    organizerId: raw.organizer_id || raw.organizerId || raw.tournament_organizer_id || raw.tournamentOrganizerId || "",
    organizerSlug: raw.organizer_slug || raw.organizerSlug || "",
    authUserId: raw.auth_user_id || raw.authUserId || "",
    profileId: raw.profile_id || raw.profileId || "",
    profileSlug: raw.profile_slug || raw.profileSlug || "",
    displayName: raw.display_name || raw.displayName || raw.name || raw.nickname || metadata.displayName || metadata.name || raw.profile_slug || "Membro autorizado",
    avatarUrl: raw.avatar_url || raw.avatarUrl || metadata.avatarUrl || "",
    role,
    roleLabel: roleLabels[role] || role,
    status,
    statusLabel: status === "active" ? "Ativo" : status === "pending" ? "Pendente" : status,
    canEdit: !["owner"].includes(role),
    source: raw.source || "supabase",
    raw
  };
}

async function sbwGetTournamentOrganizerStaffAsync(organizer) {
  if (!sbwIsSupabaseEnabled()) {
    return sbwGetDemoTournamentOrganizerMembers(organizer).map(sbwNormalizeTournamentOrganizerStaffMember);
  }

  const organizerKey = typeof organizer === "string"
    ? organizer
    : organizer?.slug || organizer?.id || organizer?.raw?.id || organizer?.raw?.slug || "";

  if (!organizerKey) {
    return [];
  }

  try {
    const { data, error } = await window.SBWSupabase.client.rpc("sbw_get_tournament_organizer_staff", {
      p_organizer: organizerKey
    });

    if (error) {
      console.error("[SaberWolf Supabase] Erro ao buscar staff do organizador:", error);
      return sbwGetTournamentOrganizerMembersAsync(organizer);
    }

    return sbwNormalizeOrganizerStaffListResponse(data).map(sbwNormalizeTournamentOrganizerStaffMember);
  } catch (error) {
    console.error("[SaberWolf Supabase] Falha inesperada ao buscar staff do organizador:", error);
    return sbwGetTournamentOrganizerMembersAsync(organizer);
  }
}

async function sbwAddTournamentOrganizerStaffAsync(payload) {
  if (!sbwIsSupabaseEnabled()) {
    throw new Error("Supabase não está habilitado para adicionar staff.");
  }

  const organizerKey = payload?.organizer || payload?.organizerSlug || payload?.organizerId || "";
  const profileKey = payload?.profileKey || payload?.profile || payload?.profileSlug || "";
  const role = payload?.role || "staff";

  const { data, error } = await window.SBWSupabase.client.rpc("sbw_add_tournament_organizer_staff", {
    p_organizer: organizerKey,
    p_profile_key: profileKey,
    p_role: role
  });

  if (error) {
    console.error("[SaberWolf Supabase] Erro ao adicionar staff do organizador:", error);
    throw error;
  }

  return data;
}

async function sbwUpdateTournamentOrganizerStaffRoleAsync(payload) {
  if (!sbwIsSupabaseEnabled()) {
    throw new Error("Supabase não está habilitado para atualizar staff.");
  }

  const { data, error } = await window.SBWSupabase.client.rpc("sbw_update_tournament_organizer_staff_role", {
    p_organizer: payload?.organizer || payload?.organizerSlug || payload?.organizerId || "",
    p_member_id: payload?.memberId || payload?.id || "",
    p_role: payload?.role || "staff"
  });

  if (error) {
    console.error("[SaberWolf Supabase] Erro ao atualizar cargo do staff:", error);
    throw error;
  }

  return data;
}

async function sbwRemoveTournamentOrganizerStaffAsync(payload) {
  if (!sbwIsSupabaseEnabled()) {
    throw new Error("Supabase não está habilitado para remover staff.");
  }

  const { data, error } = await window.SBWSupabase.client.rpc("sbw_remove_tournament_organizer_staff", {
    p_organizer: payload?.organizer || payload?.organizerSlug || payload?.organizerId || "",
    p_member_id: payload?.memberId || payload?.id || ""
  });

  if (error) {
    console.error("[SaberWolf Supabase] Erro ao remover staff do organizador:", error);
    throw error;
  }

  return data;
}
