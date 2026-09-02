(function () {
  "use strict";

  const state = {
    context: null,
    client: null,
    profiles: [],
    teams: [],
    tournaments: [],
    logs: [],
    rlsResults: [],
    profileListExpanded: false,
    teamListExpanded: false,
    tournamentListExpanded: false,
    profileLetterFilter: "",
    teamLetterFilter: "",
    tournamentStatusFilter: "",
    tournamentSearchQuery: "",
    organizerPermissions: new Map(),
    organizerPermissionRows: [],
    tournamentOrganizers: [],
    analyticsDays: 7,
    analyticsRangeMode: "days",
    analyticsStartDate: "",
    analyticsEndDate: "",
    analyticsSummary: null,
    analyticsError: ""
  };

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function $all(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitForSupabaseClient() {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const client = window.SBWSupabase?.client;

      if (client?.auth) {
        return client;
      }

      await wait(100);
    }

    return null;
  }

  function getTable(name, fallback) {
    return window.SBWSupabaseConfig?.tables?.[name] || fallback;
  }

  function asObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function isTruthyFlag(value) {
    if (value === true || value === 1) return true;
    const normalized = String(value || "").trim().toLowerCase();
    return ["true", "1", "yes", "sim", "verified", "active", "enabled"].includes(normalized);
  }

  function getProfileName(profile) {
    return (
      profile?.display_name ||
      profile?.displayName ||
      profile?.nickname ||
      profile?.username ||
      profile?.name ||
      profile?.email ||
      "Perfil sem nome"
    );
  }

  function getProfileKey(profile) {
    return (
      profile?.slug ||
      profile?.username ||
      profile?.profile_slug ||
      profile?.id ||
      profile?.auth_user_id ||
      ""
    );
  }

  function getProfileAuthUserId(profile) {
    return profile?.auth_user_id || profile?.authUserId || profile?.user_id || "";
  }

  function normalizePermissionStatus(value) {
    return String(value || "").trim().toLowerCase();
  }

  function isActiveOrganizerPermission(row) {
    const status = normalizePermissionStatus(row?.status || "approved");
    return Boolean(row) && ["approved", "active", "enabled"].includes(status);
  }

  function organizerPermissionCanCreateOrganization(row) {
    return Boolean(
      isActiveOrganizerPermission(row) &&
      (
        row?.can_create_organizations === true ||
        row?.canCreateOrganizations === true ||
        row?.can_create_organization === true ||
        row?.canCreateOrganization === true ||
        row?.can_create_tournament_organizers === true ||
        row?.canCreateTournamentOrganizers === true ||
        row?.can_create_tournament_organizer === true ||
        row?.canCreateTournamentOrganizer === true
      )
    );
  }

  function getOrganizerPermissionForProfile(profile) {
    if (!profile || !state.organizerPermissions) return null;

    const keys = [
      getProfileAuthUserId(profile),
      profile?.id,
      profile?.slug,
      profile?.username,
      getProfileKey(profile)
    ].map((value) => String(value || "").trim()).filter(Boolean);

    for (const key of keys) {
      if (state.organizerPermissions.has(key)) {
        return state.organizerPermissions.get(key);
      }
    }

    return null;
  }

  function getProfileByOrganizerPermission(row) {
    if (!row) return null;

    const keys = [
      row.auth_user_id,
      row.user_id,
      row.profile_id,
      row.profile_slug,
      row.slug,
      row.email,
      row.user_email
    ].map((value) => String(value || "").trim()).filter(Boolean);

    return state.profiles.find((profile) => {
      const profileKeys = [
        profile?.id,
        profile?.auth_user_id,
        profile?.authUserId,
        profile?.user_id,
        profile?.slug,
        profile?.username,
        profile?.email,
        profile?.auth_email,
        getProfileKey(profile)
      ].map((value) => String(value || "").trim()).filter(Boolean);

      return keys.some((key) => profileKeys.includes(key));
    }) || null;
  }

  function getOrganizerPermissionTarget(profile, row) {
    const permissionRow = row || getOrganizerPermissionForProfile(profile) || {};
    const targetProfile = profile || getProfileByOrganizerPermission(permissionRow) || {};

    return {
      authUserId: String(
        permissionRow.auth_user_id ||
        permissionRow.authUserId ||
        permissionRow.user_id ||
        getProfileAuthUserId(targetProfile) ||
        ""
      ).trim(),
      profileId: String(
        permissionRow.profile_id ||
        permissionRow.profileId ||
        targetProfile.id ||
        ""
      ).trim(),
      profileSlug: String(
        permissionRow.profile_slug ||
        permissionRow.profileSlug ||
        permissionRow.slug ||
        targetProfile.slug ||
        targetProfile.username ||
        getProfileKey(targetProfile) ||
        ""
      ).trim(),
      displayName: getProfileName(targetProfile) !== "Perfil sem nome"
        ? getProfileName(targetProfile)
        : String(permissionRow.profile_slug || permissionRow.auth_user_id || "organizador").trim()
    };
  }

  function getActiveOrganizerPermissionRows() {
    return (state.organizerPermissionRows || [])
      .filter(organizerPermissionCanCreateOrganization)
      .sort((a, b) => normalizeSearch(getOrganizerPermissionTarget(null, a).displayName).localeCompare(normalizeSearch(getOrganizerPermissionTarget(null, b).displayName), "pt-BR"));
  }

  function getTeamKey(team) {
    return team?.slug || team?.id || team?.teamSlug || team?.teamId || "";
  }

  function getTeamName(team) {
    return team?.name || team?.teamName || team?.displayName || team?.title || "Equipe sem nome";
  }

  function getTeamTag(team) {
    return team?.tag || team?.shortName || team?.teamTag || "";
  }

  function getTeamStatusValue(team) {
    return String(team?.status || team?.state || (team?.is_active === false || team?.isActive === false ? "deleted" : "active")).trim().toLowerCase();
  }

  function isTeamDeleted(team) {
    const status = getTeamStatusValue(team);
    return Boolean(
      team?.is_active === false ||
      team?.isActive === false ||
      team?.metadata?.adminDeleted === true ||
      ["deleted", "archived", "hidden", "inactive", "removed"].includes(status)
    );
  }

  function getTeamStatusLabel(team) {
    if (isTeamDeleted(team)) return "Removida";
    const status = getTeamStatusValue(team);
    const labels = {
      active: "Ativa",
      pending: "Pendente",
      private: "Privada",
      inactive: "Inativa",
      archived: "Arquivada",
      deleted: "Removida"
    };
    return labels[status] || status || "Ativa";
  }

  function getTournamentKey(tournament) {
    return String(tournament?.slug || tournament?.id || tournament?.supabaseId || tournament?.tournament_id || "").trim();
  }

  function getTournamentDatabaseKey(tournament) {
    return String(tournament?.supabaseId || tournament?.id || tournament?.slug || "").trim();
  }

  function getTournamentName(tournament) {
    return String(tournament?.title || tournament?.name || "Torneio sem nome").trim();
  }

  function getTournamentOrganizerLabel(tournament) {
    return String(
      tournament?.organizer_name ||
      tournament?.organizerName ||
      tournament?.organizer_slug ||
      tournament?.organizerSlug ||
      tournament?.organizer ||
      "Organizador não informado"
    ).trim();
  }

  function getTournamentStatusValue(tournament) {
    return String(tournament?.status || tournament?.state || tournament?.metadata?.status || "draft").trim().toLowerCase();
  }

  function getTournamentStatusLabel(status) {
    const normalized = String(status || "draft").toLowerCase();
    const labels = {
      draft: "Rascunho",
      published: "Publicado",
      scheduled: "Agendado",
      open: "Inscrições abertas",
      "registration-open": "Inscrições abertas",
      running: "Em andamento",
      "in-progress": "Em andamento",
      in_progress: "Em andamento",
      ongoing: "Em andamento",
      active: "Em andamento",
      started: "Em andamento",
      live: "Em andamento",
      finished: "Finalizado",
      completed: "Finalizado",
      complete: "Finalizado",
      finalized: "Finalizado",
      ended: "Finalizado",
      closed: "Finalizado",
      archived: "Arquivado",
      deleted: "Removido",
      hidden: "Oculto",
      cancelled: "Cancelado"
    };

    return labels[normalized] || normalized || "Rascunho";
  }

  function getTournamentStatusBucket(tournament) {
    const status = getTournamentStatusValue(tournament);
    const normalized = status.replaceAll("_", "-").replaceAll(" ", "-");

    if (["open", "registration-open", "registration", "registration-opened", "published", "public", "scheduled", "upcoming"].includes(normalized)) return "open";
    if (["running", "in-progress", "structure-generated", "active", "ongoing", "started", "live", "em-andamento"].includes(normalized)) return "running";
    if (["finished", "completed", "complete", "closed", "finalized", "ended", "done", "encerrado", "finalizado"].includes(normalized)) return "finished";
    if (["archived", "deleted", "hidden", "cancelled", "removed", "private"].includes(normalized)) return "archived";
    return "draft";
  }

  function getTournamentFormatLabel(tournament) {
    const value = String(tournament?.format || tournament?.formatLabel || "").toLowerCase();
    const labels = {
      "double-elimination": "Double Elimination",
      double_elimination: "Double Elimination",
      "groups-playoffs": "Grupos + Playoffs",
      groups_playoffs: "Grupos + Playoffs",
      "round-robin": "Pontos Corridos",
      round_robin: "Pontos Corridos",
      "team-battle-league-4v4": "Team Battle League 4v4"
    };

    return labels[value] || tournament?.formatLabel || tournament?.format || "Formato não informado";
  }

  function formatAdminDateTime(value) {
    if (!value) return "Sem data";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value || "Sem data");
    }

    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function normalizeTournamentFromAdminRow(row = {}) {
    const raw = row && typeof row === "object" ? row : {};
    const metadata = raw.metadata && typeof raw.metadata === "object" ? raw.metadata : {};

    return {
      ...raw,
      id: raw.id || raw.tournament_id || raw.slug || "",
      supabaseId: raw.supabase_id || raw.supabaseId || raw.id || "",
      slug: raw.slug || raw.tournament_slug || metadata.slug || "",
      title: raw.title || raw.name || raw.tournament_name || "Torneio sem nome",
      name: raw.title || raw.name || raw.tournament_name || "Torneio sem nome",
      game: raw.game_name || raw.game || raw.game_id || "Jogo não informado",
      gameName: raw.game_name || raw.game || raw.game_id || "Jogo não informado",
      format: raw.format || metadata.format || "",
      status: raw.status || metadata.status || "draft",
      visibility: raw.visibility || metadata.visibility || "public",
      organizerName: raw.organizer_name || raw.organizerName || metadata.organizerName || metadata.organizer_name || "Organizador não informado",
      organizerSlug: raw.organizer_slug || raw.organizerSlug || metadata.organizerSlug || metadata.organizer_slug || "",
      maxParticipants: Number(raw.max_participants || raw.maxParticipants || 0) || 0,
      currentParticipants: Number(raw.current_participants || raw.currentParticipants || raw.participant_count || raw.participants_count || 0) || 0,
      participantCount: Number(raw.participant_count || raw.participants_count || raw.current_participants || 0) || 0,
      checkedInCount: Number(raw.checked_in_count || raw.checkins_count || 0) || 0,
      startsAt: raw.starts_at || raw.startsAt || raw.start_date || "",
      createdAt: raw.created_at || raw.createdAt || "",
      updatedAt: raw.updated_at || raw.updatedAt || ""
    };
  }


  function getOrganizerStatusValue(organizer) {
    const metadata = asObject(organizer?.metadata);
    return String(
      organizer?.status ||
      organizer?.public_status ||
      metadata.status ||
      "active"
    ).trim().toLowerCase().replaceAll("_", "-");
  }

  function getOrganizerEntityName(organizer) {
    return (
      organizer?.name ||
      organizer?.displayName ||
      organizer?.display_name ||
      organizer?.title ||
      organizer?.organizer_name ||
      "Organização sem nome"
    );
  }

  function getOrganizerEntityKey(organizer) {
    return String(organizer?.id || organizer?.slug || organizer?.name || "").trim();
  }

  function getOrganizerEntitySlug(organizer) {
    return String(organizer?.slug || organizer?.public_slug || organizer?.id || "").trim();
  }

  function getOrganizerEntityStatusLabel(organizer) {
    const status = getOrganizerStatusValue(organizer);
    const labels = {
      active: "Ativa",
      approved: "Ativa",
      published: "Ativa",
      public: "Ativa",
      pending: "Em análise",
      review: "Em análise",
      inactive: "Inativa",
      disabled: "Inativa",
      archived: "Arquivada",
      deleted: "Removida",
      removed: "Removida"
    };
    return labels[status] || status || "Ativa";
  }

  function isOrganizerEntityArchivedOrDeleted(organizer) {
    const status = getOrganizerStatusValue(organizer);
    const metadata = asObject(organizer?.metadata);
    return Boolean(
      ["archived", "deleted", "removed", "inactive", "disabled"].includes(status) ||
      metadata.adminArchived === true ||
      metadata.admin_archived === true ||
      metadata.adminDeleted === true ||
      metadata.admin_deleted === true
    );
  }

  function normalizeOrganizerEntityFromAdminRow(row = {}) {
    const raw = row && typeof row === "object" ? row : {};
    const source = raw.organizer && typeof raw.organizer === "object" ? raw.organizer : raw;
    const metadata = asObject(source.metadata);
    return {
      ...source,
      id: source.id || raw.id || source.organizer_id || raw.organizer_id || "",
      slug: source.slug || source.public_slug || metadata.slug || "",
      name: source.name || source.display_name || source.title || source.organizer_name || "Organização sem nome",
      displayName: source.displayName || source.display_name || source.name || source.organizer_name || "Organização sem nome",
      tag: source.tag || source.short_tag || source.acronym || metadata.tag || "",
      status: source.status || source.public_status || metadata.status || "active",
      logoUrl: source.logoUrl || source.logo_url || source.avatar_url || metadata.logoUrl || metadata.logo_url || "",
      tournamentCount: Number(raw.tournament_count || raw.tournamentCount || source.tournament_count || source.tournamentCount || 0) || 0,
      memberCount: Number(raw.member_count || raw.memberCount || source.member_count || source.memberCount || 0) || 0,
      createdAt: source.created_at || source.createdAt || "",
      updatedAt: source.updated_at || source.updatedAt || "",
      metadata
    };
  }
  function isVerifiedTeam(team) {
    const metadata = asObject(team?.metadata);
    return Boolean(
      isTruthyFlag(team?.isVerified) ||
      isTruthyFlag(team?.is_verified) ||
      String(team?.verificationStatus || team?.verification_status || metadata.verificationStatus || metadata.verification_status || "").trim().toLowerCase() === "verified"
    );
  }

  function getProfilePermissions(profile) {
    const metadata = asObject(profile?.metadata);
    return asObject(profile?.permissions || metadata.permissions);
  }

  function isMasterProfile(profile) {
    const permissions = getProfilePermissions(profile);
    return Boolean(permissions.isMasterAdmin || permissions.is_master_admin);
  }

  function isAdminProfile(profile) {
    const permissions = getProfilePermissions(profile);
    return Boolean(
      permissions.isAdmin ||
      permissions.is_admin ||
      permissions.isAdminSbw ||
      permissions.is_admin_sbw ||
      isMasterProfile(profile)
    );
  }

  function isCurrentAdminProfile(profile) {
    const userId = state.context?.user?.id || "";
    const profileId = state.context?.profile?.id || "";

    return Boolean(
      (userId && (profile?.auth_user_id === userId || profile?.authUserId === userId)) ||
      (profileId && profile?.id === profileId)
    );
  }

  function hasOrganizerPermission(profile) {
    const permissions = getProfilePermissions(profile);
    const organizerPermission = getOrganizerPermissionForProfile(profile);

    return Boolean(
      organizerPermissionCanCreateOrganization(organizerPermission) ||
      permissions.canCreateTournamentOrganizer ||
      permissions.can_create_tournament_organizer ||
      permissions.canCreateTournamentOrganizers ||
      permissions.can_create_tournament_organizers ||
      permissions.canCreateOrganization ||
      permissions.can_create_organization ||
      permissions.canCreateOrganizations ||
      permissions.can_create_organizations ||
      permissions.canCreateTournament ||
      permissions.can_create_tournament ||
      permissions.canCreateTournaments ||
      permissions.can_create_tournaments ||
      permissions.isOrganizer ||
      permissions.is_organizer
    );
  }

  function shouldShowApproveOrganizer(profile) {
    if (!profile) return false;

    // A conta Admin/Master atual não precisa ser tratada como aprovação pendente.
    if (isCurrentAdminProfile(profile) && canAccessAdmin(state.context)) return false;

    // Admins do site não usam este fluxo; organizadores devem ser usuários SBW aprovados para uma organização.
    if (isAdminProfile(profile)) return false;

    return !hasOrganizerPermission(profile);
  }

  function getProfileBadges(profile) {
    const permissions = getProfilePermissions(profile);
    const badges = [];

    const organizerPermission = getOrganizerPermissionForProfile(profile);

    if (permissions.isMasterAdmin || permissions.is_master_admin) badges.push("Master Admin");
    if (permissions.isAdmin || permissions.is_admin || permissions.isAdminSbw || permissions.is_admin_sbw) badges.push("Admin SBW");
    if (organizerPermissionCanCreateOrganization(organizerPermission)) badges.push("Criar organização");
    else if (hasOrganizerPermission(profile)) badges.push("Organizador");
    if (permissions.canManagePermissions || permissions.can_manage_permissions) badges.push("Permissões");

    return badges;
  }


  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
  }

  function normalizeSearch(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function matchesProfile(profile, query) {
    const needle = normalizeSearch(query);
    if (!needle) return true;

    const haystack = normalizeSearch([
      profile?.id,
      profile?.auth_user_id,
      profile?.email,
      profile?.username,
      profile?.slug,
      profile?.display_name,
      profile?.displayName,
      profile?.nickname,
      profile?.headline
    ].join(" "));

    return haystack.includes(needle);
  }

  function matchesTeam(team, query) {
    const needle = normalizeSearch(query);
    if (!needle) return true;

    const modalities = Array.isArray(team?.modalities) ? team.modalities.join(" ") : "";
    const games = Array.isArray(team?.games) ? team.games.join(" ") : "";

    const haystack = normalizeSearch([
      team?.id,
      team?.slug,
      getTeamName(team),
      getTeamTag(team),
      team?.description,
      team?.game,
      team?.mainGame,
      modalities,
      games
    ].join(" "));

    return haystack.includes(needle);
  }

  function sortProfilesByName(profiles = []) {
    return [...profiles].sort((a, b) => {
      const nameA = normalizeSearch(getProfileName(a));
      const nameB = normalizeSearch(getProfileName(b));
      return nameA.localeCompare(nameB, "pt-BR");
    });
  }

  function sortTeamsByName(teams = []) {
    return [...teams].sort((a, b) => {
      const nameA = normalizeSearch(getTeamName(a));
      const nameB = normalizeSearch(getTeamName(b));
      return nameA.localeCompare(nameB, "pt-BR");
    });
  }


  function getInitialLetter(value) {
    const normalized = normalizeSearch(value);
    const first = normalized.charAt(0);

    if (!first) return "#";
    if (first >= "a" && first <= "z") return first.toUpperCase();
    return "#";
  }

  function getProfileInitialLetter(profile) {
    return getInitialLetter(getProfileName(profile));
  }

  function getTeamInitialLetter(team) {
    return getInitialLetter(getTeamName(team));
  }

  function getCurrentProfileQuery() {
    return $("[data-sbw-admin-profile-search] input")?.value || "";
  }

  function getCurrentTeamQuery() {
    return $("[data-sbw-admin-team-search] input")?.value || "";
  }

  function applyLetterFilter(items, letter, getLetter) {
    if (!letter) return items;
    return items.filter((item) => getLetter(item) === letter);
  }

  function getFilteredProfiles() {
    const query = getCurrentProfileQuery();
    const filteredByQuery = state.profiles.filter((profile) => matchesProfile(profile, query));
    return applyLetterFilter(filteredByQuery, state.profileLetterFilter, getProfileInitialLetter);
  }

  function getFilteredTeams() {
    const query = getCurrentTeamQuery();
    const filteredByQuery = state.teams
      .filter((team) => !isTeamDeleted(team) || state.teamLetterFilter || query.trim())
      .filter((team) => matchesTeam(team, query));
    return applyLetterFilter(filteredByQuery, state.teamLetterFilter, getTeamInitialLetter);
  }

  function isTournamentDeletedForAdmin(tournament) {
    const status = getTournamentStatusValue(tournament);
    const metadata = asObject(tournament?.metadata);

    return (
      ["deleted", "removed"].includes(status) ||
      metadata.adminDeleted === true ||
      metadata.admin_deleted === true
    );
  }

  function matchesAdminKey(item, key, keys = []) {
    const safeKey = String(key || "").trim();
    if (!safeKey) return false;

    return keys
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .includes(safeKey);
  }

  function removeTournamentFromStateByKey(key) {
    state.tournaments = (state.tournaments || []).filter((item) => {
      return !matchesAdminKey(item, key, [
        getTournamentDatabaseKey(item),
        getTournamentKey(item),
        item?.slug,
        item?.supabaseId,
        item?.id
      ]);
    });
  }

  function removeTeamFromStateByKey(key) {
    state.teams = (state.teams || []).filter((item) => {
      return !matchesAdminKey(item, key, [
        getTeamKey(item),
        item?.slug,
        item?.id
      ]);
    });
  }

  function getListLimit(isExpanded, defaultLimit) {
    return isExpanded ? 0 : defaultLimit;
  }

  function renderProfilesList() {
    const query = getCurrentProfileQuery().trim();

    if (!state.profileListExpanded && !state.profileLetterFilter && !query) {
      resetProfileResults();
      return;
    }

    renderProfileResults(sortProfilesByName(getFilteredProfiles()), {
      limit: getListLimit(state.profileListExpanded, 40)
    });
    updateListControls();
  }

  function renderTeamsList() {
    const query = getCurrentTeamQuery().trim();

    if (!state.teamListExpanded && !state.teamLetterFilter && !query) {
      resetTeamResults();
      return;
    }

    renderTeamResults(sortTeamsByName(getFilteredTeams()), {
      limit: getListLimit(state.teamListExpanded, 60)
    });
    updateListControls();
  }

  function renderAlphaFilter(rootId, scope, selectedLetter) {
    const root = document.getElementById(rootId);
    if (!root) return;

    const letters = ["", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];
    root.innerHTML = letters
      .map((letter) => {
        const label = letter || "Todos";
        const isActive = selectedLetter === letter;
        return `
          <button
            class="sbw-admin-alpha-button ${isActive ? "is-active" : ""}"
            type="button"
            data-admin-action="filter-list-letter"
            data-filter-scope="${escapeHtml(scope)}"
            data-filter-letter="${escapeHtml(letter)}"
          >${escapeHtml(label)}</button>
        `;
      })
      .join("");
  }

  function renderAlphaFilters() {
    renderAlphaFilter("sbwAdminProfileAlphaFilter", "profiles", state.profileLetterFilter);
    renderAlphaFilter("sbwAdminTeamAlphaFilter", "teams", state.teamLetterFilter);
  }

  function updateListControls() {
    const profileLess = $("[data-admin-action='show-less-profiles']");
    const teamLess = $("[data-admin-action='show-less-teams']");
    const tournamentLess = $("[data-admin-action='show-less-tournaments']");

    if (profileLess) profileLess.hidden = !state.profileListExpanded && !state.profileLetterFilter;
    if (teamLess) teamLess.hidden = !state.teamListExpanded && !state.teamLetterFilter;
    if (tournamentLess) tournamentLess.hidden = !state.tournamentListExpanded && !state.tournamentStatusFilter && !state.tournamentSearchQuery;
  }

  function resetProfileResults() {
    const root = $("#sbwAdminProfileResults");
    if (root) root.innerHTML = `<p class="sbw-admin-muted">Clique em “Mostrar todos” ou busque por pelo menos 2 caracteres.</p>`;
    updateListControls();
  }

  function resetTeamResults() {
    const root = $("#sbwAdminTeamResults");
    if (root) root.innerHTML = `<p class="sbw-admin-muted">Clique em “Mostrar todas” ou busque por pelo menos 2 caracteres.</p>`;
    updateListControls();
  }

  function resetTournamentResults() {
    const root = $("#sbwAdminTournamentResults");
    if (root) root.innerHTML = `<p class="sbw-admin-muted">Clique em “Mostrar todos” ou busque por pelo menos 2 caracteres.</p>`;
    updateListControls();
  }

  function updateTournamentFilterButtons() {
    $all("[data-admin-action='filter-tournaments']").forEach((button) => {
      const value = button.dataset.tournamentStatus || "";
      button.classList.toggle("is-active", value === String(state.tournamentStatusFilter || ""));
    });
  }

  function setStatus(message, tone = "muted") {
    const el = $("#sbwAdminSessionStatus");
    if (!el) return;

    el.innerHTML = message;
    el.dataset.tone = tone;
  }

  function showGate(message, isError = false) {
    const gate = $("#sbwAdminGate");
    const shell = $("#sbwAdminShell");

    if (shell) shell.hidden = true;

    if (gate) {
      gate.hidden = false;
      gate.innerHTML = `
        <div class="sbw-admin-message ${isError ? "sbw-admin-message--error" : ""}">
          ${message}
        </div>
      `;
    }
  }

  function showShell() {
    const gate = $("#sbwAdminGate");
    const shell = $("#sbwAdminShell");

    if (gate) gate.hidden = true;
    if (shell) shell.hidden = false;
  }

  function canAccessAdmin(context) {
    return Boolean(
      context?.permissions?.isMasterAdmin ||
      context?.permissions?.isAdminSbw ||
      context?.permissions?.canManagePermissions
    );
  }

  function canGrantMaster(context) {
    return Boolean(context?.permissions?.isMasterAdmin);
  }

  function addLog(message, tone = "info") {
    state.logs.unshift({
      message,
      tone,
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    });

    state.logs = state.logs.slice(0, 30);
    renderLogs();
  }

  function renderLogs() {
    const root = $("#sbwAdminLog");
    if (!root) return;

    if (!state.logs.length) {
      root.innerHTML = `<p class="sbw-admin-muted">Nenhuma ação registrada nesta sessão.</p>`;
      return;
    }

    root.innerHTML = state.logs
      .map((item) => {
        return `
          <div class="sbw-admin-log__item" data-tone="${escapeHtml(item.tone)}">
            <strong>${escapeHtml(item.time)}</strong> — ${escapeHtml(item.message)}
          </div>
        `;
      })
      .join("");
  }


  function getSupabaseErrorTone(error, optional = false) {
    if (!error) return "success";

    const code = String(error.code || "");
    const message = String(error.message || "").toLowerCase();

    if (optional && (code === "42P01" || code === "PGRST205" || message.includes("does not exist") || message.includes("not found"))) {
      return "warning";
    }

    if (message.includes("permission") || message.includes("policy") || message.includes("rls") || code === "42501") {
      return "warning";
    }

    return "error";
  }

  function explainSupabaseError(error, optional = false) {
    if (!error) return "Leitura permitida.";

    const code = error.code ? ` (${error.code})` : "";
    const message = error.message || "Erro sem mensagem.";

    if (optional && (String(error.code || "") === "42P01" || String(error.code || "") === "PGRST205")) {
      return `Tabela opcional ausente ou não exposta${code}.`;
    }

    return `${message}${code}`;
  }

  function renderRlsResults(results = state.rlsResults) {
    const root = $("#sbwAdminRlsResults");
    if (!root) return;

    if (!results.length) {
      root.innerHTML = `<p class="sbw-admin-muted">Nenhum diagnóstico executado ainda.</p>`;
      return;
    }

    root.innerHTML = results
      .map((item) => {
        return `
          <article class="sbw-admin-diagnostic" data-tone="${escapeHtml(item.tone)}">
            <div>
              <strong>${escapeHtml(item.label)}</strong>
              <small>${escapeHtml(item.target || "")}</small>
            </div>
            <span>${escapeHtml(item.status)}</span>
            <p>${escapeHtml(item.detail || "")}</p>
          </article>
        `;
      })
      .join("");
  }

  async function runSafeSelectDiagnostic(table, label, options = {}) {
    const target = options.target || table;
    const optional = Boolean(options.optional);
    const columns = options.columns || "*";

    if (!state.client) {
      return {
        label,
        target,
        status: "Erro",
        tone: "error",
        detail: "Cliente Supabase não disponível."
      };
    }

    try {
      const result = await state.client
        .from(table)
        .select(columns)
        .limit(1);

      if (result.error) {
        return {
          label,
          target,
          status: optional ? "Atenção" : "Bloqueado/erro",
          tone: getSupabaseErrorTone(result.error, optional),
          detail: explainSupabaseError(result.error, optional)
        };
      }

      return {
        label,
        target,
        status: "OK",
        tone: "success",
        detail: `Leitura permitida. Registros retornados: ${(result.data || []).length}.`
      };
    } catch (error) {
      return {
        label,
        target,
        status: optional ? "Atenção" : "Erro",
        tone: getSupabaseErrorTone(error, optional),
        detail: explainSupabaseError(error, optional)
      };
    }
  }

  async function runRlsDiagnostics() {
    addLog("Diagnóstico Supabase/RLS iniciado.");

    const results = [];

    if (!state.client) {
      results.push({
        label: "Supabase client",
        target: "window.SBWSupabase.client",
        status: "Erro",
        tone: "error",
        detail: "Cliente Supabase não carregado."
      });
      state.rlsResults = results;
      renderRlsResults(results);
      return;
    }

    try {
      const session = await state.client.auth.getSession();
      const user = session?.data?.session?.user || null;

      results.push({
        label: "Sessão Auth",
        target: "supabase.auth.getSession()",
        status: user ? "OK" : "Sem sessão",
        tone: user ? "success" : "warning",
        detail: user ? `Usuário autenticado: ${user.email || user.id}` : "Nenhum usuário autenticado no navegador atual."
      });
    } catch (error) {
      results.push({
        label: "Sessão Auth",
        target: "supabase.auth.getSession()",
        status: "Erro",
        tone: "error",
        detail: explainSupabaseError(error)
      });
    }

    const profileTable = getTable("profiles", "profiles");
    const teamsTable = getTable("teams", "teams");
    const membersTable = getTable("teamMembers", "team_members");
    const invitesTable = getTable("teamInvites", "team_invites");

    results.push(await runSafeSelectDiagnostic(profileTable, "Leitura de perfis", { target: profileTable }));
    results.push(await runSafeSelectDiagnostic(teamsTable, "Leitura de equipes", { target: teamsTable }));
    results.push(await runSafeSelectDiagnostic(membersTable, "Leitura de membros", { target: membersTable, optional: true }));
    results.push(await runSafeSelectDiagnostic(invitesTable, "Leitura de convites", { target: invitesTable, optional: true }));
    results.push(await runSafeSelectDiagnostic("organizer_permissions", "Permissões de organizador", { target: "organizer_permissions", optional: true }));
    results.push(await runSafeSelectDiagnostic("site_permissions", "Permissões globais", { target: "site_permissions", optional: true }));

    const context = window.SBWSessionContext?.getCachedContext?.() || state.context;
    const roles = context?.permissions?.roles || [];

    results.push({
      label: "Contexto SBW",
      target: "SBWSessionContext",
      status: context?.user ? "OK" : "Atenção",
      tone: context?.user ? "success" : "warning",
      detail: context?.user ? `Roles detectadas: ${roles.length ? roles.join(", ") : "nenhuma role explícita"}.` : "Contexto sem usuário carregado."
    });

    state.rlsResults = results;
    renderRlsResults(results);

    const warnings = results.filter((item) => item.tone !== "success").length;
    addLog(`Diagnóstico concluído com ${warnings} atenção/erro(s).`, warnings ? "warning" : "info");
  }

  async function loadProfilesFromSupabase() {
    if (!state.client) return [];

    try {
      const result = await state.client
        .from(getTable("profiles", "profiles"))
        .select("*")
        .limit(500);

      if (result.error) throw result.error;
      return result.data || [];
    } catch (error) {
      console.warn("[SBW Admin] Falha ao carregar profiles no Supabase:", error);
      return [];
    }
  }

  async function loadProfilesFromFallback() {
    try {
      if (window.SBWProfilesStorage?.getProfilesAsync) {
        return await window.SBWProfilesStorage.getProfilesAsync();
      }

      if (window.SBWProfilesStorage?.getProfiles) {
        return window.SBWProfilesStorage.getProfiles();
      }
    } catch (error) {
      console.warn("[SBW Admin] Falha ao carregar profiles no fallback:", error);
    }

    return [];
  }

  async function loadTeams() {
    try {
      const storage = window.SBWTeamsStorage || null;

      if (typeof storage?.getAllTeamsForAdmin === "function") {
        return await storage.getAllTeamsForAdmin();
      }

      if (typeof storage?.getAllTeamsForSession === "function") {
        return await storage.getAllTeamsForSession();
      }

      if (typeof storage?.getAllTeams === "function") {
        return await storage.getAllTeams({ publicOnly: false });
      }
    } catch (error) {
      console.warn("[SBW Admin] Falha ao carregar equipes:", error);
    }

    return [];
  }

  async function loadTournamentsForAdmin() {
    if (!state.client) return [];

    try {
      const rpcResult = await state.client.rpc("sbw_admin_list_tournaments");

      if (!rpcResult.error && Array.isArray(rpcResult.data)) {
        return rpcResult.data.map(normalizeTournamentFromAdminRow);
      }
    } catch (error) {
      console.warn("[SBW Admin] RPC sbw_admin_list_tournaments indisponível, tentando leitura direta:", error);
    }

    try {
      const table = getTable("tournaments", "tournaments");
      const result = await state.client
        .from(table)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (result.error) throw result.error;
      return (result.data || []).map(normalizeTournamentFromAdminRow);
    } catch (error) {
      console.warn("[SBW Admin] Falha ao carregar torneios:", error);
      return [];
    }
  }

  async function loadOrganizerPermissions() {
    if (!state.client) return [];

    try {
      const rpcResult = await state.client.rpc("sbw_admin_list_organizer_permissions");

      if (!rpcResult.error && Array.isArray(rpcResult.data)) {
        return rpcResult.data;
      }
    } catch (error) {
      // A RPC pode ainda não existir se o SQL da versão não foi rodado. Tentamos leitura direta abaixo.
    }

    try {
      const result = await state.client
        .from("organizer_permissions")
        .select("*")
        .limit(1000);

      if (result.error) throw result.error;
      return result.data || [];
    } catch (error) {
      return [];
    }
  }


  async function loadTournamentOrganizersForAdmin() {
    if (!state.client) return [];

    try {
      const rpcResult = await state.client.rpc("sbw_admin_list_tournament_organizers");

      if (!rpcResult.error && Array.isArray(rpcResult.data)) {
        return rpcResult.data.map(normalizeOrganizerEntityFromAdminRow);
      }
    } catch (error) {
      console.warn("[SBW Admin] RPC sbw_admin_list_tournament_organizers indisponível, tentando leitura direta:", error);
    }

    try {
      const result = await state.client
        .from("tournament_organizers")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (result.error) throw result.error;
      return (result.data || []).map(normalizeOrganizerEntityFromAdminRow);
    } catch (error) {
      console.warn("[SBW Admin] Falha ao carregar organizações de torneios:", error);
      return [];
    }
  }

  function indexOrganizerPermissions(rows = []) {
    const map = new Map();

    rows.forEach((row) => {
      [
        row?.auth_user_id,
        row?.user_id,
        row?.profile_id,
        row?.profile_slug,
        row?.slug,
        row?.email,
        row?.user_email
      ].forEach((value) => {
        const key = String(value || "").trim();
        if (key) map.set(key, row);
      });
    });

    return map;
  }

  function countApprovedOrganizerPermissions(rows = []) {
    return rows.filter(organizerPermissionCanCreateOrganization).length;
  }

  async function refreshData() {
    const [supabaseProfiles, fallbackProfiles, teams, tournaments, organizerPermissionRows, tournamentOrganizers, analyticsSummary] = await Promise.all([
      loadProfilesFromSupabase(),
      loadProfilesFromFallback(),
      loadTeams(),
      loadTournamentsForAdmin(),
      loadOrganizerPermissions(),
      loadTournamentOrganizersForAdmin(),
      loadAnalyticsSummary()
    ]);

    state.analyticsSummary = analyticsSummary;
    state.organizerPermissionRows = Array.isArray(organizerPermissionRows) ? organizerPermissionRows : [];
    state.tournamentOrganizers = Array.isArray(tournamentOrganizers)
      ? tournamentOrganizers.sort((a, b) => String(getOrganizerEntityName(a)).localeCompare(String(getOrganizerEntityName(b)), "pt-BR"))
      : [];
    state.organizerPermissions = indexOrganizerPermissions(state.organizerPermissionRows);
    const organizerCount = state.tournamentOrganizers.length || countApprovedOrganizerPermissions(state.organizerPermissionRows);

    const profilesByKey = new Map();

    [...supabaseProfiles, ...fallbackProfiles].forEach((profile) => {
      const key = getProfileKey(profile) || profile?.id || profile?.auth_user_id || JSON.stringify(profile);
      if (key && !profilesByKey.has(key)) profilesByKey.set(key, profile);
    });

    state.profiles = sortProfilesByName(Array.from(profilesByKey.values()));
    state.teams = sortTeamsByName(Array.isArray(teams) ? teams.filter((team) => !isTeamDeleted(team)) : []);
    state.tournaments = Array.isArray(tournaments)
      ? tournaments
          .filter((tournament) => !isTournamentDeletedForAdmin(tournament))
          .sort((a, b) => String(b.createdAt || b.startsAt || "").localeCompare(String(a.createdAt || a.startsAt || "")))
      : [];

    renderStats(organizerCount);
    renderOrganizerExternalPretest();
    renderOrganizerPermissionResults();
    renderOrganizerEntityResults();
    renderAnalyticsPanel();
  }

  function renderStats(organizerCount = 0) {
    const stats = {
      profiles: state.profiles.length,
      teams: state.teams.length,
      verifiedTeams: state.teams.filter(isVerifiedTeam).length,
      organizers: organizerCount,
      tournaments: state.tournaments.length
    };

    Object.entries(stats).forEach(([key, value]) => {
      const el = $(`[data-sbw-admin-stat="${key}"]`);
      if (el) el.textContent = String(value);
    });
  }


  function safeNumber(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
  }

  function formatShortNumber(value) {
    return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(safeNumber(value));
  }

  function formatPercent(value) {
    return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(safeNumber(value))}%`;
  }

  function getTodayDateInputValue() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
  }

  function isDateInputValue(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
  }

  function formatDateInputLabel(value) {
    if (!isDateInputValue(value)) return "—";
    const [year, month, day] = String(value).split("-");
    return `${day}/${month}/${year}`;
  }

  function getAnalyticsPeriodLabel(summary) {
    const period = asObject(summary?.period);
    const start = period.start_date || state.analyticsStartDate;
    const end = period.end_date || state.analyticsEndDate;

    if ((summary?.mode || state.analyticsRangeMode) === "custom" && isDateInputValue(start) && isDateInputValue(end)) {
      return `${formatDateInputLabel(start)} a ${formatDateInputLabel(end)}`;
    }

    return `${escapeHtml(summary?.days || state.analyticsDays || 7)} dias`;
  }

  function getAnalyticsRpcParams() {
    const params = {
      p_days: state.analyticsDays || 7,
      p_start_date: null,
      p_end_date: null
    };

    if (state.analyticsRangeMode === "custom" && isDateInputValue(state.analyticsStartDate) && isDateInputValue(state.analyticsEndDate)) {
      params.p_start_date = state.analyticsStartDate;
      params.p_end_date = state.analyticsEndDate;
    }

    return params;
  }

  function normalizeAnalyticsSummary(payload) {
    const source = payload && typeof payload === "object" ? payload : {};

    if (source.ok === false) {
      return {
        ok: false,
        message: source.message || "Analytics indisponível.",
        totals: {},
        daily: [],
        pages: [],
        categories: [],
        devices: [],
        pwa: [],
        locations: [],
        countries: [],
        states: [],
        regions: [],
        quality: {},
        period: {}
      };
    }

    return {
      ok: true,
      mode: source.mode || state.analyticsRangeMode || "days",
      days: safeNumber(source.days || state.analyticsDays || 7),
      period: asObject(source.period),
      totals: asObject(source.totals),
      daily: Array.isArray(source.daily) ? source.daily : [],
      pages: Array.isArray(source.pages) ? source.pages : [],
      categories: Array.isArray(source.categories) ? source.categories : [],
      devices: Array.isArray(source.devices) ? source.devices : [],
      pwa: Array.isArray(source.pwa) ? source.pwa : [],
      locations: Array.isArray(source.locations) ? source.locations : [],
      countries: Array.isArray(source.countries) ? source.countries : [],
      states: Array.isArray(source.states) ? source.states : [],
      regions: Array.isArray(source.regions) ? source.regions : [],
      quality: asObject(source.quality)
    };
  }

  async function loadAnalyticsSummary() {
    if (!state.client) return normalizeAnalyticsSummary({ ok: false, message: "Supabase não carregado." });

    try {
      const result = await state.client.rpc("sbw_admin_get_site_analytics_summary", getAnalyticsRpcParams());

      if (result.error) throw result.error;
      return normalizeAnalyticsSummary(result.data || {});
    } catch (error) {
      return normalizeAnalyticsSummary({
        ok: false,
        message: error?.message || "Não foi possível carregar o resumo de analytics. Verifique se o SQL da v1.6.80.9 foi rodado."
      });
    }
  }

  function getPracticalPageLabel(item) {
    const path = String(item?.path || "").toLowerCase();
    const rawLabel = String(item?.label || item?.page_title || "").trim();
    const normalizedLabels = {
      home: "Início",
      admin: "Admin Master",
      teams: "Equipes",
      team_public: "Perfil público de equipe",
      team_my: "Minha equipe",
      team_create: "Criar equipe",
      tournament_list: "Torneios",
      tournament_detail: "Detalhe do torneio",
      tournament_create: "Criar torneio",
      organizers: "Organizadores",
      rankings: "Rankings",
      profiles: "Perfis",
      profile_public: "Perfil público",
      communities: "Comunidades",
      creators: "Creators",
      links: "Links",
      news: "Notícias",
      news_detail: "Notícia",
      shop: "Loja",
      transfers: "Transferências",
      about: "Sobre"
    };

    if (normalizedLabels[path]) return normalizedLabels[path];
    if (rawLabel) {
      return rawLabel
        .replace(/\s*\|\s*-?SBW-?.*$/i, "")
        .replace(/\s*\|\s*SaberWolf.*$/i, "")
        .trim() || rawLabel;
    }

    if (path === "/" || path.endsWith("/index.html") || path === "index.html") return "Início";
    if (path.includes("/admin/")) return "Admin Master";
    if (path.includes("/equipes/minha-equipe")) return "Minha equipe";
    if (path.includes("/equipes/criar-equipe") || path.includes("/equipes/criar-subequipe")) return "Criar equipe";
    if (path.includes("/equipes/equipes")) return "Equipes";
    if (path.includes("/equipes/equipe")) return "Perfil público de equipe";
    if (path.includes("/torneios/criar")) return "Criar torneio";
    if (path.includes("/torneios/torneio")) return "Detalhe do torneio";
    if (path.includes("/torneios/")) return "Torneios";
    if (path.includes("/organizadores/")) return "Organizadores";
    if (path.includes("/rankings/")) return "Rankings";
    if (path.includes("/perfis/perfil")) return "Perfil público";
    if (path.includes("/perfis/")) return "Perfis";
    if (path.includes("/comunidades/")) return "Comunidades";
    if (path.includes("/creators/")) return "Creators";
    if (path.includes("/links/dlucca")) return "Links · D’Lucca";
    if (path.includes("/links/")) return "Links oficiais";
    if (path.includes("/blog/noticia")) return "Notícia";
    if (path.includes("/blog/")) return "Notícias";
    if (path.includes("/pages/loja") || path.includes("/loja")) return "Loja";
    if (path.includes("/transferencias/")) return "Transferências";
    if (path.includes("/sobre")) return "Sobre";

    return path || "Página não informada";
  }

  function getCategoryLabel(value) {
    const map = {
      home: "Início",
      admin: "Admin",
      equipes: "Equipes",
      torneios: "Torneios",
      organizadores: "Organizadores",
      perfis: "Perfis",
      rankings: "Rankings",
      noticias: "Notícias",
      creators: "Creators",
      comunidades: "Comunidades",
      links: "Links",
      loja: "Loja",
      site: "Site"
    };
    const key = String(value || "").toLowerCase();
    return map[key] || value || "—";
  }

  function getDeviceLabel(value) {
    const map = { desktop: "Desktop", mobile: "Celular", tablet: "Tablet", unknown: "Não identificado" };
    const key = String(value || "").toLowerCase();
    return map[key] || value || "—";
  }

  function renderAnalyticsBarList(items, labelKey, valueKey, emptyText, options = {}) {
    const source = Array.isArray(items) ? items : [];
    const total = source.reduce((sum, item) => sum + safeNumber(item?.[valueKey]), 0);

    if (!source.length || total <= 0) {
      return `<p class="sbw-admin-muted">${escapeHtml(emptyText || "Sem dados suficientes.")}</p>`;
    }

    return `
      <div class="sbw-admin-analytics-bars">
        ${source.map((item) => {
          const rawLabel = item?.[labelKey] || "—";
          const label = typeof options.formatLabel === "function" ? options.formatLabel(item, rawLabel) : rawLabel;
          const value = safeNumber(item?.[valueKey]);
          const percent = total > 0 ? Math.max(3, Math.round((value / total) * 100)) : 0;

          return `
            <div class="sbw-admin-analytics-bar-row">
              <div class="sbw-admin-analytics-bar-row__head">
                <span title="${escapeHtml(rawLabel)}">${escapeHtml(label)}</span>
                <strong>${escapeHtml(formatShortNumber(value))}</strong>
              </div>
              <div class="sbw-admin-analytics-bar" aria-hidden="true">
                <span style="width: ${escapeHtml(percent)}%"></span>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderAnalyticsDailyChart(items) {
    const source = Array.isArray(items) ? items : [];
    const max = Math.max(1, ...source.map((item) => safeNumber(item?.views)));

    if (!source.length || source.every((item) => safeNumber(item?.views) <= 0)) {
      return `<p class="sbw-admin-muted">Ainda não há page views suficientes para formar o gráfico diário.</p>`;
    }

    return `
      <div class="sbw-admin-analytics-chart" aria-label="Visualizações por dia">
        ${source.map((item) => {
          const views = safeNumber(item?.views);
          const percent = Math.max(6, Math.round((views / max) * 100));
          const label = String(item?.date || "").slice(5).replace("-", "/");

          return `
            <div class="sbw-admin-analytics-chart__item" title="${escapeHtml(item?.date || "")} · ${escapeHtml(formatShortNumber(views))} views">
              <span style="height: ${escapeHtml(percent)}%"></span>
              <small>${escapeHtml(label)}</small>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderAnalyticsDataQuality(summary) {
    const quality = asObject(summary?.quality);
    const total = safeNumber(quality.page_views || summary?.totals?.page_views);
    const geoKnown = safeNumber(quality.geo_known_views);
    const geoUnknown = Math.max(0, safeNumber(quality.geo_unknown_views || (total - geoKnown)));
    const ipLookup = safeNumber(quality.ip_lookup_views);
    const geoRate = total > 0 ? (geoKnown / total) * 100 : 0;

    if (total <= 0) return "";

    return `
      <div class="sbw-admin-message sbw-admin-message--info sbw-admin-analytics-quality">
        <strong>Qualidade dos dados:</strong>
        origem geográfica identificada em ${escapeHtml(formatShortNumber(geoKnown))}/${escapeHtml(formatShortNumber(total))} page views (${escapeHtml(formatPercent(geoRate))}).
        IP temporário usado em ${escapeHtml(formatShortNumber(ipLookup))} page views; ${escapeHtml(formatShortNumber(geoUnknown))} page views ainda estão sem país/estado identificado.
      </div>
    `;
  }

  function updateAnalyticsButtons() {
    $all("[data-admin-action='analytics-days']").forEach((button) => {
      const isActive = state.analyticsRangeMode !== "custom" && Number(button.dataset.analyticsDays || 0) === Number(state.analyticsDays || 7);
      button.classList.toggle("is-active", isActive);
    });

    const form = $("[data-sbw-admin-analytics-range]");
    if (form) {
      if (form.start && state.analyticsStartDate) form.start.value = state.analyticsStartDate;
      if (form.end && state.analyticsEndDate) form.end.value = state.analyticsEndDate;
      form.classList.toggle("is-active", state.analyticsRangeMode === "custom");
    }
  }

  function renderAnalyticsPanel() {
    const root = $("#sbwAdminAnalyticsResults");
    if (!root) return;

    updateAnalyticsButtons();

    const summary = state.analyticsSummary;
    if (!summary) {
      root.innerHTML = `<p class="sbw-admin-muted">Carregando analytics...</p>`;
      return;
    }

    if (summary.ok === false) {
      root.innerHTML = `
        <div class="sbw-admin-message sbw-admin-message--warning">
          <strong>Analytics ainda não disponível.</strong><br />
          ${escapeHtml(summary.message || "Rode o SQL da v1.6.80.9 no Supabase e atualize esta aba.")}
        </div>
      `;
      return;
    }

    const totals = summary.totals || {};
    const totalViews = safeNumber(totals.page_views);
    const pwaViews = safeNumber(totals.pwa_views);
    const pwaRate = totalViews > 0 ? (pwaViews / totalViews) * 100 : 0;

    root.innerHTML = `
      <section class="sbw-admin-analytics-summary" aria-label="Resumo do analytics">
        <article><span>Eventos</span><strong>${escapeHtml(formatShortNumber(totals.events))}</strong></article>
        <article><span>Page views</span><strong>${escapeHtml(formatShortNumber(totalViews))}</strong></article>
        <article><span>Cliques</span><strong>${escapeHtml(formatShortNumber(totals.clicks))}</strong></article>
        <article><span>PWA/App</span><strong>${escapeHtml(formatPercent(pwaRate))}</strong></article>
      </section>

      ${renderAnalyticsDataQuality(summary)}

      <section class="sbw-admin-analytics-grid">
        <article class="sbw-admin-analytics-card sbw-admin-analytics-card--wide">
          <div class="sbw-admin-analytics-card__head">
            <h3>Visualizações por dia</h3>
            <span>${getAnalyticsPeriodLabel(summary)}</span>
          </div>
          ${renderAnalyticsDailyChart(summary.daily)}
        </article>

        <article class="sbw-admin-analytics-card">
          <div class="sbw-admin-analytics-card__head"><h3>Top 10 páginas</h3></div>
          ${renderAnalyticsBarList(summary.pages, "path", "views", "Sem páginas registradas ainda.", { formatLabel: (item) => getPracticalPageLabel(item) })}
        </article>

        <article class="sbw-admin-analytics-card">
          <div class="sbw-admin-analytics-card__head"><h3>Top categorias</h3></div>
          ${renderAnalyticsBarList(summary.categories, "category", "views", "Sem categorias registradas ainda.", { formatLabel: (_item, value) => getCategoryLabel(value) })}
        </article>

        <article class="sbw-admin-analytics-card">
          <div class="sbw-admin-analytics-card__head"><h3>Dispositivos</h3></div>
          ${renderAnalyticsBarList(summary.devices, "device", "views", "Sem dados de dispositivo ainda.", { formatLabel: (_item, value) => getDeviceLabel(value) })}
        </article>

        <article class="sbw-admin-analytics-card">
          <div class="sbw-admin-analytics-card__head"><h3>App vs navegador</h3></div>
          ${renderAnalyticsBarList(summary.pwa, "label", "views", "Sem dados de PWA ainda.")}
        </article>

        <article class="sbw-admin-analytics-card">
          <div class="sbw-admin-analytics-card__head"><h3>Top 10 países</h3></div>
          <p class="sbw-admin-analytics-card__hint">Origem aproximada por IP temporário. O IP bruto não é salvo no banco da -SBW-.</p>
          ${renderAnalyticsBarList(summary.countries, "label", "views", "Sem país identificado nos eventos deste período.")}
        </article>

        <article class="sbw-admin-analytics-card">
          <div class="sbw-admin-analytics-card__head"><h3>Top 10 estados</h3></div>
          <p class="sbw-admin-analytics-card__hint">Para Brasil, mostra UF/estado quando a consulta aproximada conseguir identificar.</p>
          ${renderAnalyticsBarList(summary.states, "label", "views", "Sem estado identificado nos eventos deste período.")}
        </article>

        <article class="sbw-admin-analytics-card">
          <div class="sbw-admin-analytics-card__head"><h3>Regiões BR</h3></div>
          <p class="sbw-admin-analytics-card__hint">Agrupamento nacional por região brasileira, quando o estado for identificado.</p>
          ${renderAnalyticsBarList(summary.regions, "label", "views", "Sem região brasileira identificada neste período.")}
        </article>
      </section>
    `;
  }

  async function refreshAnalyticsPanel() {
    const root = $("#sbwAdminAnalyticsResults");
    if (root) root.innerHTML = `<p class="sbw-admin-muted">Atualizando analytics...</p>`;
    state.analyticsSummary = await loadAnalyticsSummary();
    renderAnalyticsPanel();
  }

  function getOrganizerExternalPretestItems() {
    const rows = getActiveOrganizerPermissionRows();
    const hasPermission = rows.length > 0;
    const firstTarget = hasPermission ? getOrganizerPermissionTarget(null, rows[0]) : null;

    return {
      rows,
      firstTarget,
      items: [
        {
          label: "Conta parceira cadastrada na plataforma",
          done: state.profiles.length > 0,
          hint: "Confirme se a conta da Rinha Online aparece na busca de usuários antes de liberar a permissão."
        },
        {
          label: "Permissão de organizador concedida",
          done: hasPermission,
          hint: hasPermission
            ? `${firstTarget?.displayName || "Organizador"} possui permissão ativa para criar organização.`
            : "Busque a conta parceira na aba Usuários e use ‘Permitir criar organização’."
        },
        {
          label: "Conta comum continua bloqueada",
          done: true,
          hint: "A permissão é individual. Usuários comuns continuam sem criar organização ou torneio."
        },
        {
          label: "Próximo passo será feito pela organização",
          done: hasPermission,
          hint: "Depois da permissão, a Rinha deve acessar o painel do organizador, criar a organização e criar torneios vinculados."
        },
        {
          label: "Teste real deve validar organização + torneio + inscrição/check-in",
          done: hasPermission,
          hint: "A -SBW- acompanha o fluxo, mas não precisa criar tudo manualmente pela organização."
        }
      ]
    };
  }

  function renderOrganizerExternalPretest() {
    const root = $("#sbwAdminOrganizerPretest .sbw-admin-pretest__body");
    if (!root) return;

    const pretest = getOrganizerExternalPretestItems();
    const completed = pretest.items.filter((item) => item.done).length;
    const total = pretest.items.length;
    const tone = completed === total ? "success" : pretest.rows.length ? "warning" : "neutral";

    root.innerHTML = `
      <div class="sbw-admin-pretest-summary" data-tone="${escapeHtml(tone)}">
        <strong>${escapeHtml(completed)} / ${escapeHtml(total)} itens prontos</strong>
        <span>${pretest.rows.length ? `${escapeHtml(pretest.rows.length)} organizador(es) autorizado(s).` : "Nenhum organizador externo autorizado ainda."}</span>
      </div>

      <ul class="sbw-admin-pretest-list">
        ${pretest.items.map((item) => `
          <li data-done="${item.done ? "true" : "false"}">
            <span>${item.done ? "✓" : "!"}</span>
            <div>
              <strong>${escapeHtml(item.label)}</strong>
              <small>${escapeHtml(item.hint)}</small>
            </div>
          </li>
        `).join("")}
      </ul>
    `;
  }

  function buildOrganizerExternalPretestReport() {
    const pretest = getOrganizerExternalPretestItems();
    const completed = pretest.items.filter((item) => item.done).length;
    const lines = [
      "Pré-check Admin Master — organizador externo",
      "",
      `Status: ${completed}/${pretest.items.length} itens prontos`,
      `Organizadores autorizados: ${pretest.rows.length}`,
      "",
      "Itens:",
      ...pretest.items.map((item) => `${item.done ? "[OK]" : "[PENDENTE]"} ${item.label} — ${item.hint}`),
      "",
      "Regra operacional:",
      "- Conta comum não cria organização nem torneio.",
      "- A conta parceira precisa receber permissão de organizador pela -SBW-.",
      "- Depois disso, a organização cria o próprio perfil organizacional e seus torneios vinculados.",
      "- A -SBW- acompanha o teste, mas não deve operar manualmente todo o fluxo pela parceira."
    ];

    return lines.join("\n");
  }

  async function copyTextToClipboard(text, fallbackLabel) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        addLog(`${fallbackLabel || "Texto"} copiado para a área de transferência.`);
        return;
      }
    } catch (error) {
      console.warn("[SBW Admin] Falha ao copiar via clipboard:", error);
    }

    window.prompt("Copie o texto abaixo:", text);
    addLog(`${fallbackLabel || "Texto"} aberto para cópia manual.`, "warning");
  }

  function renderProfileResults(profiles, options = {}) {
    const root = $("#sbwAdminProfileResults");
    if (!root) return;

    const safeProfiles = Array.isArray(profiles) ? profiles : [];
    const limit = Number.isFinite(options.limit) ? Number(options.limit) : 40;
    const visibleProfiles = limit > 0 ? safeProfiles.slice(0, limit) : safeProfiles;

    if (!safeProfiles.length) {
      root.innerHTML = `<p class="sbw-admin-muted">Nenhum perfil encontrado.</p>`;
      return;
    }

    root.innerHTML = `
      <p class="sbw-admin-muted">
        ${visibleProfiles.length} de ${safeProfiles.length} perfil(is) exibido(s).
      </p>
      ${visibleProfiles.map((profile) => renderProfileCard(profile)).join("")}
    `;
  }

  function renderProfileCard(profile) {
    const name = getProfileName(profile);
    const key = getProfileKey(profile);
    const email = profile?.email || profile?.metadata?.email || profile?.auth_email || "";
    const initial = String(name || "S").charAt(0).toUpperCase();
    const badges = getProfileBadges(profile);
    const profileId = profile?.id || key;
    const authUserId = getProfileAuthUserId(profile);
    const organizerPermission = getOrganizerPermissionForProfile(profile);
    const canCreateOrganization = organizerPermissionCanCreateOrganization(organizerPermission);

    return `
      <article class="sbw-admin-result-card" data-profile-id="${escapeHtml(profileId)}">
        <div class="sbw-admin-result-main">
          <div class="sbw-admin-avatar">${escapeHtml(initial)}</div>

          <div class="sbw-admin-result-title">
            <strong>${escapeHtml(name)}</strong>
            <small>${escapeHtml([key, email, authUserId].filter(Boolean).join(" · "))}</small>
          </div>

          <div class="sbw-admin-badges">
            ${badges.length ? badges.map((badge) => `<span class="sbw-admin-badge sbw-admin-badge--success">${escapeHtml(badge)}</span>`).join("") : `<span class="sbw-admin-badge">Usuário</span>`}
          </div>
        </div>

        <div class="sbw-admin-actions">
          <a class="sbw-admin-button sbw-admin-button--ghost" href="${escapeHtml(window.SBWRoutes?.profile ? window.SBWRoutes.profile(key) : `../perfis/perfil.html?u=${encodeURIComponent(key)}`)}" target="_blank" rel="noopener">
            Ver perfil
          </a>

          <button class="sbw-admin-button sbw-admin-button--ghost" type="button" data-admin-action="toggle-profile-permission" data-permission="isAdminSbw" data-profile-key="${escapeHtml(profileId)}">
            Admin SBW
          </button>

          ${canGrantMaster(state.context) ? `
            <button class="sbw-admin-button sbw-admin-button--danger" type="button" data-admin-action="toggle-profile-permission" data-permission="isMasterAdmin" data-profile-key="${escapeHtml(profileId)}">
              Master
            </button>
          ` : ""}

          ${shouldShowApproveOrganizer(profile) ? `
            <button class="sbw-admin-button sbw-admin-button--ghost" type="button" data-admin-action="approve-organizer" data-profile-key="${escapeHtml(profileId)}">
              Permitir criar organização
            </button>
          ` : ""}

          ${canCreateOrganization ? `
            <button class="sbw-admin-button sbw-admin-button--danger" type="button" data-admin-action="revoke-organizer" data-profile-key="${escapeHtml(profileId)}">
              Remover permissão de organização
            </button>
          ` : ""}
        </div>
      </article>
    `;
  }

  function renderTeamResults(teams, options = {}) {
    const root = $("#sbwAdminTeamResults");
    if (!root) return;

    const safeTeams = Array.isArray(teams) ? teams : [];
    const limit = Number.isFinite(options.limit) ? Number(options.limit) : 60;
    const visibleTeams = limit > 0 ? safeTeams.slice(0, limit) : safeTeams;

    if (!safeTeams.length) {
      root.innerHTML = `<p class="sbw-admin-muted">Nenhuma equipe encontrada.</p>`;
      return;
    }

    root.innerHTML = `
      <p class="sbw-admin-muted">
        ${visibleTeams.length} de ${safeTeams.length} equipe(s) exibida(s).
      </p>
      ${visibleTeams.map((team) => renderTeamCard(team)).join("")}
    `;
  }

  function renderTeamCard(team) {
    const key = getTeamKey(team);
    const name = getTeamName(team);
    const tag = getTeamTag(team);
    const verified = isVerifiedTeam(team);
    const deleted = isTeamDeleted(team);
    const memberLimit = team.memberLimit || team.member_limit || (verified ? 100 : 50);
    const modalities = Array.isArray(team.modalities) ? team.modalities.slice(0, 4).join(", ") : "";
    const visibility = team.isPublic === false || team.is_public === false ? "Privada" : "Pública";
    const statusLabel = getTeamStatusLabel(team);
    const captain = team.captainName || team.captain_name || team.captainProfileSlug || team.captain_profile_slug || team.captainUserId || team.captain_user_id || "";

    return `
      <article class="sbw-admin-result-card" data-team-key="${escapeHtml(key)}" data-team-state="${deleted ? "deleted" : "active"}">
        <div class="sbw-admin-result-main">
          <div class="sbw-admin-avatar">${escapeHtml(tag || name.charAt(0).toUpperCase())}</div>

          <div class="sbw-admin-result-title">
            <strong>${escapeHtml(name)}</strong>
            <small>${escapeHtml([tag, key, visibility, statusLabel, captain ? `Capitão: ${captain}` : "", modalities].filter(Boolean).join(" · "))}</small>
          </div>

          <div class="sbw-admin-badges">
            <span class="sbw-admin-badge ${verified ? "sbw-admin-badge--success" : ""}">${verified ? "Verificada" : "Comum"}</span>
            <span class="sbw-admin-badge ${deleted ? "sbw-admin-badge--danger" : ""}">${escapeHtml(statusLabel)}</span>
            <span class="sbw-admin-badge">Limite ${escapeHtml(memberLimit)}</span>
          </div>
        </div>

        <div class="sbw-admin-actions">
          <a class="sbw-admin-button sbw-admin-button--ghost" href="${escapeHtml(window.SBWRoutes?.team ? window.SBWRoutes.team(key) : `../equipes/equipe.html?id=${encodeURIComponent(key)}`)}" target="_blank" rel="noopener">
            Ver perfil
          </a>

          <a class="sbw-admin-button sbw-admin-button--ghost" href="${escapeHtml(window.SBWRoutes?.myTeam ? window.SBWRoutes.myTeam(key) : `../equipes/minha-equipe.html?id=${encodeURIComponent(key)}`)}">
            Gerenciar
          </a>

          ${!deleted && !verified ? `
            <button class="sbw-admin-button" type="button" data-admin-action="verify-team" data-team-key="${escapeHtml(key)}">
              Verificar equipe
            </button>
          ` : ""}

          ${!deleted && verified ? `
            <button class="sbw-admin-button sbw-admin-button--danger" type="button" data-admin-action="unverify-team" data-team-key="${escapeHtml(key)}">
              Remover verificação
            </button>
          ` : ""}

          ${!deleted ? `
            <button class="sbw-admin-button sbw-admin-button--ghost" type="button" data-admin-action="admin-team-action" data-team-key="${escapeHtml(key)}" data-team-action="archive">
              Arquivar
            </button>
            <button class="sbw-admin-button sbw-admin-button--danger" type="button" data-admin-action="admin-team-action" data-team-key="${escapeHtml(key)}" data-team-action="delete">
              Excluir definitivo
            </button>
          ` : `
            <span class="sbw-admin-muted">Equipe arquivada/removida da área pública.</span>
          `}
        </div>
      </article>
    `;
  }

  function getFilteredAdminTournaments() {
    const query = normalizeSearch(state.tournamentSearchQuery || "");
    const statusFilter = String(state.tournamentStatusFilter || "").trim();

    return (state.tournaments || []).filter((tournament) => {
      const bucket = getTournamentStatusBucket(tournament);
      const deleted = isTournamentDeletedForAdmin(tournament);

      if (deleted && statusFilter !== "archived") {
        return false;
      }

      if (statusFilter && bucket !== statusFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = normalizeSearch([
        getTournamentName(tournament),
        tournament.gameName,
        tournament.game,
        tournament.slug,
        getTournamentOrganizerLabel(tournament),
        tournament.organizerSlug,
        getTournamentStatusLabel(tournament.status),
        getTournamentFormatLabel(tournament)
      ].join(" "));

      return haystack.includes(query);
    });
  }

  function renderTournamentsList() {
    const root = $("#sbwAdminTournamentResults");
    if (!root) return;

    if (!state.tournamentListExpanded && !state.tournamentSearchQuery && !state.tournamentStatusFilter) {
      resetTournamentResults();
      return;
    }

    const filtered = getFilteredAdminTournaments();
    renderTournamentResults(filtered, { limit: 0 });
    updateListControls();
  }

  function getTournamentAdminSummary(tournaments = []) {
    const items = Array.isArray(tournaments) ? tournaments : [];

    return {
      total: items.length,
      open: items.filter((item) => getTournamentStatusBucket(item) === "open").length,
      running: items.filter((item) => getTournamentStatusBucket(item) === "running").length,
      finished: items.filter((item) => getTournamentStatusBucket(item) === "finished").length,
      archived: items.filter((item) => getTournamentStatusBucket(item) === "archived").length
    };
  }

  function renderTournamentResults(tournaments, options = {}) {
    const root = $("#sbwAdminTournamentResults");
    if (!root) return;

    const safeTournaments = Array.isArray(tournaments) ? tournaments : [];
    const limit = Number.isFinite(options.limit) ? Number(options.limit) : 30;
    const visibleTournaments = limit > 0 ? safeTournaments.slice(0, limit) : safeTournaments;
    const summary = getTournamentAdminSummary(state.tournaments || []);

    if (!safeTournaments.length) {
      root.innerHTML = `
        <div class="sbw-admin-tournament-summary">
          <article><span>Total</span><strong>${escapeHtml(summary.total)}</strong></article>
          <article><span>Abertos</span><strong>${escapeHtml(summary.open)}</strong></article>
          <article><span>Em andamento</span><strong>${escapeHtml(summary.running)}</strong></article>
          <article><span>Arquivados</span><strong>${escapeHtml(summary.archived)}</strong></article>
        </div>
        <p class="sbw-admin-muted">Nenhum torneio encontrado para o filtro atual.</p>
      `;
      return;
    }

    root.innerHTML = `
      <div class="sbw-admin-tournament-summary">
        <article><span>Total</span><strong>${escapeHtml(summary.total)}</strong></article>
        <article><span>Abertos</span><strong>${escapeHtml(summary.open)}</strong></article>
        <article><span>Em andamento</span><strong>${escapeHtml(summary.running)}</strong></article>
        <article><span>Arquivados/removidos</span><strong>${escapeHtml(summary.archived)}</strong></article>
      </div>

      <p class="sbw-admin-muted">
        ${visibleTournaments.length} de ${safeTournaments.length} torneio(s) exibido(s). Ações administrativas são registradas no metadata do torneio.
      </p>
      ${visibleTournaments.map((tournament) => renderTournamentCard(tournament)).join("")}
    `;
  }

  function renderTournamentCard(tournament) {
    const key = getTournamentKey(tournament);
    const dbKey = getTournamentDatabaseKey(tournament) || key;
    const title = getTournamentName(tournament);
    const status = getTournamentStatusValue(tournament);
    const bucket = getTournamentStatusBucket(tournament);
    const statusLabel = getTournamentStatusLabel(status);
    const badgeClass = bucket === "archived" ? "sbw-admin-badge--danger" : bucket === "open" ? "sbw-admin-badge--success" : bucket === "draft" ? "sbw-admin-badge--warning" : "";
    const publicUrl = key
      ? `../torneios/detalhe-torneio.html?id=${encodeURIComponent(key)}`
      : "../torneios/torneios.html";
    const manageUrl = key
      ? `../torneios/editar-organizador.html?torneio=${encodeURIComponent(key)}`
      : "../torneios/editar-organizador.html";
    const participantCount = Number(tournament.participantCount || tournament.currentParticipants || 0) || 0;
    const checkedInCount = Number(tournament.checkedInCount || 0) || 0;
    const maxParticipants = Number(tournament.maxParticipants || 0) || 0;

    return `
      <article class="sbw-admin-result-card sbw-admin-tournament-card" data-tournament-key="${escapeHtml(dbKey)}">
        <div class="sbw-admin-result-main">
          <div class="sbw-admin-avatar">${escapeHtml(String(title || "T").charAt(0).toUpperCase())}</div>

          <div class="sbw-admin-result-title">
            <strong>${escapeHtml(title)}</strong>
            <small>${escapeHtml([key, getTournamentOrganizerLabel(tournament), tournament.gameName || tournament.game].filter(Boolean).join(" · "))}</small>
            <div class="sbw-admin-tournament-meta">
              <span>${escapeHtml(getTournamentFormatLabel(tournament))}</span>
              <span>Início: ${escapeHtml(formatAdminDateTime(tournament.startsAt))}</span>
              <span>Inscritos: ${escapeHtml(participantCount)}${maxParticipants ? `/${escapeHtml(maxParticipants)}` : ""}</span>
              <span>Check-ins: ${escapeHtml(checkedInCount)}</span>
            </div>
          </div>

          <div class="sbw-admin-badges">
            <span class="sbw-admin-badge ${badgeClass}">${escapeHtml(statusLabel)}</span>
            <span class="sbw-admin-badge ${tournament.visibility === "private" ? "sbw-admin-badge--warning" : ""}">${escapeHtml(tournament.visibility === "private" ? "Privado" : "Público")}</span>
          </div>
        </div>

        <div class="sbw-admin-actions">
          <a class="sbw-admin-button sbw-admin-button--ghost" href="${escapeHtml(publicUrl)}" target="_blank" rel="noopener">Ver público</a>
          <a class="sbw-admin-button sbw-admin-button--ghost" href="${escapeHtml(manageUrl)}">Gerenciar</a>

          <button class="sbw-admin-button sbw-admin-button--ghost" type="button" data-admin-action="admin-tournament-action" data-tournament-key="${escapeHtml(dbKey)}" data-tournament-action="draft">
            Rascunho
          </button>
          <button class="sbw-admin-button sbw-admin-button--ghost" type="button" data-admin-action="admin-tournament-action" data-tournament-key="${escapeHtml(dbKey)}" data-tournament-action="hide">
            Ocultar
          </button>
          <button class="sbw-admin-button sbw-admin-button--ghost" type="button" data-admin-action="admin-tournament-action" data-tournament-key="${escapeHtml(dbKey)}" data-tournament-action="publish">
            Publicar
          </button>
          <button class="sbw-admin-button sbw-admin-button--danger" type="button" data-admin-action="admin-tournament-action" data-tournament-key="${escapeHtml(dbKey)}" data-tournament-action="archive">
            Arquivar
          </button>
          <button class="sbw-admin-button sbw-admin-button--danger" type="button" data-admin-action="admin-tournament-action" data-tournament-key="${escapeHtml(dbKey)}" data-tournament-action="delete">
            Excluir definitivo
          </button>
        </div>
      </article>
    `;
  }

  function buildAdminActionMetadata(currentMetadata, action, previous = {}, reason = "") {
    return {
      ...asObject(currentMetadata),
      adminManaged: true,
      adminArchived: action === "archive" ? true : Boolean(asObject(currentMetadata).adminArchived),
      adminDeleted: action === "delete" ? true : Boolean(asObject(currentMetadata).adminDeleted),
      adminLastAction: {
        action,
        previousStatus: previous.status || "",
        previousVisibility: previous.visibility || "",
        reason: reason || "Ação executada pelo Admin Master.",
        at: new Date().toISOString(),
        source: "admin-master-panel"
      }
    };
  }

  async function directUpdateTournamentAdminAction(tournament, safeKey, safeAction) {
    if (!state.client) return false;

    const table = getTable("tournaments", "tournaments");
    const previousStatus = getTournamentStatusValue(tournament || {});
    const previousVisibility = String(tournament?.visibility || tournament?.metadata?.visibility || "public").toLowerCase();
    let nextStatus = previousStatus || "draft";
    let nextVisibility = previousVisibility || "public";

    if (safeAction === "draft") {
      nextStatus = "draft";
      nextVisibility = "private";
    } else if (safeAction === "hide") {
      nextVisibility = "private";
      if (["public", "published", "open"].includes(nextStatus)) nextStatus = "hidden";
    } else if (safeAction === "publish") {
      nextVisibility = "public";
      if (["draft", "archived", "deleted", "hidden", "cancelled", "removed"].includes(nextStatus)) nextStatus = "published";
    } else if (safeAction === "archive") {
      nextStatus = "archived";
      nextVisibility = "private";
    } else if (safeAction === "delete") {
      // Exclusão definitiva deve apagar a linha do banco. O caminho preferencial é a RPC
      // security definer, mas este fallback tenta remover diretamente quando a RLS permitir.
      const deleteAttempts = [];
      if (tournament?.supabaseId) deleteAttempts.push(["id", tournament.supabaseId]);
      if (tournament?.id) deleteAttempts.push(["id", tournament.id]);
      if (tournament?.slug) deleteAttempts.push(["slug", tournament.slug]);
      if (safeKey) {
        deleteAttempts.push(["id", safeKey]);
        deleteAttempts.push(["slug", safeKey]);
      }

      const seenDelete = new Set();
      for (const [column, value] of deleteAttempts) {
        const key = `${column}:${value}`;
        if (!value || seenDelete.has(key)) continue;
        seenDelete.add(key);

        try {
          const result = await state.client
            .from(table)
            .delete()
            .eq(column, value);

          if (!result.error) return true;
        } catch (error) {
          // tenta próximo identificador
        }
      }

      return false;
    }

    const patch = {
      status: nextStatus,
      visibility: nextVisibility,
      metadata: buildAdminActionMetadata(tournament?.metadata, safeAction, { status: previousStatus, visibility: previousVisibility }, "Ação executada pelo Admin Master na central de torneios."),
      updated_at: new Date().toISOString()
    };

    const attempts = [];
    if (tournament?.supabaseId) attempts.push(["id", tournament.supabaseId]);
    if (tournament?.id) attempts.push(["id", tournament.id]);
    if (tournament?.slug) attempts.push(["slug", tournament.slug]);
    if (safeKey) {
      attempts.push(["id", safeKey]);
      attempts.push(["slug", safeKey]);
    }

    const seen = new Set();
    for (const [column, value] of attempts) {
      const key = `${column}:${value}`;
      if (!value || seen.has(key)) continue;
      seen.add(key);

      try {
        const result = await state.client
          .from(table)
          .update(patch)
          .eq(column, value)
          .select("*")
          .maybeSingle();

        if (!result.error && result.data) return true;
      } catch (error) {
        // tenta próximo identificador
      }
    }

    return false;
  }

  async function runAdminTournamentAction(tournamentKey, action) {
    const safeKey = String(tournamentKey || "").trim();
    const safeAction = String(action || "").trim().toLowerCase();

    if (!safeKey || !safeAction) {
      addLog("Torneio ou ação administrativa inválida.", "error");
      return;
    }

    const labels = {
      draft: "marcar como rascunho",
      hide: "ocultar",
      publish: "publicar",
      archive: "arquivar",
      delete: "excluir definitivamente"
    };

    const tournament = (state.tournaments || []).find((item) => {
      return [getTournamentDatabaseKey(item), getTournamentKey(item), item.slug, item.supabaseId, item.id]
        .map((value) => String(value || "").trim())
        .includes(safeKey);
    });

    const name = getTournamentName(tournament || {});
    const isDanger = ["archive", "delete"].includes(safeAction);
    const shouldRun = window.confirm(
      `${isDanger ? "Atenção: " : ""}Deseja ${labels[safeAction] || safeAction} o torneio “${name || safeKey}”?\n\n` +
      "Esta ação é administrativa e será registrada no metadata do torneio."
    );

    if (!shouldRun) return;

    if (!state.client) {
      addLog("Supabase não disponível para ação administrativa em torneio.", "error");
      return;
    }

    try {
      const { data, error } = await state.client.rpc("sbw_admin_manage_tournament", {
        p_tournament: safeKey,
        p_action: safeAction,
        p_reason: "Ação executada pelo Admin Master na central de torneios."
      });

      if (error) throw error;

      const result = data && typeof data === "object" ? data : {};
      addLog(result.message || `Ação ${safeAction} executada no torneio ${name || safeKey}.`);

      if (safeAction === "delete") {
        removeTournamentFromStateByKey(safeKey);
        renderStats(countApprovedOrganizerPermissions(state.organizerPermissionRows));
        renderTournamentsList();
      } else {
        await refreshData();
        renderTournamentsList();
      }
    } catch (error) {
      console.warn("[SBW Admin] Falha na ação administrativa do torneio:", error);

      const fallbackSaved = await directUpdateTournamentAdminAction(tournament, safeKey, safeAction);

      if (fallbackSaved) {
        addLog(`Ação ${safeAction} aplicada diretamente no torneio ${name || safeKey}. Rode o SQL da v1.6.79.6 para manter a RPC como caminho principal.`, "warning");
        if (safeAction === "delete") {
          removeTournamentFromStateByKey(safeKey);
          renderStats(countApprovedOrganizerPermissions(state.organizerPermissionRows));
          renderTournamentsList();
        } else {
          await refreshData();
          renderTournamentsList();
        }
        return;
      }

      addLog(error.message || "Não foi possível executar a ação administrativa no torneio. Rode o SQL da v1.6.79.6 no Supabase e confira a permissão Admin Master.", "error");
    }
  }


  function renderOrganizerEntityResults() {
    const root = $("#sbwAdminOrganizerEntityResults");
    if (!root) return;

    const organizers = Array.isArray(state.tournamentOrganizers) ? state.tournamentOrganizers : [];

    if (!organizers.length) {
      root.innerHTML = `
        <p class="sbw-admin-muted">Nenhuma Organização de Torneios criada ainda.</p>
      `;
      return;
    }

    root.innerHTML = `
      <p class="sbw-admin-muted">
        ${organizers.length} organização(ões) exibida(s). Arquivadas ficam preservadas para o Admin; excluídas definitivamente saem do banco.
      </p>
      ${organizers.map(renderOrganizerEntityCard).join("")}
    `;
  }

  function renderOrganizerEntityCard(organizer) {
    const key = getOrganizerEntityKey(organizer);
    const slug = getOrganizerEntitySlug(organizer);
    const name = getOrganizerEntityName(organizer);
    const statusLabel = getOrganizerEntityStatusLabel(organizer);
    const archived = isOrganizerEntityArchivedOrDeleted(organizer);
    const initial = String(organizer?.tag || name || "O").charAt(0).toUpperCase();
    const publicUrl = slug ? `../torneios/organizador.html?slug=${encodeURIComponent(slug)}` : "../organizadores/organizadores.html";
    const manageUrl = slug ? `../torneios/editar-organizador.html?slug=${encodeURIComponent(slug)}` : "../torneios/editar-organizador.html";

    return `
      <article class="sbw-admin-result-card sbw-admin-organizer-entity-card" data-organizer-key="${escapeHtml(key)}">
        <div class="sbw-admin-result-main">
          <div class="sbw-admin-avatar">${escapeHtml(initial)}</div>

          <div class="sbw-admin-result-title">
            <strong>${escapeHtml(name)}</strong>
            <small>${escapeHtml([slug, `Torneios: ${organizer.tournamentCount || 0}`, `Staff: ${organizer.memberCount || 0}`].filter(Boolean).join(" · "))}</small>
          </div>

          <div class="sbw-admin-badges">
            <span class="sbw-admin-badge ${archived ? "sbw-admin-badge--danger" : "sbw-admin-badge--success"}">${escapeHtml(statusLabel)}</span>
            ${organizer?.tag ? `<span class="sbw-admin-badge">${escapeHtml(organizer.tag)}</span>` : ""}
          </div>
        </div>

        <div class="sbw-admin-actions">
          <a class="sbw-admin-button sbw-admin-button--ghost" href="${escapeHtml(publicUrl)}" target="_blank" rel="noopener">
            Ver público
          </a>
          <a class="sbw-admin-button sbw-admin-button--ghost" href="${escapeHtml(manageUrl)}" target="_blank" rel="noopener">
            Gerenciar
          </a>
          <button class="sbw-admin-button sbw-admin-button--danger" type="button" data-admin-action="admin-organizer-action" data-organizer-key="${escapeHtml(key)}" data-organizer-action="archive">
            Arquivar
          </button>
          <button class="sbw-admin-button sbw-admin-button--danger" type="button" data-admin-action="admin-organizer-action" data-organizer-key="${escapeHtml(key)}" data-organizer-action="delete">
            Excluir definitivo
          </button>
        </div>
      </article>
    `;
  }

  function removeOrganizerEntityFromStateByKey(key) {
    state.tournamentOrganizers = (state.tournamentOrganizers || []).filter((item) => {
      return !matchesAdminKey(item, key, [
        item?.id,
        item?.slug,
        item?.name,
        getOrganizerEntityKey(item),
        getOrganizerEntitySlug(item)
      ]);
    });
  }

  async function runAdminOrganizerEntityAction(organizerKey, action) {
    const safeKey = String(organizerKey || "").trim();
    const safeAction = String(action || "").trim().toLowerCase();

    if (!safeKey || !safeAction) {
      addLog("Organização ou ação administrativa inválida.", "error");
      return;
    }

    const organizer = (state.tournamentOrganizers || []).find((item) => {
      return [item?.id, item?.slug, getOrganizerEntityKey(item), getOrganizerEntitySlug(item)]
        .map((value) => String(value || "").trim())
        .includes(safeKey);
    });

    const name = getOrganizerEntityName(organizer || {});

    if (safeAction === "delete") {
      const confirmation = window.prompt(
        `Excluir definitivamente a Organização de Torneios “${name || safeKey}”?\n\n` +
        "Isto remove a organização do banco e também remove torneios vinculados a ela. Digite EXCLUIR para confirmar."
      );

      if (confirmation !== "EXCLUIR") {
        addLog("Exclusão definitiva de organização cancelada.", "warning");
        return;
      }
    } else {
      const shouldRun = window.confirm(
        `Arquivar a Organização de Torneios “${name || safeKey}”?\n\n` +
        "Ela ficará invisível publicamente e também deixará de aparecer para o organizador, mas o histórico será preservado para o Admin."
      );

      if (!shouldRun) return;
    }

    if (!state.client) {
      addLog("Supabase não disponível para ação administrativa em organização.", "error");
      return;
    }

    try {
      const { data, error } = await state.client.rpc("sbw_admin_manage_tournament_organizer", {
        p_organizer: safeKey,
        p_action: safeAction,
        p_reason: "Ação executada pelo Admin Master na central de organizações."
      });

      if (error) throw error;

      const result = data && typeof data === "object" ? data : {};
      addLog(result.message || `Ação ${safeAction} executada na organização ${name || safeKey}.`);

      if (safeAction === "delete") {
        removeOrganizerEntityFromStateByKey(safeKey);
        renderOrganizerEntityResults();
        renderStats(state.tournamentOrganizers.length || countApprovedOrganizerPermissions(state.organizerPermissionRows));
      } else {
        await refreshData();
        renderOrganizerEntityResults();
      }
    } catch (error) {
      console.warn("[SBW Admin] Falha na ação administrativa da organização:", error);
      addLog(error.message || "Não foi possível executar a ação administrativa na organização. Rode o SQL da v1.6.80.1 no Supabase.", "error");
    }
  }

  function renderOrganizerPermissionResults() {
    const root = $("#sbwAdminOrganizerResults");
    if (!root) return;

    const rows = getActiveOrganizerPermissionRows();

    if (!rows.length) {
      root.innerHTML = `
        <p class="sbw-admin-muted">
          Nenhum usuário autorizado para criar Organização de Torneios foi encontrado.
          Conceda a permissão pela aba Usuários.
        </p>
      `;
      return;
    }

    root.innerHTML = `
      <p class="sbw-admin-muted">${rows.length} usuário(s) com permissão ativa para criar Organização de Torneios.</p>
      ${rows.map((row) => renderOrganizerPermissionCard(row)).join("")}
    `;
  }

  function renderOrganizerPermissionCard(row) {
    const profile = getProfileByOrganizerPermission(row);
    const target = getOrganizerPermissionTarget(profile, row);
    const initial = String(target.displayName || "O").charAt(0).toUpperCase();
    const grantedAt = row?.granted_at || row?.created_at || "";
    const grantedLabel = grantedAt ? new Date(grantedAt).toLocaleDateString("pt-BR") : "Data não informada";
    const authUserId = target.authUserId || "";
    const profileId = target.profileId || "";
    const profileSlug = target.profileSlug || "";

    return `
      <article class="sbw-admin-result-card" data-organizer-permission-id="${escapeHtml(row?.id || "")}">
        <div class="sbw-admin-result-main">
          <div class="sbw-admin-avatar">${escapeHtml(initial)}</div>

          <div class="sbw-admin-result-title">
            <strong>${escapeHtml(target.displayName || "Organizador autorizado")}</strong>
            <small>${escapeHtml([profileSlug, authUserId, `desde ${grantedLabel}`].filter(Boolean).join(" · "))}</small>
          </div>

          <div class="sbw-admin-badges">
            <span class="sbw-admin-badge sbw-admin-badge--success">Criar organização</span>
            <span class="sbw-admin-badge">Torneios: ${row?.can_create_tournaments === true ? "liberado" : "bloqueado"}</span>
          </div>
        </div>

        <div class="sbw-admin-actions">
          ${profileSlug ? `
            <a class="sbw-admin-button sbw-admin-button--ghost" href="${escapeHtml(window.SBWRoutes?.profile ? window.SBWRoutes.profile(profileSlug) : `../perfis/perfil.html?u=${encodeURIComponent(profileSlug)}`)}" target="_blank" rel="noopener">
              Ver perfil
            </a>
          ` : ""}

          <button
            class="sbw-admin-button sbw-admin-button--danger"
            type="button"
            data-admin-action="revoke-organizer-permission"
            data-permission-id="${escapeHtml(row?.id || "")}" 
            data-auth-user-id="${escapeHtml(authUserId)}"
            data-profile-id="${escapeHtml(profileId)}"
            data-profile-slug="${escapeHtml(profileSlug)}"
          >
            Remover permissão
          </button>
        </div>
      </article>
    `;
  }

  function getProfileByKey(key) {
    const normalizedKey = String(key || "").trim();
    if (!normalizedKey) return null;

    return state.profiles.find((profile) => {
      return [
        profile?.id,
        profile?.auth_user_id,
        profile?.authUserId,
        profile?.user_id,
        profile?.slug,
        profile?.username,
        getProfileKey(profile)
      ].map((value) => String(value || "").trim()).includes(normalizedKey);
    }) || null;
  }

  function getTeamByKey(key) {
    return state.teams.find((team) => {
      return String(getTeamKey(team) || "") === String(key) || String(team?.id || "") === String(key);
    }) || null;
  }

  async function saveProfilePermissions(profile, permissionKey) {
    if (!profile) return;

    const currentPermissions = getProfilePermissions(profile);
    const nextPermissions = {
      ...currentPermissions,
      [permissionKey]: !Boolean(currentPermissions[permissionKey])
    };

    if (permissionKey === "isMasterAdmin" && !canGrantMaster(state.context)) {
      addLog("Apenas Master Admin pode conceder/remover Master.", "error");
      return;
    }

    const nextMetadata = {
      ...asObject(profile.metadata),
      permissions: nextPermissions
    };

    let saved = false;

    if (state.client && profile.id) {
      try {
        const result = await state.client
          .from(getTable("profiles", "profiles"))
          .update({
            metadata: nextMetadata,
            permissions: nextPermissions,
            updated_at: new Date().toISOString()
          })
          .eq("id", profile.id)
          .select("*")
          .maybeSingle();

        if (result.error) throw result.error;

        if (result.data) {
          Object.assign(profile, result.data);
        } else {
          profile.metadata = nextMetadata;
          profile.permissions = nextPermissions;
        }

        saved = true;
      } catch (error) {
        console.warn("[SBW Admin] Falha ao atualizar permissões no Supabase:", error);
        addLog(`Supabase/RLS recusou atualizar permissão de ${getProfileName(profile)}.`, "warning");
      }
    }

    if (!saved && window.SBWProfilesStorage?.saveProfile) {
      try {
        await window.SBWProfilesStorage.saveProfile({
          ...profile,
          metadata: nextMetadata,
          permissions: nextPermissions
        });
        profile.metadata = nextMetadata;
        profile.permissions = nextPermissions;
        saved = true;
        addLog(`Permissão salva no fallback local para ${getProfileName(profile)}.`, "warning");
      } catch (error) {
        console.warn("[SBW Admin] Falha ao salvar permissão no fallback:", error);
      }
    }

    if (saved) {
      addLog(`Permissão ${permissionKey} alternada para ${getProfileName(profile)}.`);
      renderProfilesList();

      if (profile?.auth_user_id === state.context?.user?.id || profile?.id === state.context?.profile?.id) {
        window.SBWSessionContext?.clearCache?.();
        state.context = await window.SBWSessionContext?.refresh?.();
      }
    }
  }

  async function approveOrganizer(profile) {
    if (!profile) return;

    const authUserId = getProfileAuthUserId(profile);

    if (!authUserId) {
      addLog(`Perfil ${getProfileName(profile)} não tem auth_user_id para liberar criação de organização.`, "error");
      return;
    }

    if (!state.client) {
      addLog("Supabase não disponível para liberar criação de organização.", "error");
      return;
    }

    try {
      const result = await state.client.rpc("sbw_admin_set_organizer_permission", {
        p_target_auth_user_id: authUserId,
        p_target_profile_id: isUuid(profile.id) ? profile.id : null,
        p_target_profile_slug: profile.slug || profile.username || "",
        p_reason: "Permissão concedida pelo Admin Master -SBW-"
      });

      if (result.error) throw result.error;

      addLog(`Permissão para criar organização concedida a ${getProfileName(profile)}.`);
      await refreshData();
      renderProfilesList();
      renderOrganizerExternalPretest();
      renderOrganizerPermissionResults();
    } catch (error) {
      console.warn("[SBW Admin] Falha ao liberar criação de organização:", error);
      addLog("Não foi possível liberar criação de organização. Rode o SQL da v1.6.52 no Supabase e confira permissão Admin Master.", "warning");
    }
  }

  async function revokeOrganizer(profile) {
    if (!profile) return;

    const permissionRow = getOrganizerPermissionForProfile(profile);
    await revokeOrganizerPermission(profile, permissionRow);
  }

  async function revokeOrganizerPermission(profile, permissionRow) {
    const target = getOrganizerPermissionTarget(profile, permissionRow);
    const permissionId = String(permissionRow?.id || permissionRow?.permissionId || permissionRow?.permission_id || "").trim();
    const authUserId = String(target.authUserId || permissionRow?.auth_user_id || permissionRow?.authUserId || "").trim();
    const profileId = String(target.profileId || permissionRow?.profile_id || permissionRow?.profileId || "").trim();
    const profileSlug = String(target.profileSlug || permissionRow?.profile_slug || permissionRow?.profileSlug || "").trim();

    if (!permissionId && !authUserId && !profileId && !profileSlug) {
      addLog(`Não há identificador suficiente para remover a permissão de ${target.displayName || "organizador"}.`, "error");
      return;
    }

    if (!state.client) {
      addLog("Supabase não disponível para remover permissão de organização.", "error");
      return;
    }

    const shouldRevoke = window.confirm(`Remover permissão de criar organização de ${target.displayName || "este usuário"}?`);

    if (!shouldRevoke) {
      return;
    }

    try {
      const reason = "Permissão removida pelo Admin Master -SBW-";

      const revokePayload = {
        permissionId,
        permission_id: permissionId,
        authUserId,
        auth_user_id: authUserId,
        profileId,
        profile_id: profileId,
        profileSlug,
        profile_slug: profileSlug,
        reason
      };

      const result = await state.client.rpc("sbw_admin_revoke_organizer_permission_json", {
        p_payload: revokePayload
      });

      if (result?.error) {
        throw result.error;
      }

      const data = result?.data;

      if (data && data.ok === false) {
        const debug = data.debug ? ` Debug: ${JSON.stringify(data.debug)}` : "";
        throw new Error(`${data.message || "Permissão não encontrada."}${debug}`);
      }

      addLog(`Permissão de criar organização removida de ${target.displayName || "usuário"}.`);
      await refreshData();
      renderProfilesList();
      renderOrganizerExternalPretest();
      renderOrganizerPermissionResults();
    } catch (error) {
      console.warn("[SBW Admin] Falha ao remover permissão de organização:", error);
      const isMissingRpc = error && (error.code === "PGRST202" || error.status === 404 || String(error.message || "").toLowerCase().includes("schema cache"));
      const message = isMissingRpc
        ? "RPC de remoção não encontrada pelo Supabase. Rode o SQL da v1.6.54.2, aguarde o cache recarregar e atualize o Admin com Ctrl + F5."
        : "Não foi possível remover permissão de organização. Confira se a conta atual é Admin Master/Admin SBW e se a permissão ainda existe.";
      addLog(message, "warning");
    }
  }

  async function saveTeamVerification(team, shouldVerify) {
    if (!team) return;

    const key = getTeamKey(team);
    const patch = {
      isVerified: shouldVerify,
      is_verified: shouldVerify,
      verificationStatus: shouldVerify ? "verified" : "not_verified",
      verification_status: shouldVerify ? "verified" : "not_verified",
      memberLimit: shouldVerify ? 100 : 50,
      member_limit: shouldVerify ? 100 : 50,
      updatedAt: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    let saved = false;

    if (state.client) {
      const table = getTable("teams", "teams");
      const attempts = [];

      if (team.id) attempts.push(["id", team.id]);
      if (team.slug) attempts.push(["slug", team.slug]);

      for (const [column, value] of attempts) {
        try {
          const result = await state.client
            .from(table)
            .update({
              is_verified: shouldVerify,
              verification_status: shouldVerify ? "verified" : "not_verified",
              member_limit: shouldVerify ? 100 : 50,
              updated_at: new Date().toISOString()
            })
            .eq(column, value)
            .select("*")
            .maybeSingle();

          if (!result.error) {
            saved = true;
            break;
          }
        } catch (error) {
          // tenta fallback abaixo
        }
      }

      if (!saved) {
        addLog(`Supabase/RLS recusou atualizar verificação de ${getTeamName(team)}.`, "warning");
      }
    }

    if (!saved && window.SBWTeamsStorage?.saveTeam) {
      try {
        await window.SBWTeamsStorage.saveTeam({ ...team, ...patch });
        saved = true;
        addLog(`Verificação salva no fallback local para ${getTeamName(team)}.`, "warning");
      } catch (error) {
        console.warn("[SBW Admin] Falha ao salvar equipe no fallback:", error);
      }
    }

    if (saved) {
      addLog(`${shouldVerify ? "Verificação concedida" : "Verificação removida"} para ${getTeamName(team)}.`);
      await refreshData();
      renderTeamsList();
    }
  }

  async function directUpdateTeamAdminAction(team, safeKey, safeAction) {
    if (!state.client || !["archive", "delete"].includes(safeAction)) return false;

    const table = getTable("teams", "teams");
    const previousStatus = getTeamStatusValue(team || {});
    const previousVisibility = team?.isPublic !== false && team?.is_public !== false;
    const previousActive = team?.isActive !== false && team?.is_active !== false;

    const attempts = [];
    if (team?.id) attempts.push(["id", team.id]);
    if (team?.slug) attempts.push(["slug", team.slug]);
    if (safeKey) {
      attempts.push(["id", safeKey]);
      attempts.push(["slug", safeKey]);
    }

    if (safeAction === "delete") {
      const seenDelete = new Set();
      for (const [column, value] of attempts) {
        const key = `${column}:${value}`;
        if (!value || seenDelete.has(key)) continue;
        seenDelete.add(key);

        try {
          const result = await state.client
            .from(table)
            .delete()
            .eq(column, value);

          if (!result.error) return true;
        } catch (error) {
          // tenta próximo identificador
        }
      }
      return false;
    }

    const patch = {
      is_active: false,
      is_public: false,
      status: "archived",
      metadata: buildAdminActionMetadata(team?.metadata, safeAction, { status: previousStatus, visibility: previousVisibility, active: previousActive }, "Ação executada pelo Admin Master na central de equipes."),
      updated_at: new Date().toISOString()
    };

    const seen = new Set();
    for (const [column, value] of attempts) {
      const key = `${column}:${value}`;
      if (!value || seen.has(key)) continue;
      seen.add(key);

      try {
        const result = await state.client
          .from(table)
          .update(patch)
          .eq(column, value)
          .select("*")
          .maybeSingle();

        if (!result.error && result.data) return true;
      } catch (error) {
        // tenta próximo identificador
      }
    }

    return false;
  }

  async function runAdminTeamAction(teamKey, action) {
    const safeKey = String(teamKey || "").trim();
    const safeAction = String(action || "").trim().toLowerCase();

    if (!safeKey || !safeAction) {
      addLog("Equipe ou ação administrativa inválida.", "error");
      return;
    }

    const team = getTeamByKey(safeKey);
    const name = getTeamName(team || {});
    const labels = {
      delete: "excluir do painel"
    };

    const shouldRun = window.confirm(
      `Atenção: deseja ${labels[safeAction] || safeAction} a equipe “${name || safeKey}”?\n\n` +
      "Esta é uma exclusão administrativa segura: a equipe fica privada/inativa e o histórico é preservado."
    );

    if (!shouldRun) return;

    if (!state.client) {
      addLog("Supabase não disponível para ação administrativa em equipe.", "error");
      return;
    }

    try {
      const { data, error } = await state.client.rpc("sbw_admin_manage_team", {
        p_team: safeKey,
        p_action: safeAction,
        p_reason: "Ação executada pelo Admin Master na central de equipes."
      });

      if (error) throw error;

      const result = data && typeof data === "object" ? data : {};
      addLog(result.message || `Ação ${safeAction} executada na equipe ${name || safeKey}.`);

      if (safeAction === "delete") {
        removeTeamFromStateByKey(safeKey);
        renderStats(countApprovedOrganizerPermissions(state.organizerPermissionRows));
        renderTeamsList();
      } else {
        await refreshData();
        renderTeamsList();
      }
    } catch (error) {
      console.warn("[SBW Admin] Falha na ação administrativa da equipe:", error);

      const fallbackSaved = await directUpdateTeamAdminAction(team, safeKey, safeAction);

      if (fallbackSaved) {
        addLog(`Ação ${safeAction} aplicada diretamente na equipe ${name || safeKey}. Rode o SQL da v1.6.79.6 para manter a RPC como caminho principal.`, "warning");
        if (safeAction === "delete") {
          removeTeamFromStateByKey(safeKey);
          renderStats(countApprovedOrganizerPermissions(state.organizerPermissionRows));
          renderTeamsList();
        } else {
          await refreshData();
          renderTeamsList();
        }
        return;
      }

      addLog(error.message || "Não foi possível executar a ação administrativa na equipe. Rode o SQL da v1.6.79.6 no Supabase e confira a permissão Admin Master.", "error");
    }
  }

  function bindTabs() {
    $all("[data-sbw-admin-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        const tab = button.dataset.sbwAdminTab;

        $all("[data-sbw-admin-tab]").forEach((item) => {
          item.classList.toggle("is-active", item === button);
        });

        $all("[data-sbw-admin-panel]").forEach((panel) => {
          panel.classList.toggle("is-active", panel.dataset.sbwAdminPanel === tab);
        });
      });
    });
  }

  function bindSearchForms() {
    const profileForm = $("[data-sbw-admin-profile-search]");
    const teamForm = $("[data-sbw-admin-team-search]");
    const tournamentForm = $("[data-sbw-admin-tournament-search]");
    const analyticsRangeForm = $("[data-sbw-admin-analytics-range]");

    if (profileForm) {
      profileForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const query = profileForm.query.value || "";

        state.profileListExpanded = false;
        state.profileLetterFilter = "";
        renderAlphaFilters();

        if (query.trim().length < 2) {
          renderProfileResults([]);
          $("#sbwAdminProfileResults").innerHTML = `<p class="sbw-admin-muted">Digite pelo menos 2 caracteres para buscar perfis.</p>`;
          updateListControls();
          return;
        }

        renderProfilesList();
      });
    }

    if (teamForm) {
      teamForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const query = teamForm.query.value || "";

        state.teamListExpanded = false;
        state.teamLetterFilter = "";
        renderAlphaFilters();

        if (query.trim().length < 2) {
          renderTeamResults([]);
          $("#sbwAdminTeamResults").innerHTML = `<p class="sbw-admin-muted">Digite pelo menos 2 caracteres para buscar equipes.</p>`;
          updateListControls();
          return;
        }

        renderTeamsList();
      });
    }

    if (tournamentForm) {
      tournamentForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const query = tournamentForm.query.value || "";

        state.tournamentListExpanded = false;
        state.tournamentSearchQuery = query.trim();

        if (query.trim().length > 0 && query.trim().length < 2) {
          renderTournamentResults([]);
          $("#sbwAdminTournamentResults").innerHTML = `<p class="sbw-admin-muted">Digite pelo menos 2 caracteres para buscar torneios.</p>`;
          updateListControls();
          return;
        }

        renderTournamentsList();
      });
    }

    if (analyticsRangeForm) {
      analyticsRangeForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const start = String(analyticsRangeForm.start?.value || "").trim();
        const end = String(analyticsRangeForm.end?.value || "").trim();

        if (!isDateInputValue(start) || !isDateInputValue(end)) {
          addLog("Selecione data inicial e final para aplicar o filtro personalizado de Analytics.", "warning");
          return;
        }

        if (start > end) {
          addLog("A data inicial do Analytics não pode ser maior que a data final.", "warning");
          return;
        }

        state.analyticsRangeMode = "custom";
        state.analyticsStartDate = start;
        state.analyticsEndDate = end;
        await refreshAnalyticsPanel();
        addLog(`Analytics filtrado de ${formatDateInputLabel(start)} até ${formatDateInputLabel(end)}.`);
      });
    }

  }

  function bindActions() {
    document.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-admin-action]");
      if (!button) return;

      const action = button.dataset.adminAction;
      button.disabled = true;

      try {
        if (action === "run-rls-diagnostics") {
          await runRlsDiagnostics();
        }

        if (action === "show-all-profiles") {
          state.profileListExpanded = true;
          state.profileLetterFilter = "";
          renderAlphaFilters();
          renderProfilesList();
          addLog(`Listando todos os ${state.profiles.length} perfil(is) carregado(s) para a conta Admin.`);
        }

        if (action === "show-less-profiles") {
          state.profileListExpanded = false;
          state.profileLetterFilter = "";
          const form = $("[data-sbw-admin-profile-search]");
          if (form?.query) form.query.value = "";
          renderAlphaFilters();
          resetProfileResults();
          addLog("Lista de perfis recolhida para a visualização inicial.");
        }

        if (action === "refresh-organizers") {
          await refreshData();
          renderOrganizerExternalPretest();
          renderOrganizerPermissionResults();
          renderOrganizerEntityResults();
          addLog("Lista de organizadores e organizações atualizada.");
        }

        if (action === "refresh-organizer-entities") {
          await refreshData();
          renderOrganizerEntityResults();
          addLog("Lista de organizações criadas atualizada.");
        }

        if (action === "refresh-tournaments") {
          await refreshData();
          renderTournamentsList();
          addLog("Lista global de torneios atualizada.");
        }

        if (action === "refresh-analytics") {
          await refreshAnalyticsPanel();
          addLog("Analytics atualizado.");
        }

        if (action === "analytics-days") {
          state.analyticsRangeMode = "days";
          state.analyticsDays = Number(button.dataset.analyticsDays || 7) || 7;
          state.analyticsStartDate = "";
          state.analyticsEndDate = "";
          const form = $("[data-sbw-admin-analytics-range]");
          if (form) form.reset();
          await refreshAnalyticsPanel();
          addLog(`Analytics ajustado para ${state.analyticsDays} dia(s).`);
        }

        if (action === "analytics-clear-range") {
          state.analyticsRangeMode = "days";
          state.analyticsStartDate = "";
          state.analyticsEndDate = "";
          const form = $("[data-sbw-admin-analytics-range]");
          if (form) form.reset();
          await refreshAnalyticsPanel();
          addLog("Filtro personalizado de Analytics removido.");
        }

        if (action === "show-all-tournaments") {
          state.tournamentListExpanded = true;
          state.tournamentSearchQuery = "";
          state.tournamentStatusFilter = "";
          updateTournamentFilterButtons();
          renderTournamentsList();
          addLog(`Listando todos os ${state.tournaments.length} torneio(s) carregado(s) para a conta Admin.`);
        }

        if (action === "show-less-tournaments") {
          state.tournamentListExpanded = false;
          state.tournamentSearchQuery = "";
          state.tournamentStatusFilter = "";
          const form = $("[data-sbw-admin-tournament-search]");
          if (form?.query) form.query.value = "";
          updateTournamentFilterButtons();
          resetTournamentResults();
          addLog("Lista global de torneios recolhida para a visualização inicial.");
        }

        if (action === "filter-tournaments") {
          state.tournamentStatusFilter = button.dataset.tournamentStatus || "";
          state.tournamentListExpanded = true;
          updateTournamentFilterButtons();
          renderTournamentsList();
        }

        if (action === "admin-tournament-action") {
          await runAdminTournamentAction(button.dataset.tournamentKey, button.dataset.tournamentAction);
        }

        if (action === "admin-organizer-action") {
          await runAdminOrganizerEntityAction(button.dataset.organizerKey, button.dataset.organizerAction);
        }

        if (action === "copy-organizer-pretest") {
          await copyTextToClipboard(buildOrganizerExternalPretestReport(), "Checklist Admin do organizador externo");
        }

        if (action === "show-all-teams") {
          state.teamListExpanded = true;
          state.teamLetterFilter = "";
          renderAlphaFilters();
          renderTeamsList();
          addLog(`Listando todas as ${state.teams.length} equipe(s) carregada(s) para a conta Admin.`);
        }

        if (action === "show-less-teams") {
          state.teamListExpanded = false;
          state.teamLetterFilter = "";
          const form = $("[data-sbw-admin-team-search]");
          if (form?.query) form.query.value = "";
          renderAlphaFilters();
          resetTeamResults();
          addLog("Lista de equipes recolhida para a visualização inicial.");
        }

        if (action === "filter-list-letter") {
          const scope = button.dataset.filterScope;
          const letter = button.dataset.filterLetter || "";

          if (scope === "profiles") {
            state.profileLetterFilter = letter;
            state.profileListExpanded = true;
            renderAlphaFilters();
            renderProfilesList();
          }

          if (scope === "teams") {
            state.teamLetterFilter = letter;
            state.teamListExpanded = true;
            renderAlphaFilters();
            renderTeamsList();
          }
        }

        if (action === "toggle-profile-permission") {
          const profile = getProfileByKey(button.dataset.profileKey);
          await saveProfilePermissions(profile, button.dataset.permission);
        }

        if (action === "approve-organizer") {
          const profile = getProfileByKey(button.dataset.profileKey);
          await approveOrganizer(profile);
        }

        if (action === "revoke-organizer") {
          const profile = getProfileByKey(button.dataset.profileKey);
          await revokeOrganizer(profile);
        }

        if (action === "revoke-organizer-permission") {
          const permissionRow = (state.organizerPermissionRows || []).find((row) => {
            return String(row?.id || "") === String(button.dataset.permissionId || "") ||
              String(row?.auth_user_id || "") === String(button.dataset.authUserId || "") ||
              String(row?.profile_slug || "") === String(button.dataset.profileSlug || "");
          }) || {
            id: button.dataset.permissionId || "",
            auth_user_id: button.dataset.authUserId || "",
            profile_id: button.dataset.profileId || "",
            profile_slug: button.dataset.profileSlug || ""
          };

          const profile = getProfileByOrganizerPermission(permissionRow);
          await revokeOrganizerPermission(profile, permissionRow);
        }

        if (action === "verify-team") {
          const team = getTeamByKey(button.dataset.teamKey);
          await saveTeamVerification(team, true);
        }

        if (action === "unverify-team") {
          const team = getTeamByKey(button.dataset.teamKey);
          await saveTeamVerification(team, false);
        }

        if (action === "admin-team-action") {
          await runAdminTeamAction(button.dataset.teamKey, button.dataset.teamAction);
        }
      } finally {
        button.disabled = false;
      }
    });
  }

  async function init() {
    const page = document.getElementById("sbwAdminPage");
    window.SBWPageState?.setBusy?.(page, true);

    try {
      bindTabs();
      bindSearchForms();
      bindActions();

      state.client = await waitForSupabaseClient();

      if (!window.SBWSessionContext?.getCurrentContext) {
        setStatus("Núcleo de sessão não carregado.", "error");
        showGate("Não foi possível carregar o contexto de sessão. Verifique se <code>js/core/sbw-session-context.js</code> foi carregado.", true);
        return;
      }

      state.context = await window.SBWSessionContext.getCurrentContext({ refresh: true });

      if (!state.context?.user) {
        setStatus("Sessão ausente.", "error");
        showGate(`Você precisa estar logado para acessar o Admin Master. <a href="${escapeHtml(window.SBWRoutes?.login ? window.SBWRoutes.login(window.location.href) : "../auth/login.html")}">Entrar</a>`, true);
        return;
      }

      const adminRoles = state.context.permissions?.roles?.join(", ") || "sem roles explícitas";

      setStatus(`
        <strong>${escapeHtml(state.context.displayName || state.context.email)}</strong><br />
        ${escapeHtml(state.context.email || "")}
        <br /><small>${escapeHtml(adminRoles)}</small>
      `);

      if (!canAccessAdmin(state.context)) {
        showGate(
          "Sua conta está logada, mas ainda não possui permissão administrativa no site. " +
          "Nesta fase, a permissão precisa existir no Supabase/profile/site_permissions para abrir o painel.",
          true
        );
        return;
      }

      showShell();
      await refreshData();
      renderAlphaFilters();
      renderTournamentsList();
      renderAnalyticsPanel();
      updateTournamentFilterButtons();
      updateListControls();
      addLog("Painel Admin Master inicial carregado.");
    } catch (error) {
      console.error("[SBW Admin] Falha ao carregar painel Admin Master:", error);
      setStatus("Erro ao carregar painel.", "error");
      showGate("Não foi possível carregar o painel administrativo. Atualize a página e tente novamente.", true);
    } finally {
      window.SBWPageState?.setBusy?.(page, false);
      window.SBWPageState?.markReady?.();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
