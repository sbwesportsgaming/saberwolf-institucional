      let currentUser = {
  id: null,
  name: "Usuário -SBW-",
  role: "user",
  playerId: null,

  permissions: {
    canCreateTournament: false,
    canManageTournamentResults: false,
    canResolveMatchDisputes: false,
    canViewAllMatchChats: false
  }
};

let currentAuthUser = null;
let currentProfile = null;
let availableTournamentOrganizers = [];
let requestedOrganizerKey = "";

        let activePlayoffMatchId = null;
        let activeMatchChatId = null;

    const TEAM_BATTLE_LEAGUE_4V4_FORMAT = "team-battle-league-4v4";
    const TRIPLE_BRACKET_FORMAT = "triple-bracket";

    function isTeamBattleLeague4v4Format(format) {
      return String(format || "").trim().toLowerCase() === TEAM_BATTLE_LEAGUE_4V4_FORMAT;
    }

    function isTripleBracketFormat(format) {
      const helper = window.SBWTripleBracket;
      if (helper && typeof helper.isTripleBracketFormat === "function") {
        return helper.isTripleBracketFormat(format);
      }

      const normalized = String(format || "").trim().toLowerCase();
      return [TRIPLE_BRACKET_FORMAT, "triple_bracket", "triple-bracket-8", "sistema-3-chaves", "sistema-de-3-chaves"].includes(normalized);
    }

    function isTeamEntryTournamentFormat(format) {
      return isTeamBattleLeague4v4Format(format) || isTripleBracketFormat(format);
    }

    function getDefaultCapacityForFormat(format) {
      if (isTripleBracketFormat(format)) return 8;
      if (isTeamBattleLeague4v4Format(format)) return 8;
      return 32;
    }

    function normalizeEvenTournamentCapacity(value, options = {}) {
      const min = Number(options.min || 2);
      const max = Number(options.max || 256);
      const fallback = Number(options.fallback || min);
      let number = Number.parseInt(value, 10);

      if (!Number.isFinite(number)) {
        number = fallback;
      }

      number = Math.max(min, Math.min(max, number));

      if (number % 2 !== 0) {
        number += 1;
      }

      if (number > max) {
        number = max % 2 === 0 ? max : max - 1;
      }

      return Math.max(min, number);
    }

    const formatDescriptions = {
      "double-elimination": {
        title: "Double Elimination",
        description:
          "Formato FGC com Winners Bracket, Losers Bracket, Grand Final e possível reset.",
        family: "bracket",
        category: "core",
        status: "active",
        teamMode: "solo"
      },
      "groups-playoffs": {
        title: "Grupos + Playoffs",
        description:
          "Formato guiado pela plataforma. O sistema libera apenas modelos matemáticos válidos.",
        family: "hybrid",
        category: "core",
        status: "active",
        teamMode: "solo"
      },
      "league": {
        title: "Pontos Corridos / Liga",
        description:
          "Formato com tabela, rodadas e classificação geral. Não possui chave final.",
        family: "league",
        category: "core",
        status: "active",
        teamMode: "solo"
      },
      "triple-bracket": {
        title: "Sistema de 3 Chaves",
        description:
          "Formato avançado para 8 equipes com fase todos contra todos, Chave Alta, Chave Média, Chave Baixa e Grande Final com vantagem.",
        family: "triple_bracket",
        category: "advanced",
        status: "beta",
        teamMode: "team"
      }
    };

    function getTournamentFormatDefinition(format) {
      const registry = window.SBWTournamentFormats;
      const registered = registry && typeof registry.get === "function" ? registry.get(format) : null;

      if (registered) {
        return {
          key: registered.key || String(format || "").trim(),
          title: registered.label || registered.shortLabel || format,
          shortLabel: registered.shortLabel || registered.label || format,
          description: registered.description || registered.publicNote || "Formato competitivo da plataforma -SBW-.",
          family: registered.family || "custom",
          category: registered.category || "custom",
          status: registered.status || "custom",
          teamMode: registered.teamMode || "solo",
          publicNote: registered.publicNote || "",
          flowTitle: registered.flowTitle || "",
          flowDescription: registered.flowDescription || "",
          features: Array.isArray(registered.features) ? registered.features : [],
          requirements: Array.isArray(registered.requirements) ? registered.requirements : [],
          specs: Array.isArray(registered.specs) ? registered.specs : [],
          capabilities: registered.capabilities && typeof registered.capabilities === "object" ? registered.capabilities : {}
        };
      }

      const fallback = formatDescriptions[format] || {
        title: String(format || "Formato").trim() || "Formato",
        description: "Formato competitivo personalizado.",
        family: "custom",
        category: "custom",
        status: "custom",
        teamMode: "solo",
        publicNote: ""
      };

      return {
        key: String(format || fallback.title || "custom").trim() || "custom",
        features: [],
        requirements: [],
        specs: [],
        capabilities: {},
        ...fallback
      };
    }

    function getTournamentFormatLabelFromValue(format) {
      return getTournamentFormatDefinition(format).title || String(format || "Formato").trim() || "Formato";
    }

    function getTournamentFormatMetadata(format) {
      const registry = window.SBWTournamentFormats;

      if (registry && typeof registry.toMetadata === "function") {
        return registry.toMetadata(format);
      }

      const definition = getTournamentFormatDefinition(format);
      return {
        key: String(format || "").trim(),
        label: definition.title,
        family: definition.family,
        category: definition.category,
        status: definition.status,
        teamMode: definition.teamMode,
        publicNote: definition.publicNote || ""
      };
    }

    function isTournamentFormatAvailableForCreation(format) {
      const registry = window.SBWTournamentFormats;

      if (registry && typeof registry.canCreate === "function") {
        return registry.canCreate(format);
      }

      return getTournamentFormatDefinition(format).status === "active";
    }

    function getTournamentFormatCreationBlockReason(format) {
      const registry = window.SBWTournamentFormats;

      if (registry && typeof registry.getCreationBlockReason === "function") {
        const reason = registry.getCreationBlockReason(format);
        if (reason) return reason;
      }

      const definition = getTournamentFormatDefinition(format);

      if (definition.status === "planned") {
        return `${definition.title} está em preparação e ainda não deve ser usado para criação real de torneios.`;
      }

      return `${definition.title} ainda não está disponível para criação real de torneios.`;
    }

    const form = document.getElementById("tournamentForm");
    const creatorArea = document.getElementById("creatorArea");
    const accessDenied = document.getElementById("accessDenied");
    const userBadge = document.getElementById("userBadge");
    const formatSelect = document.getElementById("format");
    const organizerSelect = document.getElementById("organizerSelect");
    const formatInfo = document.getElementById("formatInfo");
    const advancedFormatPanel = document.getElementById("advancedFormatPanel");
    const dynamicSettings = document.getElementById("dynamicSettings");
    const previewOutput = document.getElementById("previewOutput");
    const successMessage = document.getElementById("successMessage");
    const savedList = document.getElementById("savedList");
    const maxPlayersInput = document.getElementById("maxPlayers");
    const maxPlayersLabel = document.querySelector('label[for="maxPlayers"]');
    const maxPlayersHint = document.getElementById("maxPlayersHint");

    const managerArea = document.getElementById("managerArea");
    const managerTitle = document.getElementById("managerTitle");
    const managerMeta = document.getElementById("managerMeta");
    const closeManager = document.getElementById("closeManager");
    const participantForm = document.getElementById("participantForm");
    const participantList = document.getElementById("participantList");
    const participantCounter = document.getElementById("participantCounter");
    const generateStructureButton = document.getElementById("generateStructure");
    const structureOutput = document.getElementById("structureOutput");

    const selectAllSavedTournamentsButton = document.getElementById("selectAllSavedTournaments");
    const unselectAllSavedTournamentsButton = document.getElementById("unselectAllSavedTournaments");
    const deleteSelectedTournamentsButton = document.getElementById("deleteSelectedTournaments");

    let selectedTournamentId = null;
    let managedTournamentsCache = [];
    let resultDrafts = {};


function getTournamentAdminQueryParam(name) {
  try {
    return new URLSearchParams(window.location.search).get(name) || "";
  } catch (error) {
    return "";
  }
}

function normalizeTournamentAdminKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function getRequestedOrganizerKey() {
  return (
    getTournamentAdminQueryParam("organizer") ||
    getTournamentAdminQueryParam("organizer_slug") ||
    getTournamentAdminQueryParam("organizer_id") ||
    getTournamentAdminQueryParam("org") ||
    ""
  );
}

function organizerCanCreateTournament(organizer) {
  if (!organizer) {
    return false;
  }

  const role = String(organizer.memberRole || organizer.role || organizer.currentUserRole || "").toLowerCase();

  return Boolean(
    organizer.canCreateTournament === true ||
    organizer.can_create_tournaments === true ||
    ["owner", "admin", "manager", "organizer_admin", "tournament_admin"].includes(role)
  );
}
   function getSafeProfileName(profile, authUser) {
  return (
    profile?.display_name ||
    profile?.displayName ||
    profile?.nickname ||
    profile?.username ||
    authUser?.email?.split("@")[0] ||
    "Usuário -SBW-"
  );
}

function getSafeProfileId(profile, authUser) {
  return (
    profile?.slug ||
    profile?.username ||
    profile?.id ||
    authUser?.id ||
    "user"
  );
}

function denyCreatorAccess(message) {
  creatorArea.classList.add("hidden");

  if (managerArea) {
    managerArea.classList.add("hidden");
  }

  accessDenied.classList.remove("hidden");
  accessDenied.textContent = message || "Acesso restrito a organizadores autorizados pela -SBW-.";
  userBadge.textContent = "Acesso restrito";
}

async function redirectToLogin() {
  const loginUrl =
    window.SBWAuth && typeof window.SBWAuth.getLoginUrl === "function"
      ? window.SBWAuth.getLoginUrl(window.location.href)
      : "../../auth/login.html";

  window.location.href = loginUrl;
}

async function initAccessControl() {
  creatorArea.classList.add("hidden");

  if (managerArea) {
    managerArea.classList.add("hidden");
  }

  accessDenied.classList.add("hidden");
  userBadge.textContent = "Verificando permissão...";
  requestedOrganizerKey = getRequestedOrganizerKey();

  if (!window.SBWAuth || typeof window.SBWAuth.getUser !== "function") {
    denyCreatorAccess("Login -SBW- não carregado. Volte pelo menu principal e tente novamente.");
    return false;
  }

  const authUser = await window.SBWAuth.getUser();
  currentAuthUser = authUser || null;

  if (!authUser) {
    await redirectToLogin();
    return false;
  }

  let profile = null;

  if (typeof window.SBWAuth.ensureCurrentUserProfile === "function") {
    profile = await window.SBWAuth.ensureCurrentUserProfile();
  }

  currentProfile = profile || null;

  currentUser = {
    id: getSafeProfileId(profile, authUser),
    name: getSafeProfileName(profile, authUser),
    role: "organizer",
    playerId: profile?.id || null,

    permissions: {
      canCreateTournament: false,
      canManageTournamentResults: true,
      canResolveMatchDisputes: true,
      canViewAllMatchChats: true
    }
  };

  return true;
}

    function escapeHTML(value) {
      return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function generateSlug(text) {
      return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
    }

    function getSavedTournaments() {
      const data = localStorage.getItem("sbw_tournaments");

      if (!data) return [];

      try {
        return JSON.parse(data);
      } catch (error) {
        console.error("Erro ao ler torneios salvos:", error);
        return [];
      }
    }

    function saveAllTournaments(tournaments) {
      localStorage.setItem("sbw_tournaments", JSON.stringify(tournaments));
    }

    function saveTournament(tournament) {
      const tournaments = getSavedTournaments();
      tournaments.push(tournament);
      saveAllTournaments(tournaments);
    }

    function getTournamentById(id) {
      const lookup = String(id || "");
      const source = managedTournamentsCache.length > 0
        ? managedTournamentsCache
        : getSavedTournaments();

      return source.find((tournament) => {
        return (
          String(tournament.id || "") === lookup ||
          String(tournament.slug || "") === lookup ||
          String(tournament.supabaseId || "") === lookup ||
          String(tournament.raw?.id || "") === lookup
        );
      }) || null;
    }

        function getSelectedTournament() {
      if (!selectedTournamentId) {
        return null;
      }

      return getTournamentById(selectedTournamentId);
    }

    function isSupabaseTournament(tournament) {
      return Boolean(tournament && (tournament.source === "supabase" || tournament.supabaseId || tournament.raw));
    }

    function getTournamentLookupValue(tournament) {
      return String(
        tournament?.id ||
        tournament?.slug ||
        tournament?.supabaseId ||
        tournament?.raw?.id ||
        ""
      );
    }

    function getTournamentMaxPlayers(tournament) {
      return Number(
        tournament?.settings?.maxPlayers ||
        tournament?.maxParticipants ||
        tournament?.limit ||
        0
      );
    }

    function getTournamentFormatLabel(tournament) {
      return tournament?.formatLabel || getTournamentFormatLabelFromValue(tournament?.format) || tournament?.format || "Formato";
    }

    function getParticipantCheckinValue(participant) {
      return Boolean(
        participant?.checkin ||
        participant?.checkedIn ||
        String(participant?.checkInStatus || participant?.check_in_status || "").toLowerCase() === "checked_in"
      );
    }

    function getParticipantStatusLabel(status) {
      const normalized = String(status || "registered").toLowerCase();

      const labels = {
        registered: "Inscrito",
        waitlist: "Lista de espera",
        cancelled: "Cancelado",
        removed: "Removido",
        disqualified: "Desclassificado"
      };

      return labels[normalized] || "Inscrito";
    }

    function normalizeAdminParticipant(participant) {
      const name = participant?.nickname || participant?.playerName || participant?.name || participant?.displayName || "Jogador";

      return {
        ...participant,
        id: String(participant?.participantId || participant?.id || participant?.raw?.id || name),
        participantId: participant?.participantId || participant?.raw?.id || participant?.id || "",
        nickname: name,
        team: participant?.team || participant?.teamName || "Sem equipe",
        character: participant?.character || participant?.role || "",
        platform: participant?.platform || "-SBW-",
        status: participant?.status || "registered",
        checkin: getParticipantCheckinValue(participant),
        checkInStatus: participant?.checkInStatus || participant?.check_in_status || (getParticipantCheckinValue(participant) ? "checked_in" : "pending")
      };
    }

    function updateTournament(updatedTournament) {
      if (isSupabaseTournament(updatedTournament)) {
        managedTournamentsCache = managedTournamentsCache.map((tournament) => {
          return getTournamentLookupValue(tournament) === getTournamentLookupValue(updatedTournament)
            ? updatedTournament
            : tournament;
        });
        return;
      }

      const tournaments = getSavedTournaments();

      const updatedList = tournaments.map((tournament) => {
        return tournament.id === updatedTournament.id ? updatedTournament : tournament;
      });

      saveAllTournaments(updatedList);

      managedTournamentsCache = managedTournamentsCache.map((tournament) => {
        return tournament.id === updatedTournament.id ? { ...updatedTournament, source: tournament.source || "local" } : tournament;
      });
    }


    function getOrganizerOptionLabel(organizer) {
      const name = organizer?.name || organizer?.displayName || "Organizador";
      const role = organizer?.memberRole || organizer?.role || organizer?.type || "Organizador";
      return `${name} — ${role}`;
    }

    function getSelectedOrganizer() {
      if (!organizerSelect || !organizerSelect.value) {
        return availableTournamentOrganizers[0] || null;
      }

      return availableTournamentOrganizers.find((organizer) => {
        return String(organizer.id) === String(organizerSelect.value) ||
          String(organizer.slug) === String(organizerSelect.value);
      }) || availableTournamentOrganizers[0] || null;
    }


    function getTournamentOrganizerIdentity(tournament) {
      const rawOrganizer = tournament?.organizer && typeof tournament.organizer === "object" ? tournament.organizer : {};
      const rawOrganizerName = typeof tournament?.organizer === "string" ? tournament.organizer : "";
      const metadata = tournament?.metadata && typeof tournament.metadata === "object" ? tournament.metadata : {};
      const settings = tournament?.settings && typeof tournament.settings === "object" ? tournament.settings : {};
      const selected = tournament?.selectedOrganizer && typeof tournament.selectedOrganizer === "object" ? tournament.selectedOrganizer : {};

      const id = tournament?.organizerId || tournament?.organizer_id || rawOrganizer.id || selected.id || metadata.organizerId || settings.organizerId || "";
      const slug = tournament?.organizerSlug || tournament?.organizer_slug || rawOrganizer.slug || selected.slug || metadata.organizerSlug || settings.organizerSlug || "";
      const name = tournament?.organizerName || tournament?.organizer_name || rawOrganizer.name || rawOrganizer.displayName || selected.name || selected.displayName || metadata.organizerName || settings.organizerName || rawOrganizerName || "Organização não identificada";
      const role = rawOrganizer.role || selected.memberRole || selected.role || tournament?.organizerRole || "";

      return {
        id,
        slug,
        name,
        role,
        label: name,
        shortKey: slug || id || name
      };
    }

    function getPhaseRuleElementValue(id, fallback = "") {
      const element = document.getElementById(id);
      return element ? String(element.value || fallback) : fallback;
    }

    function getMatchFormatLabel(value) {
      const labels = {
        MD1: "MD1 / FT1",
        MD3: "MD3 / FT2",
        MD5: "MD5 / FT3",
        MD7: "MD7 / FT4",
        MD9: "MD9 / FT5",
        MD13: "MD13 / FT7",
        Personalizado: "Personalizado / Manual",
        inherit: "Herda fase anterior"
      };

      return labels[value] || value || "A definir";
    }

    function applyPhaseRulesPreset() {
      const preset = getPhaseRuleElementValue("phaseRulesPreset", "standard");
      const defaultFormat = getPhaseRuleElementValue("matchFormat", "MD3");
      const top8 = document.getElementById("top8MatchFormat");
      const top4 = document.getElementById("top4MatchFormat");
      const final = document.getElementById("finalMatchFormat");
      const grandFinal = document.getElementById("grandFinalMatchFormat");

      if (!top8 || !top4 || !final || !grandFinal) {
        return;
      }

      if (preset === "standard") {
        top8.value = "inherit";
        top4.value = "inherit";
        final.value = "inherit";
        grandFinal.value = "inherit";
        return;
      }

      if (preset === "top8-ft3") {
        top8.value = "MD5";
        top4.value = "MD5";
        final.value = "MD5";
        grandFinal.value = "MD5";
        return;
      }

      if (preset === "finals-progressive") {
        top8.value = "MD5";
        top4.value = "MD5";
        final.value = "MD9";
        grandFinal.value = "MD9";
        return;
      }

      if (preset === "custom") {
        top8.value = top8.value || defaultFormat;
        top4.value = top4.value || "inherit";
        final.value = final.value || "inherit";
        grandFinal.value = grandFinal.value || "inherit";
      }
    }

    function getMatchPhaseRules() {
      const defaultFormat = getPhaseRuleElementValue("matchFormat", "MD3");
      const preset = getPhaseRuleElementValue("phaseRulesPreset", "standard");
      const top8 = getPhaseRuleElementValue("top8MatchFormat", "inherit");
      const top4 = getPhaseRuleElementValue("top4MatchFormat", "inherit");
      const final = getPhaseRuleElementValue("finalMatchFormat", "inherit");
      const grandFinal = getPhaseRuleElementValue("grandFinalMatchFormat", "inherit");

      return {
        preset,
        defaultFormat,
        checkInRequired: true,
        phases: {
          default: defaultFormat,
          top8,
          top4,
          final,
          winnersFinal: final,
          lowerFinal: final,
          grandFinal,
          reset: grandFinal
        },
        labels: {
          default: getMatchFormatLabel(defaultFormat),
          top8: top8 === "inherit" ? "Usar padrão" : getMatchFormatLabel(top8),
          top4: top4 === "inherit" ? "Usar Top 8" : getMatchFormatLabel(top4),
          final: final === "inherit" ? "Usar Top 4" : getMatchFormatLabel(final),
          grandFinal: grandFinal === "inherit" ? "Usar Final" : getMatchFormatLabel(grandFinal)
        }
      };
    }

    function getTournamentPhaseRulesSummary(tournament) {
      const settings = tournament?.settings && typeof tournament.settings === "object" ? tournament.settings : {};
      const rules = settings.phaseRules || settings.matchPhaseRules || tournament?.phaseRules || null;
      const defaultFormat = rules?.defaultFormat || settings.matchFormat || tournament?.matchFormat || "MD3";
      const top8 = rules?.phases?.top8 || settings.top8MatchFormat || "inherit";

      if (!rules && !settings.top8MatchFormat) {
        return `${getMatchFormatLabel(defaultFormat)} padrão`;
      }

      if (top8 && top8 !== "inherit" && top8 !== defaultFormat) {
        return `${getMatchFormatLabel(defaultFormat)} padrão · Top 8 ${getMatchFormatLabel(top8)}`;
      }

      return `${getMatchFormatLabel(defaultFormat)} padrão · fases finais controladas`;
    }

    function getTournamentMatchPhaseRules(tournament) {
      const settings = tournament?.settings && typeof tournament.settings === "object" ? tournament.settings : {};
      const rules = settings.matchPhaseRules || settings.phaseRules || tournament?.matchPhaseRules || tournament?.phaseRules || {};
      const defaultFormat = rules.defaultFormat || settings.matchFormat || tournament?.matchFormat || "MD3";
      const phases = rules.phases && typeof rules.phases === "object" ? rules.phases : {};

      return {
        ...rules,
        defaultFormat,
        phases: {
          default: phases.default || defaultFormat,
          top8: phases.top8 || settings.top8MatchFormat || "inherit",
          top4: phases.top4 || settings.top4MatchFormat || "inherit",
          final: phases.final || settings.finalMatchFormat || "inherit",
          winnersFinal: phases.winnersFinal || phases.final || settings.finalMatchFormat || "inherit",
          lowerFinal: phases.lowerFinal || phases.final || settings.finalMatchFormat || "inherit",
          grandFinal: phases.grandFinal || settings.grandFinalMatchFormat || "inherit",
          reset: phases.reset || phases.grandFinal || settings.grandFinalMatchFormat || "inherit"
        }
      };
    }

    function resolvePhaseFormat(tournament, phaseKey, fallbackKey = "default") {
      const rules = getTournamentMatchPhaseRules(tournament);
      const phases = rules.phases || {};
      const defaultFormat = phases.default || rules.defaultFormat || "MD3";
      const rawValue = phases[phaseKey] || "inherit";

      if (!rawValue || rawValue === "inherit") {
        if (fallbackKey && fallbackKey !== phaseKey && phases[fallbackKey] && phases[fallbackKey] !== "inherit") {
          return phases[fallbackKey];
        }

        return defaultFormat;
      }

      return rawValue;
    }

    function applyMatchPhaseFormat(match, tournament, phaseKey, phaseLabel, fallbackKey = "default") {
      if (!match) return;

      const format = resolvePhaseFormat(tournament, phaseKey, fallbackKey);
      match.phaseKey = phaseKey;
      match.phaseLabel = phaseLabel || phaseKey;
      match.matchFormat = format;
      match.bestOf = format;
      match.formatLabel = getMatchFormatLabel(format);
    }

    function getWinnersPhaseKey(roundNumber, totalWinnerRounds) {
      if (roundNumber >= totalWinnerRounds) {
        return "winnersFinal";
      }

      if (roundNumber === totalWinnerRounds - 1) {
        return "top4";
      }

      if (roundNumber >= Math.max(1, totalWinnerRounds - 2)) {
        return "top8";
      }

      return "default";
    }

    function getLowerPhaseKey(roundNumber, totalLowerRounds) {
      if (roundNumber >= totalLowerRounds) {
        return "lowerFinal";
      }

      if (roundNumber === totalLowerRounds - 1) {
        return "top4";
      }

      if (roundNumber >= Math.max(1, totalLowerRounds - 3)) {
        return "top8";
      }

      return "default";
    }

    function applyDoubleEliminationPhaseFormats(tournament, structure) {
      if (!tournament || structure?.type !== "double-elimination") {
        return structure;
      }

      const winners = Array.isArray(structure.winnersBracket) ? structure.winnersBracket : [];
      const lower = Array.isArray(structure.losersBracket) ? structure.losersBracket : [];
      const winnerTotal = winners.length;
      const lowerTotal = lower.length;

      winners.forEach((round, roundIndex) => {
        const roundNumber = roundIndex + 1;
        const phaseKey = getWinnersPhaseKey(roundNumber, winnerTotal);
        const phaseLabel = phaseKey === "winnersFinal"
          ? "Winners Final"
          : phaseKey === "top4"
            ? "Top 4"
            : phaseKey === "top8"
              ? "Top 8"
              : "Fase inicial";

        round.phaseKey = phaseKey;
        round.phaseLabel = phaseLabel;
        round.matchFormat = resolvePhaseFormat(tournament, phaseKey, phaseKey === "winnersFinal" ? "top4" : "default");
        round.bestOf = round.matchFormat;

        (round.matches || []).forEach((match) => {
          applyMatchPhaseFormat(
            match,
            tournament,
            phaseKey,
            phaseLabel,
            phaseKey === "winnersFinal" ? "top4" : "default"
          );
        });
      });

      lower.forEach((round, roundIndex) => {
        const roundNumber = roundIndex + 1;
        const phaseKey = getLowerPhaseKey(roundNumber, lowerTotal);
        const phaseLabel = phaseKey === "lowerFinal"
          ? "Lower Final"
          : phaseKey === "top4"
            ? "Top 4"
            : phaseKey === "top8"
              ? "Top 8"
              : "Lower inicial";

        round.phaseKey = phaseKey;
        round.phaseLabel = phaseLabel;
        round.matchFormat = resolvePhaseFormat(tournament, phaseKey, phaseKey === "lowerFinal" ? "top4" : "default");
        round.bestOf = round.matchFormat;

        (round.matches || []).forEach((match) => {
          applyMatchPhaseFormat(
            match,
            tournament,
            phaseKey,
            phaseLabel,
            phaseKey === "lowerFinal" ? "top4" : "default"
          );
        });
      });

      (structure.grandFinal?.rounds || []).forEach((round) => {
        const isReset = String(round.id || "").toLowerCase().includes("reset") || String(round.name || "").toLowerCase().includes("reset");
        const phaseKey = isReset ? "reset" : "grandFinal";
        const phaseLabel = isReset ? "Reset da Grand Final" : "Grand Final";

        round.phaseKey = phaseKey;
        round.phaseLabel = phaseLabel;
        round.matchFormat = resolvePhaseFormat(tournament, phaseKey, "final");
        round.bestOf = round.matchFormat;

        (round.matches || []).forEach((match) => {
          applyMatchPhaseFormat(match, tournament, phaseKey, phaseLabel, "final");
        });
      });

      return structure;
    }

    function getEffectiveMatchFormat(tournament, match) {
      return match?.matchFormat || match?.bestOf || match?.format || tournament?.settings?.matchFormat || tournament?.matchFormat || "MD3";
    }

    async function loadTournamentOrganizerOptions() {
      if (!organizerSelect) {
        return [];
      }

      organizerSelect.innerHTML = `<option value="">Carregando organizações permitidas...</option>`;

      try {
        if (typeof sbwGetMyTournamentOrganizerAccessAsync === "function") {
          availableTournamentOrganizers = await sbwGetMyTournamentOrganizerAccessAsync();
        } else {
          availableTournamentOrganizers = [];
        }
      } catch (error) {
        console.warn("[SBW Torneios] Não foi possível carregar organizações permitidas:", error);
        availableTournamentOrganizers = [];
      }

      availableTournamentOrganizers = (Array.isArray(availableTournamentOrganizers) ? availableTournamentOrganizers : [])
        .filter(organizerCanCreateTournament);

      if (requestedOrganizerKey) {
        const requestedNormalized = normalizeTournamentAdminKey(requestedOrganizerKey);
        availableTournamentOrganizers = availableTournamentOrganizers.filter((organizer) => {
          return [organizer.id, organizer.slug, organizer.name, organizer.displayName]
            .some((value) => {
              const raw = String(value || "").trim();
              return raw === requestedOrganizerKey || normalizeTournamentAdminKey(raw) === requestedNormalized;
            });
        });
      }

      if (!availableTournamentOrganizers.length) {
        denyCreatorAccess(
          requestedOrganizerKey
            ? "Você não tem permissão para criar torneios nesta organização."
            : "Você não possui nenhuma Organização de Torneios com permissão para criar torneios."
        );
        return [];
      }

      organizerSelect.innerHTML = availableTournamentOrganizers
        .map((organizer, index) => {
          const value = organizer.id || organizer.slug || `organizer-${index}`;
          return `<option value="${escapeHTML(value)}">${escapeHTML(getOrganizerOptionLabel(organizer))}</option>`;
        })
        .join("");

      if (availableTournamentOrganizers.length === 1) {
        organizerSelect.value = availableTournamentOrganizers[0].id || availableTournamentOrganizers[0].slug || "";
        organizerSelect.disabled = Boolean(requestedOrganizerKey);
      }

      currentUser.permissions.canCreateTournament = true;
      creatorArea.classList.remove("hidden");
      accessDenied.classList.add("hidden");

      if (managerArea) {
        managerArea.classList.add("hidden");
      }

      const selectedOrganizer = getSelectedOrganizer();
      userBadge.textContent = `${currentUser.name} | ${selectedOrganizer?.name || selectedOrganizer?.displayName || "Organizador"}`;

      return availableTournamentOrganizers;
    }

        function renderAdvancedFormatsPanel() {
      if (!advancedFormatPanel) return;

      const registry = window.SBWTournamentFormats;
      const advancedFormats = registry && typeof registry.list === "function"
        ? registry.list().filter((format) => format.category === "advanced")
        : [{
            key: "team-battle-league-4v4",
            label: "Team Battle League 4v4",
            status: "beta",
            publicNote: "Formato avançado em beta controlado com equipes de 4 jogadores, Divisão Única no MVP básico, partidas por escalação e Playoffs -SBW-."
          }];

      advancedFormatPanel.innerHTML = `
        <div class="advanced-format-panel__head">
          <div>
            <strong>Formatos avançados da plataforma -SBW-</strong>
            <span>Esta base prepara formatos especiais sem liberar estruturas incompletas no torneio real.</span>
          </div>
          <span class="advanced-format-pill">Roadmap competitivo</span>
        </div>
        <div class="advanced-format-grid">
          ${advancedFormats.map((format) => `
            <article class="advanced-format-card">
              <strong>${escapeHTML(format.label || format.key || "Formato avançado")}</strong>
              <span>${format.status === "active" ? "Disponível" : format.status === "beta" ? "Beta controlado" : "Em preparação"}</span>
              <p>${escapeHTML(format.publicNote || format.description || "Formato planejado para fases futuras da plataforma.")}</p>
            </article>
          `).join("")}
        </div>
      `;
    }


    function renderTeamBattleLeagueCreationPreview(info) {
      const key = String(info?.key || "").toLowerCase();
      if (key !== "team-battle-league-4v4") return "";

      const helper = window.SBWTeamBattleLeague;
      const flow = helper && typeof helper.buildTeamBattleLeagueEfficientFlowSummary === "function"
        ? helper.buildTeamBattleLeagueEfficientFlowSummary({}, { leagueMode: "basic_single_division" })
        : null;
      const setupPreview = flow?.setup || (helper && typeof helper.buildTeamBattleLeagueBasicMvpSetupPreview === "function"
        ? helper.buildTeamBattleLeagueBasicMvpSetupPreview({}, { leagueMode: "basic_single_division" })
        : null);
      const board = flow?.board || null;
      const playoffPreview = board?.playoffPreview || null;
      const setupCards = Array.isArray(setupPreview?.cards) ? setupPreview.cards.slice(0, 4) : [];
      const setupFields = Array.isArray(setupPreview?.fields) ? setupPreview.fields.slice(0, 8) : [];
      const flowSteps = Array.isArray(flow?.steps) ? flow.steps : [
        { label: "Criar torneio", description: "Escolher Team Battle League 4v4 básica e revisar regras principais." },
        { label: "Molde da liga", description: "Depois de criado, a página mostra a Divisão Única vazia." },
        { label: "Check-in", description: "A tabela só recebe equipes reais confirmadas." }
      ];

      return `
        <div class="format-box__team-battle-preview format-box__team-battle-preview--efficient">
          <div class="format-box__team-battle-head">
            <strong>Configuração do Team Battle League 4v4 básico</strong>
            <span>Divisão única · sem equipes demo · preenchimento real após check-in</span>
          </div>

          <div class="format-box__team-battle-setup" aria-label="Configuração eficiente do MVP básico Team Battle League 4v4">
            <div class="format-box__team-battle-setup-head">
              <div>
                <strong>${escapeHTML(setupPreview?.label || "Configuração do formato")}</strong>
                <span>${escapeHTML(setupPreview?.previewNote || "Configure o modo na criação. A tabela pública começa vazia e recebe equipes reais após o check-in.")}</span>
              </div>
              <em>${escapeHTML(setupPreview?.badge || "Configuração visual")}</em>
            </div>
            <div class="format-box__team-battle-setup-cards">
              ${setupCards.map((card) => `
                <article>
                  <small>${escapeHTML(card.label || "Item")}</small>
                  <strong>${escapeHTML(card.value || "—")}</strong>
                  <p>${escapeHTML(card.detail || "Regra do MVP básico.")}</p>
                </article>
              `).join("")}
            </div>
            <div class="format-box__team-battle-setup-fields">
              ${setupFields.map((field) => `
                <span class="${field.locked ? "is-locked" : "is-editable"}">
                  <small>${escapeHTML(field.locked ? "Travado" : "Configurável")}</small>
                  ${escapeHTML(field.label || "Campo")}: <strong>${escapeHTML(field.value ?? "—")}</strong>
                </span>
              `).join("")}
            </div>
          </div>

          <div class="format-box__team-battle-flow" aria-label="Fluxo eficiente do formato">
            ${flowSteps.map((step, index) => `
              <article>
                <span>${escapeHTML(index + 1)}</span>
                <strong>${escapeHTML(step.label || step.title || "Etapa")}</strong>
                <p>${escapeHTML(step.description || step.text || "Etapa planejada do formato.")}</p>
              </article>
            `).join("")}
          </div>

          <div class="format-box__team-battle-empty-table" aria-label="Molde da tabela após criação">
            <div>
              <strong>${escapeHTML(board?.divisionName || "Divisão Única")}</strong>
              <span>${escapeHTML(board?.emptyState?.description || "A tabela aparece vazia após a criação e só recebe equipes reais depois do check-in.")}</span>
            </div>
            <div class="format-box__team-battle-empty-table-grid">
              <span>Pos.</span>
              <span>Equipe</span>
              <span>Pts</span>
              <span>V</span>
              <span>Saldo</span>
            </div>
          </div>

          <div class="format-box__notice">MVP básico liberado para criação controlada. A tabela pública nasce vazia e só será preenchida por equipes reais confirmadas após o check-in.</div>
          <div class="format-box__notice">Playoffs programados no modelo -SBW- em escada: Top 4, Quartas/Semifinal FT50, Grande Final FT70 e sem partida extra. ${escapeHTML(playoffPreview?.statusLabel || "Aguardando classificação real.")}</div>
        </div>
      `;
    }

    function renderTripleBracketCreationPreview(info) {
      if (!isTripleBracketFormat(info?.key || info?.implementationKey)) return "";

      const helper = window.SBWTripleBracket;
      const preview = helper && typeof helper.buildCreationPreview === "function"
        ? helper.buildCreationPreview()
        : {
            badge: "MVP 8 equipes",
            cards: [
              { label: "Fase inicial", value: "Todos contra todos", detail: "8 equipes · 28 partidas" },
              { label: "Corte", value: "Top 4 / Bottom 4", detail: "1º–4º Alta; 5º–8º Média" },
              { label: "Quedas", value: "Alta → Média → Baixa", detail: "Baixa é eliminação" },
              { label: "Final", value: "FT5 sem reset", detail: "Alta começa com vantagem" }
            ],
            flow: []
          };

      const cards = Array.isArray(preview.cards) ? preview.cards.slice(0, 4) : [];
      const flow = Array.isArray(preview.flow) ? preview.flow.slice(0, 4) : [];

      return `
        <div class="format-box__triple-preview" aria-label="Prévia do Sistema de 3 Chaves">
          <div class="format-box__team-battle-head">
            <strong>Sistema de 3 Chaves — base 8 equipes</strong>
            <span>${escapeHTML(preview.badge || "MVP 8 equipes")}</span>
          </div>
          <div class="format-box__triple-cards">
            ${cards.map((card) => `
              <article>
                <small>${escapeHTML(card.label || "Etapa")}</small>
                <strong>${escapeHTML(card.value || "—")}</strong>
                <p>${escapeHTML(card.detail || "Regra do formato.")}</p>
              </article>
            `).join("")}
          </div>
          ${flow.length ? `
            <div class="format-box__triple-flow">
              ${flow.map((step, index) => `
                <article>
                  <span>${escapeHTML(index + 1)}</span>
                  <strong>${escapeHTML(step.label || "Etapa")}</strong>
                  <p>${escapeHTML(step.description || "Fluxo do formato.")}</p>
                </article>
              `).join("")}
            </div>
          ` : ""}
          <div class="format-box__notice">Nesta primeira base, o modo nasce travado em 8 equipes. A geração/avanço automático completo deve entrar nos próximos patches, depois de validar a configuração salva no Supabase.</div>
        </div>
      `;
    }

    function renderFormatInfoDetails(info) {
      const features = Array.isArray(info.features) ? info.features.slice(0, 5) : [];
      const requirements = Array.isArray(info.requirements) ? info.requirements.slice(0, 5) : [];
      const statusLabel = info.status === "planned" ? "Em preparação" : info.status === "beta" ? "Beta controlado" : info.status === "active" ? "Disponível" : "Customizado";
      const categoryLabel = info.category === "advanced" ? "Formato avançado" : info.category === "core" ? "Formato base" : "Formato customizado";
      const notice = info.status === "planned"
        ? "Este formato aparece no roadmap da plataforma -SBW-, mas ainda não deve ser usado para criação real de torneio."
        : isTripleBracketFormat(info.key)
          ? "MVP estrutural liberado para criação controlada: exatamente 8 equipes, base Supabase e configuração salva para geração futura das chaves."
          : info.status === "beta"
            ? "MVP básico liberado para criação controlada: divisão única, equipes reais após check-in e sem equipes demo/fake."
            : "Formato disponível para criação dentro da estrutura atual da plataforma -SBW-.";

      return `
        <div class="format-box__title">
          <strong>${escapeHTML(info.title)}</strong>
          <span class="format-box__meta">${escapeHTML(categoryLabel)} · ${escapeHTML(statusLabel)}</span>
        </div>
        <span>${escapeHTML(info.description)}</span>
        ${features.length ? `<div class="format-box__chips">${features.map((item) => `<span>${escapeHTML(item)}</span>`).join("")}</div>` : ""}
        ${requirements.length ? `
          <ul class="format-box__list">
            ${requirements.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}
          </ul>
        ` : ""}
        ${renderTripleBracketCreationPreview(info)}
        ${renderTeamBattleLeagueCreationPreview(info)}
        <div class="format-box__notice">${escapeHTML(notice)}</div>
      `;
    }

    function applyTournamentCapacityMode(format = formatSelect?.value || "") {
      if (!maxPlayersInput) return;

      const isTeamBattle = isTeamBattleLeague4v4Format(format);
      const isTripleBracket = isTripleBracketFormat(format);
      const isTeamMode = isTeamEntryTournamentFormat(format);

      maxPlayersInput.min = isTripleBracket ? "8" : "2";
      maxPlayersInput.max = isTripleBracket ? "8" : "256";
      maxPlayersInput.step = isTripleBracket ? "1" : "2";
      maxPlayersInput.placeholder = isTripleBracket ? "8 equipes" : isTeamBattle ? "Ex: 8 equipes" : "Ex: 32";

      if (isTripleBracket) {
        maxPlayersInput.value = "8";
        maxPlayersInput.readOnly = true;
      } else {
        maxPlayersInput.readOnly = false;
      }

      if (maxPlayersLabel) {
        maxPlayersLabel.textContent = isTeamMode ? "Limite de equipes *" : "Limite de participantes *";
      }

      if (maxPlayersHint) {
        maxPlayersHint.textContent = isTripleBracket
          ? "Sistema de 3 Chaves nasce travado em exatamente 8 equipes no MVP. Não use este modo para torneio rápido ou quantidade variável."
          : isTeamBattle
            ? "Neste formato, o limite representa equipes reais 4v4. Use sempre número par; se a quantidade final confirmada for ímpar, a tabela/bracket aplica bye/encaixe conforme planejado."
            : "Use capacidade em número par. Se o torneio terminar com número ímpar de inscritos reais, a bracket usa bye/encaixe normalmente.";
        maxPlayersHint.classList.toggle("is-team-mode", isTeamMode);
      }

      if (String(maxPlayersInput.value || "").trim()) {
        const normalized = isTripleBracket
          ? 8
          : normalizeEvenTournamentCapacity(maxPlayersInput.value, {
              fallback: getDefaultCapacityForFormat(format)
            });
        if (String(normalized) !== String(maxPlayersInput.value)) {
          maxPlayersInput.value = normalized;
        }
      }
    }

    function getTournamentCapacityFromInput(format = formatSelect?.value || "") {
      const normalized = isTripleBracketFormat(format)
        ? 8
        : normalizeEvenTournamentCapacity(maxPlayersInput?.value, {
            fallback: getDefaultCapacityForFormat(format)
          });

      if (maxPlayersInput) {
        maxPlayersInput.value = normalized;
      }

      return normalized;
    }

    function updateFormatInfo() {
      const selectedFormat = formatSelect.value;
      const info = getTournamentFormatDefinition(selectedFormat);

      formatInfo.innerHTML = renderFormatInfoDetails(info);

      renderAdvancedFormatsPanel();
      renderDynamicSettings(selectedFormat);
      applyTournamentCapacityMode(selectedFormat);
      applyPhaseRulesPreset();
    }

    function getValidGroupPresets(totalQualified) {
      const possibleGroupCounts = [2, 4, 8, 16, 32, 64];

      return possibleGroupCounts
        .filter((groupCount) => {
          return groupCount <= totalQualified && totalQualified % groupCount === 0;
        })
        .map((groupCount) => {
          return {
            groupCount,
            advancePerGroup: totalQualified / groupCount
          };
        });
    }

    function getGroupPresetLabel(preset) {
      return `${preset.groupCount} grupos → classificam ${preset.advancePerGroup} por grupo = ${preset.groupCount * preset.advancePerGroup}`;
    }

    function updateGroupPresetOptions() {
      const totalSelect = document.getElementById("playoffQualifiedTotal");
      const presetSelect = document.getElementById("groupPreset");
      const hint = document.getElementById("groupMathHint");

      if (!totalSelect || !presetSelect || !hint) return;

      const previousValue = presetSelect.value;
      const totalQualified = Number(totalSelect.value);
      const presets = getValidGroupPresets(totalQualified);

      presetSelect.innerHTML = presets
        .map((preset) => {
          const value = `${preset.groupCount}|${preset.advancePerGroup}`;
          return `<option value="${value}">${getGroupPresetLabel(preset)}</option>`;
        })
        .join("");

      const stillExists = Array.from(presetSelect.options).some((option) => {
        return option.value === previousValue;
      });

      if (stillExists) {
        presetSelect.value = previousValue;
      }

      updateGroupMathHint();
    }

    function updateGroupMathHint() {
      const totalSelect = document.getElementById("playoffQualifiedTotal");
      const presetSelect = document.getElementById("groupPreset");
      const hint = document.getElementById("groupMathHint");

      if (!totalSelect || !presetSelect || !hint) return;

      const totalQualified = Number(totalSelect.value);
      const maxPlayers = Number(maxPlayersInput.value);
      const [groupCount, advancePerGroup] = presetSelect.value.split("|").map(Number);

      hint.classList.remove("warning");

      if (maxPlayers < totalQualified) {
        hint.classList.add("warning");
        hint.innerHTML = `
          Atenção: o limite atual é de <strong>${maxPlayers}</strong> participantes,
          mas você escolheu <strong>${totalQualified}</strong> classificados para os playoffs.
        `;
        return;
      }

      if (maxPlayers < groupCount * 2) {
        hint.classList.add("warning");
        hint.innerHTML = `
          Atenção: com <strong>${groupCount}</strong> grupos, o ideal é ter pelo menos
          <strong>${groupCount * 2}</strong> participantes para evitar grupos com apenas 1 jogador.
        `;
        return;
      }

      hint.innerHTML = `
        Modelo selecionado: <strong>${groupCount}</strong> grupos, classificando
        <strong>${advancePerGroup}</strong> por grupo, totalizando
        <strong>${totalQualified}</strong> classificados.
      `;
    }

    function renderDynamicSettings(format) {
      if (format === "double-elimination") {
        dynamicSettings.innerHTML = `
          <div class="row">
            <div class="form-group">
              <label for="grandFinalReset">Grand Final com reset?</label>
              <select id="grandFinalReset">
                <option value="true" selected>Sim</option>
                <option value="false">Não</option>
              </select>
            </div>

            <div class="form-group">
              <label for="seedMode">Distribuição inicial</label>
              <select id="seedMode">
                <option value="manual">Manual</option>
                <option value="random" selected>Aleatória</option>
                <option value="ranking">Por ranking futuro</option>
              </select>
            </div>
          </div>
        `;
      }

      if (format === "groups-playoffs") {
        dynamicSettings.innerHTML = `
          <div class="row">
            <div class="form-group">
              <label for="playoffQualifiedTotal">Total de classificados para playoffs</label>
              <select id="playoffQualifiedTotal">
                <option value="8" selected>8 classificados</option>
                <option value="16">16 classificados</option>
                <option value="32">32 classificados</option>
                <option value="64">64 classificados</option>
              </select>
            </div>

            <div class="form-group">
              <label for="groupPreset">Modelo de grupos</label>
              <select id="groupPreset"></select>
            </div>
          </div>

          <div id="groupMathHint" class="math-hint"></div>

          <div class="row">
            <div class="form-group">
              <label for="playoffFormat">Formato dos playoffs</label>
              <select id="playoffFormat">
                <option value="single-elimination" selected>Eliminação simples</option>
                <option value="double-elimination">Double Elimination futuro</option>
              </select>
            </div>

            <div class="form-group">
              <label for="thirdPlaceMatch">Disputa de terceiro lugar</label>
              <select id="thirdPlaceMatch">
                <option value="true" selected>Sim, obrigatório</option>
              </select>
            </div>
          </div>
        `;

        updateGroupPresetOptions();
      }

      if (isTripleBracketFormat(format)) {
        dynamicSettings.innerHTML = `
          <div class="phase-rules-panel">
            <h3>Sistema de 3 Chaves — configuração do MVP</h3>
            <p>
              Este modo está travado em 8 equipes. A fase inicial será todos contra todos; depois, Top 4 entram na Chave Alta e 5º ao 8º entram na Chave Média.
            </p>
            <div class="row">
              <div class="form-group">
                <label for="tripleBracketGroupStage">Fase inicial</label>
                <input id="tripleBracketGroupStage" type="text" value="Todos contra todos — 8 equipes / 28 partidas" readonly />
              </div>
              <div class="form-group">
                <label for="tripleBracketFinalFormat">Grande Final</label>
                <input id="tripleBracketFinalFormat" type="text" value="FT5 sem reset, com vantagem da Chave Alta" readonly />
              </div>
            </div>
            <div class="row">
              <div class="form-group">
                <label for="tripleBracketAdvantageVsMiddle">Vantagem Alta vs Média</label>
                <input id="tripleBracketAdvantageVsMiddle" type="number" min="1" max="1" value="1" readonly />
              </div>
              <div class="form-group">
                <label for="tripleBracketAdvantageVsLow">Vantagem Alta vs Baixa</label>
                <input id="tripleBracketAdvantageVsLow" type="number" min="2" max="2" value="2" readonly />
              </div>
            </div>
            <div class="phase-rules-note">
              Base Supabase/configuração. Geração automática da tabela todos contra todos, três chaves e avanço entre chaves entram nas próximas etapas.
            </div>
          </div>
        `;
        return;
      }

      if (format === "league") {
        dynamicSettings.innerHTML = `
          <div class="row">
            <div class="form-group">
              <label for="pointsWin">Pontos por vitória</label>
              <input id="pointsWin" type="number" min="1" value="3" />
            </div>

            <div class="form-group">
              <label for="pointsLoss">Pontos por derrota</label>
              <input id="pointsLoss" type="number" min="0" value="0" />
            </div>
          </div>

          <div class="form-group">
            <label for="tieBreakers">Critérios de desempate</label>
            <input id="tieBreakers" type="text" value="Pontos, saldo de sets, vitórias, sets vencidos" />
          </div>
        `;
      }
    }

    function getDynamicSettings(format) {
      if (format === "double-elimination") {
        return {
          grandFinalReset: document.getElementById("grandFinalReset").value === "true",
          seedMode: document.getElementById("seedMode").value
        };
      }

      if (format === "groups-playoffs") {
        const playoffQualifiedTotal = Number(document.getElementById("playoffQualifiedTotal").value);
        const [groupCount, advancePerGroup] = document.getElementById("groupPreset").value.split("|").map(Number);

        return {
          playoffQualifiedTotal,
          groupCount,
          advancePerGroup,
          playoffFormat: document.getElementById("playoffFormat").value,
          thirdPlaceMatch: document.getElementById("thirdPlaceMatch").value === "true"
        };
      }

      if (isTripleBracketFormat(format)) {
        const helper = window.SBWTripleBracket;
        const draft = helper && typeof helper.buildCreationDraft === "function"
          ? helper.buildCreationDraft({
              title: document.getElementById("title")?.value || "",
              game: document.getElementById("game")?.value || ""
            })
          : null;

        const config = draft?.config || {
          formatKey: "triple-bracket",
          schemaVersion: "triplebracket.v1",
          requiredTeams: 8,
          groupStageType: "round_robin",
          groupStageMatches: 28,
          highBracketQualifiers: 4,
          middleBracketQualifiers: 4,
          finalSeries: {
            type: "single_series_with_advantage",
            matchFormat: "FT5",
            noReset: true,
            highAdvantageVsMiddle: 1,
            highAdvantageVsLow: 2,
            advantageUnit: "games"
          },
          automationStage: "base_config"
        };

        return {
          tripleBracket: draft || { config },
          triple_bracket: draft || { config },
          formatKey: "triple-bracket",
          schemaVersion: "triplebracket.v1",
          requiredTeams: 8,
          exactTeamCount: true,
          groupStageType: "round_robin",
          groupStageMatches: 28,
          highBracketQualifiers: 4,
          middleBracketQualifiers: 4,
          finalSeriesTarget: 5,
          grandFinalReset: false,
          finalAdvantage: {
            highAdvantageVsMiddle: 1,
            highAdvantageVsLow: 2,
            advantageUnit: "games"
          }
        };
      }

      if (format === "league") {
        return {
          pointsWin: Number(document.getElementById("pointsWin").value),
          pointsLoss: Number(document.getElementById("pointsLoss").value),
          tieBreakers: document.getElementById("tieBreakers").value,
          hasFinalBracket: false
        };
      }

      return {};
    }

    function validateTournamentForm() {
      const requiredFields = [
        ["title", "Nome do torneio"],
        ["game", "Jogo"],
        ["platform", "Plataforma"],
        ["format", "Formato do torneio"],
        ["maxPlayers", "Limite de participantes"],
        ["matchFormat", "Formato das partidas"],
        ["startDate", "Data de início"],
        ["startTime", "Horário de início"],
        ["checkin", "Check-in"],
        ["status", "Status inicial"]
      ];

      for (const [id, label] of requiredFields) {
        const element = document.getElementById(id);

        if (!element || String(element.value).trim() === "") {
          alert(`Preencha o campo obrigatório: ${label}.`);
          if (element) element.focus();
          return false;
        }
      }

      const selectedOrganizer = getSelectedOrganizer();

      if (!selectedOrganizer || !organizerCanCreateTournament(selectedOrganizer)) {
        alert("Você precisa selecionar uma organização onde tenha permissão para criar torneios.");
        if (organizerSelect) organizerSelect.focus();
        return false;
      }

      const selectedFormat = document.getElementById("format")?.value || "";

      if (isTripleBracketFormat(selectedFormat) && Number(document.getElementById("maxPlayers")?.value || 0) !== 8) {
        alert("Sistema de 3 Chaves exige exatamente 8 equipes nesta primeira versão.");
        document.getElementById("maxPlayers")?.focus();
        return false;
      }

      if (!isTournamentFormatAvailableForCreation(selectedFormat)) {
        alert(getTournamentFormatCreationBlockReason(selectedFormat));
        if (formatSelect) {
          formatSelect.value = "double-elimination";
          updateFormatInfo();
          formatSelect.focus();
        }
        return false;
      }

      const maxPlayers = getTournamentCapacityFromInput(selectedFormat);
      const capacityLabel = isTeamEntryTournamentFormat(selectedFormat) ? "equipes" : "participantes";

      if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 256 || maxPlayers % 2 !== 0) {
        alert(`O limite de ${capacityLabel} precisa estar entre 2 e 256 e sempre em número par.`);
        document.getElementById("maxPlayers").focus();
        return false;
      }

      if (!validateTournamentWindows()) {
        return false;
      }

      return true;
    }

    function buildTripleBracketCreationDraft(format, context = {}) {
      if (!isTripleBracketFormat(format)) return null;

      const helper = window.SBWTripleBracket;
      if (helper && typeof helper.buildCreationDraft === "function") {
        return helper.buildCreationDraft(context);
      }

      return {
        formatKey: "triple-bracket",
        schemaVersion: "triplebracket.v1",
        title: context.title || "Sistema de 3 Chaves",
        game: context.game || "",
        status: "base_config",
        config: {
          formatKey: "triple-bracket",
          schemaVersion: "triplebracket.v1",
          requiredTeams: 8,
          groupStageType: "round_robin",
          groupStageMatches: 28,
          highBracketQualifiers: 4,
          middleBracketQualifiers: 4,
          finalSeries: {
            type: "single_series_with_advantage",
            matchFormat: "FT5",
            noReset: true,
            highAdvantageVsMiddle: 1,
            highAdvantageVsLow: 2,
            advantageUnit: "games"
          },
          automationStage: "base_config"
        }
      };
    }

    function buildTeamBattleLeagueCreationDraft(format, context = {}) {
      if (String(format || "") !== "team-battle-league-4v4") return null;

      const helper = window.SBWTeamBattleLeague;

      if (helper && typeof helper.buildTeamBattleLeagueBasicControlledCreationPayload === "function") {
        return helper.buildTeamBattleLeagueBasicControlledCreationPayload(context, {
          leagueMode: "basic_single_division"
        });
      }

      const createdAt = new Date().toISOString();
      const payload = {
        enabled: true,
        formatKey: "team-battle-league-4v4",
        schemaVersion: "tbleague4v4.v1",
        status: "beta_controlled",
        leagueMode: "basic_single_division",
        divisionName: "Divisão Única",
        source: "real_checkin_only",
        realTeamsOnly: true,
        publicMoldBeforeCheckin: true,
        checkinRequiredBeforeTeams: true,
        teamSize: 4,
        startersPerTeamMatch: 3,
        reservePerTeamMatch: 1,
        mainMatchPointsBySlot: [10, 10, 20],
        defaultExtraMatchPoints: 10,
        organizerManagedSchedule: true,
        longFormLeague: true,
        scheduleMode: "organizer_per_match",
        scheduleTimezone: "America/Sao_Paulo",
        allowRoundSchedule: true,
        allowMatchScheduleOverride: true,
        allowReschedule: true,
        matchScheduling: {
          organizerManaged: true,
          mode: "organizer_per_match",
          timezone: "America/Sao_Paulo",
          allowRoundSchedule: true,
          allowMatchScheduleOverride: true,
          allowReschedule: true,
          publicLabel: "Datas e horários definidos pelo organizador"
        },
        createdAt
      };

      return {
        settings: payload,
        metadata: {
          ...payload,
          title: context.title || "",
          game: context.game || "",
          organizerName: context.organizerName || ""
        }
      };
    }

    function buildOptionalDateTimeValue(dateId, timeId) {
      const dateValue = String(document.getElementById(dateId)?.value || "").trim();
      const timeValue = String(document.getElementById(timeId)?.value || "").trim();

      if (!dateValue) {
        return "";
      }

      return `${dateValue}T${timeValue || "00:00"}:00`;
    }

    function validateTournamentWindows() {
      const registrationOpensAt = buildOptionalDateTimeValue("registrationOpensDate", "registrationOpensTime");
      const registrationClosesAt = buildOptionalDateTimeValue("registrationClosesDate", "registrationClosesTime");
      const checkinStartsAt = buildOptionalDateTimeValue("checkinStartsDate", "checkinStartsTime");
      const checkinEndsAt = buildOptionalDateTimeValue("checkinEndsDate", "checkinEndsTime");

      const pairs = [
        [registrationOpensAt, registrationClosesAt, "A abertura das inscrições precisa ser antes do fechamento."],
        [checkinStartsAt, checkinEndsAt, "A abertura do check-in precisa ser antes do fechamento."]
      ];

      for (const [start, end, message] of pairs) {
        if (start && end && new Date(start).getTime() >= new Date(end).getTime()) {
          alert(message);
          return false;
        }
      }

      if (registrationClosesAt && checkinStartsAt && new Date(registrationClosesAt).getTime() > new Date(checkinStartsAt).getTime()) {
        alert("O check-in deve abrir no mesmo momento ou depois do fechamento das inscrições.");
        return false;
      }

      return true;
    }

    function createTournamentObject() {
      const title = document.getElementById("title").value.trim();
      const game = document.getElementById("game").value.trim();
      const format = document.getElementById("format").value;
      const selectedOrganizer = getSelectedOrganizer();
      const organizerName = selectedOrganizer?.name || selectedOrganizer?.displayName || currentUser.name;
      const matchPhaseRules = getMatchPhaseRules();
      const rankingEnabled = document.getElementById("rankingEnabled")?.value !== "false";
      const formatDefinition = getTournamentFormatDefinition(format);
      const formatMetadata = getTournamentFormatMetadata(format);
      const teamBattleLeagueDraft = buildTeamBattleLeagueCreationDraft(format, {
        title,
        game,
        organizerName,
        rankingEnabled
      });
      const tripleBracketDraft = buildTripleBracketCreationDraft(format, {
        title,
        game,
        organizerName,
        rankingEnabled
      });
      const tournamentCapacity = getTournamentCapacityFromInput(format);
      const isTeamBattleLeagueTournament = isTeamBattleLeague4v4Format(format);
      const isTripleBracketTournament = isTripleBracketFormat(format);
      const isTeamEntryTournament = isTeamEntryTournamentFormat(format);
      const registrationOpensAt = buildOptionalDateTimeValue("registrationOpensDate", "registrationOpensTime");
      const registrationClosesAt = buildOptionalDateTimeValue("registrationClosesDate", "registrationClosesTime");
      const checkinStartsAt = buildOptionalDateTimeValue("checkinStartsDate", "checkinStartsTime");
      const checkinEndsAt = buildOptionalDateTimeValue("checkinEndsDate", "checkinEndsTime");

      return {
        id: `sbw-${Date.now()}`,
        slug: generateSlug(title),
        title,
        game,
        platform: document.getElementById("platform").value,
        format,
        formatLabel: formatDefinition.title,
        formatFamily: formatDefinition.family,
        formatStatus: formatDefinition.status,
        advancedFormatKey: formatDefinition.category === "advanced" ? format : "",
        status: document.getElementById("status").value,

        organizerId: selectedOrganizer?.id || currentUser.id,
        organizerSlug: selectedOrganizer?.slug || "",
        organizerName,
        selectedOrganizer,

        organizer: {
          id: selectedOrganizer?.id || currentUser.id,
          slug: selectedOrganizer?.slug || "",
          name: organizerName,
          displayName: organizerName,
          role: selectedOrganizer?.memberRole || selectedOrganizer?.role || currentUser.role,
          authorized: currentUser.permissions.canCreateTournament
        },

        schedule: {
          startDate: document.getElementById("startDate").value,
          startTime: document.getElementById("startTime").value,
          checkin: "required",
          registrationOpensAt,
          registrationClosesAt,
          checkinStartsAt,
          checkinEndsAt
        },

        registrationOpensAt,
        registrationClosesAt,
        checkinStartsAt,
        checkInStartsAt: checkinStartsAt,
        checkinEndsAt,
        checkInEndsAt: checkinEndsAt,

        settings: {
          maxPlayers: tournamentCapacity,
          maxParticipants: tournamentCapacity,
          participantCapacityUnit: isTeamEntryTournament ? "teams" : "participants",
          capacityUnit: isTeamEntryTournament ? "teams" : "participants",
          ...(isTeamBattleLeagueTournament ? {
            matchScheduling: teamBattleLeagueDraft?.settings?.matchScheduling || {
              organizerManaged: true,
              mode: "organizer_per_match",
              timezone: "America/Sao_Paulo",
              allowRoundSchedule: true,
              allowMatchScheduleOverride: true,
              allowReschedule: true
            },
            organizerManagedSchedule: true,
            longFormLeague: true,
            maxTeams: tournamentCapacity,
            teamLimit: tournamentCapacity,
            teamCapacity: tournamentCapacity
          } : {}),
          matchFormat: matchPhaseRules.defaultFormat,
          checkInRequired: true,
          registrationOpensAt,
          registrationClosesAt,
          checkinStartsAt,
          checkInStartsAt: checkinStartsAt,
          checkinEndsAt,
          checkInEndsAt: checkinEndsAt,
          phaseRules: matchPhaseRules,
          matchPhaseRules,
          formatFamily: formatDefinition.family,
          formatStatus: formatDefinition.status,
          teamMode: formatDefinition.teamMode,
          formatConfig: formatMetadata,
          rankingEnabled,
          ranking_enabled: rankingEnabled,
          countsForRanking: rankingEnabled,
          counts_for_ranking: rankingEnabled,
          countsForOrganizerRanking: rankingEnabled,
          counts_for_organizer_ranking: rankingEnabled,
          globalRankingEligible: rankingEnabled,
          global_ranking_eligible: rankingEnabled,
          sbwGlobalRankingEligible: rankingEnabled,
          rankingScope: rankingEnabled ? "organizer_and_global" : "none",
          rankingLabel: rankingEnabled
            ? "Pontua no ranking do organizador e no Ranking Global -SBW-"
            : "Torneio sem pontuação",
          ...(teamBattleLeagueDraft ? {
            teamBattleLeague: teamBattleLeagueDraft.settings,
            team_battle_league: teamBattleLeagueDraft.settings
          } : {}),
          ...(tripleBracketDraft ? {
            tripleBracket: tripleBracketDraft,
            triple_bracket: tripleBracketDraft
          } : {}),
          ...getDynamicSettings(format)
        },

        metadata: {
          format: formatMetadata,
          capacity: {
            value: tournamentCapacity,
            unit: isTeamEntryTournament ? "teams" : "participants",
            evenOnly: !isTripleBracketTournament,
            exactRequired: isTripleBracketTournament ? 8 : null
          },
          registration: {
            opensAt: registrationOpensAt,
            closesAt: registrationClosesAt
          },
          checkin: {
            startsAt: checkinStartsAt,
            endsAt: checkinEndsAt,
            required: true
          },
          ...(isTeamBattleLeagueTournament ? {
            matchScheduling: teamBattleLeagueDraft?.metadata?.matchScheduling || teamBattleLeagueDraft?.settings?.matchScheduling || {
              organizerManaged: true,
              mode: "organizer_per_match",
              timezone: "America/Sao_Paulo",
              allowRoundSchedule: true,
              allowMatchScheduleOverride: true,
              allowReschedule: true
            }
          } : {}),
          ...(teamBattleLeagueDraft ? {
            teamBattleLeague: teamBattleLeagueDraft.metadata,
            team_battle_league: teamBattleLeagueDraft.metadata
          } : {}),
          ...(tripleBracketDraft ? {
            tripleBracket: tripleBracketDraft,
            triple_bracket: tripleBracketDraft
          } : {}),
          ranking: {
            enabled: rankingEnabled,
            countsForRanking: rankingEnabled,
            countsForOrganizerRanking: rankingEnabled,
            globalRankingEligible: rankingEnabled,
            scope: rankingEnabled ? "organizer_and_global" : "none",
            label: rankingEnabled
              ? "Pontua no ranking do organizador e no Ranking Global -SBW-"
              : "Torneio sem pontuação"
          }
        },

        prize: document.getElementById("prize").value.trim(),
        rules: document.getElementById("rules").value.trim(),

        participants: [],
        matches: [],
        standings: [],
        structure: null,

        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    function canManageSupabaseTournamentInPanel(tournament) {
      if (!isSupabaseTournament(tournament)) {
        return true;
      }

      if (!currentAuthUser?.id) {
        return false;
      }

      if (String(tournament.createdByAuthUserId || tournament.raw?.created_by_auth_user_id || "") === String(currentAuthUser.id)) {
        return true;
      }

      const organizerKeys = new Set(
        availableTournamentOrganizers
          .flatMap((organizer) => [organizer.id, organizer.slug, organizer.name, organizer.displayName])
          .map((value) => String(value || "").trim().toLowerCase())
          .filter(Boolean)
      );

      return [tournament.organizerId, tournament.organizerSlug, tournament.organizerName, tournament.organizer]
        .some((value) => organizerKeys.has(String(value || "").trim().toLowerCase()));
    }

    async function loadManagedTournaments() {
      const localTournaments = getSavedTournaments();

      if (typeof sbwGetAllTournamentsAsync !== "function" || !sbwIsSupabaseEnabled()) {
        managedTournamentsCache = localTournaments;
        return managedTournamentsCache;
      }

      try {
        const allTournaments = await sbwGetAllTournamentsAsync();
        const supabaseTournaments = allTournaments
          .filter((tournament) => isSupabaseTournament(tournament))
          .filter(canManageSupabaseTournamentInPanel);

        const localIds = new Set(localTournaments.map((tournament) => String(tournament.id || tournament.slug || "")));
        const uniqueSupabaseTournaments = supabaseTournaments.filter((tournament) => {
          const key = String(tournament.id || tournament.slug || tournament.supabaseId || "");
          return !localIds.has(key);
        });

        managedTournamentsCache = [
          ...uniqueSupabaseTournaments,
          ...localTournaments
        ];
      } catch (error) {
        console.warn("[SBW Torneios] Não foi possível carregar torneios gerenciáveis do Supabase:", error);
        managedTournamentsCache = localTournaments;
      }

      return managedTournamentsCache;
    }

    async function renderSavedTournaments() {
      savedList.innerHTML = `
        <div class="saved-item">
          <span>Carregando torneios gerenciáveis...</span>
        </div>
      `;

      const tournaments = await loadManagedTournaments();

      if (tournaments.length === 0) {
        savedList.innerHTML = `
          <div class="saved-item">
            <span>Nenhum torneio encontrado para gerenciamento. Crie um torneio real no Supabase ou salve um torneio local neste navegador.</span>
          </div>
        `;
        return;
      }

      savedList.innerHTML = tournaments
        .slice()
        .reverse()
        .map((tournament) => {
          const participantsCount = Number(
            isSupabaseTournament(tournament)
              ? (tournament.currentParticipants || tournament.participantsCount || 0)
              : (Array.isArray(tournament.participants) ? tournament.participants.length : 0)
          );
          const maxPlayers = getTournamentMaxPlayers(tournament);
          const isTeamBattleLeagueTournament = isTeamBattleLeague4v4Format(tournament?.format || tournament?.formatKey || tournament?.settings?.formatConfig?.key || tournament?.metadata?.format?.key);
          const capacityUnitLabel = isTeamBattleLeagueTournament ? "equipes" : "participantes";
          const manageUnitLabel = isTeamBattleLeagueTournament ? "Gerenciar equipes" : "Gerenciar inscritos";
          const hasStructure = tournament.structure ? " | Estrutura gerada" : "";
          const sourceLabel = isSupabaseTournament(tournament) ? "Supabase" : "Local";
          const lookupValue = getTournamentLookupValue(tournament);
          const canDeleteLocally = !isSupabaseTournament(tournament);
          const organizerIdentity = getTournamentOrganizerIdentity(tournament);
          const phaseRulesSummary = getTournamentPhaseRulesSummary(tournament);

          return `
            <div class="saved-item ${isSupabaseTournament(tournament) ? "saved-item-supabase" : ""}">
              ${canDeleteLocally ? `
                <label class="saved-select-line">
                  <input type="checkbox" data-select-tournament="${escapeHTML(lookupValue)}" />
                  <span>Selecionar para excluir</span>
                </label>
              ` : `
                <div class="saved-select-line">
                  <span>Banco real | exclusão será tratada em etapa futura</span>
                </div>
              `}

              <div class="saved-item-top">
                <div>
                  <strong>${escapeHTML(tournament.title || tournament.name || "Torneio")}</strong>
                  <div class="saved-organization-line">
                    <b>Organização</b>
                    <span>${escapeHTML(organizerIdentity.label)}</span>
                    ${organizerIdentity.shortKey ? `<span class="saved-organization-slug">${escapeHTML(organizerIdentity.shortKey)}</span>` : ""}
                  </div>
                  <span>
                    ${escapeHTML(tournament.game || tournament.gameName || "Jogo")} |
                    ${escapeHTML(getTournamentFormatLabel(tournament))} |
                    ${escapeHTML(tournament.status)} |
                    ${participantsCount}/${maxPlayers || "?"} ${capacityUnitLabel} |
                    ${sourceLabel}
                    ${hasStructure}
                  </span>
                  <span class="saved-rules-line">${escapeHTML(phaseRulesSummary)}</span>
                </div>

                <button
                  type="button"
                  class="btn-secondary btn-small"
                  data-action="manage-tournament"
                  data-id="${escapeHTML(lookupValue)}"
                >
                  ${escapeHTML(manageUnitLabel)}
                </button>
              </div>
            </div>
          `;
        })
        .join("");
    }

    function setSavedTournamentsSelection(selected) {
      savedList.querySelectorAll("[data-select-tournament]").forEach((checkbox) => {
        checkbox.checked = selected;
      });
    }

    function deleteSelectedTournaments() {
      const selectedIds = Array.from(savedList.querySelectorAll("[data-select-tournament]:checked"))
        .map((checkbox) => checkbox.dataset.selectTournament);

      if (selectedIds.length === 0) {
        alert("Selecione pelo menos um torneio para excluir.");
        return;
      }

      const confirmDelete = confirm(`Excluir ${selectedIds.length} torneio(s) selecionado(s)?`);
      if (!confirmDelete) return;

      const tournaments = getSavedTournaments();
      const filteredTournaments = tournaments.filter((tournament) => !selectedIds.includes(tournament.id));

      selectedIds.forEach(clearDraftsForTournament);

      if (selectedTournamentId && selectedIds.includes(selectedTournamentId)) {
        selectedTournamentId = null;
        managerArea.classList.add("hidden");
      }

      saveAllTournaments(filteredTournaments);
      renderSavedTournaments();

      previewOutput.textContent = `${selectedIds.length} torneio(s) selecionado(s) foram excluídos.`;
      successMessage.classList.add("hidden");
    }

    function playerToMatchPlayer(participant) {
      if (!participant) return null;

      return {
        id: participant.id,
        participantId: participant.participantId || participant.id || "",
        profileId: participant.profileId || participant.profile_id || "",
        playerSlug: participant.playerSlug || participant.player_slug || "",
        authUserId: participant.authUserId || participant.auth_user_id || "",
        nickname: participant.nickname,
        team: participant.team || "",
        character: participant.character || "",
        platform: participant.platform || ""
      };
    }

    function getPlayerName(player) {
      if (!player) return "BYE / Descanso";
      return escapeHTML(player.nickname);
    }

    function getRawPlayerName(player) {
      if (!player) return "BYE / Descanso";
      return player.nickname;
    }

    function getTournamentCheckinMode(tournament) {
      return String(
        tournament?.schedule?.checkin ||
        tournament?.settings?.schedule?.checkin ||
        tournament?.settings?.checkin ||
        "required"
      ).toLowerCase();
    }

    function isParticipantEligibleForStructure(participant, tournament) {
      const status = String(participant?.status || "registered").toLowerCase();
      const checkinMode = getTournamentCheckinMode(tournament);

      if (status !== "registered") {
        return false;
      }

      if (checkinMode === "required") {
        return getParticipantCheckinValue(participant);
      }

      return true;
    }

    function getEligibleParticipants(tournament) {
      const participants = Array.isArray(tournament?.participants)
        ? tournament.participants.map(normalizeAdminParticipant)
        : [];

      return participants.filter((participant) => isParticipantEligibleForStructure(participant, tournament));
    }


    function isTripleBracketTournament(tournament) {
      const rawFormat = tournament?.format || tournament?.settings?.formatKey || tournament?.settings?.format_key || "";

      if (window.SBWTripleBracket && typeof window.SBWTripleBracket.isTripleBracketFormat === "function") {
        return window.SBWTripleBracket.isTripleBracketFormat(rawFormat);
      }

      return ["triple-bracket", "triple_bracket", "triple-bracket-8", "sistema-3-chaves", "sistema-de-3-chaves"].includes(String(rawFormat || "").trim().toLowerCase());
    }

    function shuffleArray(items) {
      const shuffled = [...items];

      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      return shuffled;
    }

    function getNextPowerOfTwo(value) {
      let power = 1;

      while (power < value) {
        power *= 2;
      }

      return power;
    }

    function createStandingRow(player) {
      return {
        participantId: player.id,
        profileId: player.profileId || player.profile_id || "",
        profileSlug: player.profileSlug || player.profile_slug || player.playerSlug || player.player_slug || "",
        playerSlug: player.playerSlug || player.player_slug || player.profileSlug || player.profile_slug || "",
        authUserId: player.authUserId || player.auth_user_id || "",
        nickname: player.nickname,
        team: player.team || "",
        played: 0,
        wins: 0,
        losses: 0,
        setsWon: 0,
        setsLost: 0,
        setBalance: 0,
        points: 0,
        winRate: 0
      };
    }

    function buildRoundRobinRounds(players, prefix) {
      const pool = players.map(playerToMatchPlayer);

      if (pool.length % 2 !== 0) {
        pool.push(null);
      }

      const totalSlots = pool.length;
      const totalRounds = totalSlots - 1;
      let rotation = [...pool];
      const rounds = [];

      for (let roundIndex = 0; roundIndex < totalRounds; roundIndex += 1) {
        const matches = [];

        for (let matchIndex = 0; matchIndex < totalSlots / 2; matchIndex += 1) {
          const playerA = rotation[matchIndex];
          const playerB = rotation[totalSlots - 1 - matchIndex];

          matches.push({
            id: `${prefix}-r${roundIndex + 1}-m${matchIndex + 1}`,
            round: roundIndex + 1,
            order: matchIndex + 1,
            playerA,
            playerB,
            status: playerA && playerB ? "pending" : "bye",
            scoreA: null,
            scoreB: null,
            winnerId: null
          });
        }

        rounds.push({
          id: `${prefix}-round-${roundIndex + 1}`,
          name: `Rodada ${roundIndex + 1}`,
          matches
        });

        const fixed = rotation[0];
        const rest = rotation.slice(1);
        const last = rest.pop();

        rotation = [fixed, last, ...rest];
      }

      return rounds;
    }

        function generateLeagueStructure(tournament, participants) {
      const players = participants.map(playerToMatchPlayer);

      return {
        type: "league",
        label: "Pontos Corridos / Liga",
        generatedAt: new Date().toISOString(),
        playersUsed: players.length,
        rules: {
          pointsWin: tournament.settings.pointsWin || 3,
          pointsLoss: tournament.settings.pointsLoss || 0,
          tieBreakers: tournament.settings.tieBreakers || "Pontos, saldo de sets, vitórias, sets vencidos",
          hasFinalBracket: false
        },
        standings: players.map(createStandingRow),
        rounds: buildRoundRobinRounds(participants, `${tournament.slug || tournament.id}-league`)
      };
    }


    function generateTripleBracketGroupStageStructure(tournament, participants) {
      if (!window.SBWTripleBracket || typeof window.SBWTripleBracket.buildGroupStageStructure !== "function") {
        alert("Helper do Sistema de 3 Chaves não foi carregado. Confira se triple-bracket.js está incluído na página.");
        return null;
      }

      const validation = window.SBWTripleBracket.validateGroupStageParticipants(participants);

      if (!validation.valid) {
        alert(validation.message);
        return null;
      }

      if (validation.templateMode) {
        console.info("[SBW Triple Bracket] Gerando estrutura modelo com vagas em aberto:", validation.message);
      }

      const result = window.SBWTripleBracket.buildGroupStageStructure(tournament, participants, {
        matchFormat: tournament?.settings?.matchFormat || tournament?.matchFormat || "MD3"
      });

      if (!result || !result.success || !result.structure) {
        alert(result?.message || "Não foi possível gerar a fase todos contra todos do Sistema de 3 Chaves.");
        return null;
      }

      return result.structure;
    }

    function validateGroupsMath(tournament, participants) {
      const totalQualified = tournament.settings.playoffQualifiedTotal || 8;
      const groupCount = tournament.settings.groupCount || 2;
      const advancePerGroup = tournament.settings.advancePerGroup || 1;

      if (participants.length < totalQualified) {
        return {
          valid: false,
          message: `Este modelo precisa de pelo menos ${totalQualified} participantes válidos, pois ${totalQualified} avançam aos playoffs. Participantes válidos agora: ${participants.length}.`
        };
      }

      if (groupCount * advancePerGroup !== totalQualified) {
        return {
          valid: false,
          message: "A matemática de grupos não fecha. Escolha um modelo válido."
        };
      }

      if (participants.length < groupCount * 2) {
        return {
          valid: false,
          message: `Este modelo usa ${groupCount} grupos. Para evitar grupos com apenas 1 jogador, use pelo menos ${groupCount * 2} participantes válidos ou escolha menos grupos.`
        };
      }

      return { valid: true };
    }

    function generateGroupsStructure(tournament, participants) {
      const validation = validateGroupsMath(tournament, participants);

      if (!validation.valid) {
        alert(validation.message);
        return null;
      }

      const groupCount = tournament.settings.groupCount;
      const advancePerGroup = tournament.settings.advancePerGroup;
      const totalQualified = tournament.settings.playoffQualifiedTotal;
      const shuffledParticipants = shuffleArray(participants);

      const groups = Array.from({ length: groupCount }, (_, index) => ({
        id: `group-${index + 1}`,
        name: `Grupo ${String.fromCharCode(65 + index)}`,
        players: [],
        standings: [],
        rounds: []
      }));

      shuffledParticipants.forEach((participant, index) => {
        groups[index % groupCount].players.push(playerToMatchPlayer(participant));
      });

      groups.forEach((group) => {
        group.standings = group.players.map(createStandingRow);
        group.rounds = buildRoundRobinRounds(group.players, `${tournament.slug || tournament.id}-${group.id}`);
      });

      return {
        type: "groups-playoffs",
        label: "Grupos + Playoffs",
        generatedAt: new Date().toISOString(),
        playersUsed: participants.length,
        settings: {
          playoffQualifiedTotal: totalQualified,
          groupCount,
          advancePerGroup,
          playoffFormat: tournament.settings.playoffFormat || "single-elimination",
          thirdPlaceMatch: true
        },
        groups,
        playoffs: {
          status: "waiting-group-results",
          totalQualified,
          format: tournament.settings.playoffFormat || "single-elimination",
          thirdPlaceMatch: true,
          bracket: [],
          thirdPlace: null,
          message: "Playoffs serão gerados depois dos resultados da fase de grupos."
        }
      };
    }

function getDoubleEliminationLowerRoundCount(totalWinnerRounds) {
  return Math.max(0, (Number(totalWinnerRounds) - 1) * 2);
}

function getDoubleEliminationLowerMatchCount(targetSlots, lowerRoundNumber) {
  const divisorPower = Math.floor((Number(lowerRoundNumber) + 3) / 2);
  return Math.max(1, Math.floor(Number(targetSlots) / Math.pow(2, divisorPower)));
}

function getDoubleEliminationLowerRoundName(lowerRoundNumber, totalLowerRounds) {
  if (lowerRoundNumber === totalLowerRounds) {
    return "Lower Final";
  }

  if (lowerRoundNumber === totalLowerRounds - 1) {
    return "Lower Semi-Final";
  }

  if (lowerRoundNumber === totalLowerRounds - 2) {
    return "Lower Quarter";
  }

  return `Lower Round ${lowerRoundNumber}`;
}

function getDoubleEliminationLowerDrop(baseId, winnerRoundNumber, winnerMatchIndex) {
  if (winnerRoundNumber <= 1) {
    return {
      loserNextMatchId: `${baseId}-lb-r1-m${Math.floor(winnerMatchIndex / 2) + 1}`,
      loserNextSlot: winnerMatchIndex % 2 === 0 ? "playerA" : "playerB"
    };
  }

  return {
    loserNextMatchId: `${baseId}-lb-r${(winnerRoundNumber * 2) - 2}-m${winnerMatchIndex + 1}`,
    loserNextSlot: "playerB"
  };
}

function getDoubleEliminationLowerWinnerTarget(baseId, lowerRoundNumber, lowerMatchIndex, totalLowerRounds) {
  if (lowerRoundNumber >= totalLowerRounds) {
    return {
      nextMatchId: `${baseId}-gf-m1`,
      nextSlot: "playerB"
    };
  }

  if (lowerRoundNumber % 2 === 1) {
    return {
      nextMatchId: `${baseId}-lb-r${lowerRoundNumber + 1}-m${lowerMatchIndex + 1}`,
      nextSlot: "playerA"
    };
  }

  return {
    nextMatchId: `${baseId}-lb-r${lowerRoundNumber + 1}-m${Math.floor(lowerMatchIndex / 2) + 1}`,
    nextSlot: lowerMatchIndex % 2 === 0 ? "playerA" : "playerB"
  };
}

function buildDoubleEliminationLowerBracket(baseId, targetSlots, totalWinnerRounds) {
  const totalLowerRounds = getDoubleEliminationLowerRoundCount(totalWinnerRounds);

  return Array.from({ length: totalLowerRounds }, (_, roundIndex) => {
    const roundNumber = roundIndex + 1;
    const matchesInRound = getDoubleEliminationLowerMatchCount(targetSlots, roundNumber);
    const roundName = getDoubleEliminationLowerRoundName(roundNumber, totalLowerRounds);

    return {
      id: `${baseId}-lb-round-${roundNumber}`,
      name: roundName,
      matches: Array.from({ length: matchesInRound }, (_, matchIndex) => {
        const target = getDoubleEliminationLowerWinnerTarget(baseId, roundNumber, matchIndex, totalLowerRounds);

        return {
          id: `${baseId}-lb-r${roundNumber}-m${matchIndex + 1}`,
          bracket: "losers",
          round: roundNumber,
          order: matchIndex + 1,
          playerA: null,
          playerB: null,
          status: "waiting-results",
          scoreA: null,
          scoreB: null,
          winnerId: null,
          nextMatchId: target.nextMatchId,
          nextSlot: target.nextSlot,
          resultWorkflow: createMatchWorkflow()
        };
      })
    };
  });
}

function generateDoubleEliminationStructure(tournament, participants) {
  const orderedParticipants = tournament.settings.seedMode === "random"
    ? shuffleArray(participants)
    : [...participants];

  const targetSlots = getNextPowerOfTwo(orderedParticipants.length);
  const slots = orderedParticipants.map(playerToMatchPlayer);

  while (slots.length < targetSlots) {
    slots.push(null);
  }

  const baseId = tournament.slug || tournament.id;
  const totalWinnerRounds = Math.log2(targetSlots);
  const totalLowerRounds = getDoubleEliminationLowerRoundCount(totalWinnerRounds);
  const winnersBracket = [];
  const losersBracket = buildDoubleEliminationLowerBracket(baseId, targetSlots, totalWinnerRounds);

  for (let roundNumber = 1; roundNumber <= totalWinnerRounds; roundNumber += 1) {
    const matchesInRound = targetSlots / Math.pow(2, roundNumber);

    const round = {
      id: `${baseId}-wb-round-${roundNumber}`,
      name: roundNumber === totalWinnerRounds
        ? "Winners Final"
        : `Winners Bracket - Rodada ${roundNumber}`,
      matches: []
    };

    for (let matchIndex = 0; matchIndex < matchesInRound; matchIndex += 1) {
      let playerA = null;
      let playerB = null;
      let status = "waiting-results";
      let winnerId = null;

      if (roundNumber === 1) {
        playerA = slots[matchIndex];
        playerB = slots[targetSlots - 1 - matchIndex];

        status = playerA && playerB ? "pending" : "bye";

        if (playerA && !playerB) {
          winnerId = getMatchPlayerKey(playerA);
        }

        if (!playerA && playerB) {
          winnerId = getMatchPlayerKey(playerB);
        }
      }

      const winnerTarget = roundNumber < totalWinnerRounds
        ? {
            nextMatchId: `${baseId}-wb-r${roundNumber + 1}-m${Math.floor(matchIndex / 2) + 1}`,
            nextSlot: matchIndex % 2 === 0 ? "playerA" : "playerB"
          }
        : {
            nextMatchId: `${baseId}-gf-m1`,
            nextSlot: "playerA"
          };

      const loserTarget = totalLowerRounds > 0
        ? getDoubleEliminationLowerDrop(baseId, roundNumber, matchIndex)
        : {
            loserNextMatchId: null,
            loserNextSlot: null
          };

      round.matches.push({
        id: `${baseId}-wb-r${roundNumber}-m${matchIndex + 1}`,
        bracket: "winners",
        round: roundNumber,
        order: matchIndex + 1,
        playerA,
        playerB,
        status,
        scoreA: null,
        scoreB: null,
        winnerId,
        nextMatchId: winnerTarget.nextMatchId,
        nextSlot: winnerTarget.nextSlot,
        loserNextMatchId: loserTarget.loserNextMatchId,
        loserNextSlot: loserTarget.loserNextSlot,
        resultWorkflow: createMatchWorkflow()
      });
    }

    winnersBracket.push(round);
  }

  const grandFinalRounds = [
    {
      id: `${baseId}-grand-final-round`,
      name: "Grand Final",
      matches: [
        {
          id: `${baseId}-gf-m1`,
          bracket: "grand-final",
          round: 1,
          order: 1,
          playerA: null,
          playerB: null,
          status: "waiting-results",
          scoreA: null,
          scoreB: null,
          winnerId: null,
          resetMatchId: Boolean(tournament.settings.grandFinalReset) ? `${baseId}-gf-reset-m1` : null,
          resultWorkflow: createMatchWorkflow()
        }
      ]
    }
  ];

  if (Boolean(tournament.settings.grandFinalReset)) {
    grandFinalRounds.push({
      id: `${baseId}-grand-final-reset-round`,
      name: "Reset se necessário",
      matches: [
        {
          id: `${baseId}-gf-reset-m1`,
          bracket: "grand-final-reset",
          round: 2,
          order: 1,
          playerA: null,
          playerB: null,
          status: "waiting-results",
          scoreA: null,
          scoreB: null,
          winnerId: null,
          resultWorkflow: createMatchWorkflow()
        }
      ]
    });
  }

  const structure = {
    type: "double-elimination",
    label: "Double Elimination",
    generatedAt: new Date().toISOString(),
    playersUsed: participants.length,

    settings: {
      targetSlots,
      seedMode: tournament.settings.seedMode || "manual",
      grandFinalReset: Boolean(tournament.settings.grandFinalReset),
      lowerRounds: totalLowerRounds,
      progressionMode: "winners-lower-grand-final"
    },

    winnersBracket,
    losersBracket,

    grandFinal: {
      status: "waiting-results",
      resetIfNeeded: Boolean(tournament.settings.grandFinalReset),
      rounds: grandFinalRounds
    }
  };

  applyDoubleEliminationPhaseFormats(tournament, structure);
  applyAutomaticDoubleEliminationByes({ structure });

  return structure;
}

function flattenStructureMatches(structure) {
  if (!structure) return [];

  if (structure.type === "league") {
    return (structure.rounds || []).flatMap((round) => round.matches || []);
  }

  if (structure.type === "groups-playoffs") {
    const groupMatches = (structure.groups || []).flatMap((group) => {
      return (group.rounds || []).flatMap((round) => {
        return (round.matches || []).map((match) => ({
          ...match,
          groupId: group.id,
          groupName: group.name
        }));
      });
    });

    const playoffs = structure.playoffs || null;
    const playoffMatches = [];

    if (playoffs) {
      if (Array.isArray(playoffs.rounds)) {
        playoffMatches.push(...playoffs.rounds.flatMap((round) => round.matches || []));
      }

      if (Array.isArray(playoffs.sides)) {
        playoffs.sides.forEach((side) => {
          playoffMatches.push(...(side.rounds || []).flatMap((round) => round.matches || []));
        });
      }

      if (playoffs.final) {
        playoffMatches.push(playoffs.final);
      }

      if (playoffs.thirdPlace) {
        playoffMatches.push(playoffs.thirdPlace);
      }
    }

    return [
      ...groupMatches,
      ...playoffMatches
    ];
  }


  if (structure.type === "triple-bracket") {
    const groupStageMatches = (structure.groupStage?.rounds || structure.rounds || [])
      .flatMap((round) => {
        return (round.matches || []).map((match) => ({
          ...match,
          stage: match.stage || "group_stage",
          phaseKey: match.phaseKey || "triple_group_stage",
          phaseLabel: match.phaseLabel || "Fase todos contra todos",
          roundName: match.roundName || round.name || "Rodada"
        }));
      });

    const highMatches = (structure.highBracket?.rounds || [])
      .flatMap((round) => round.matches || []);
    const middleMatches = (structure.middleBracket?.rounds || [])
      .flatMap((round) => round.matches || []);
    const lowMatches = (structure.lowBracket?.rounds || [])
      .flatMap((round) => round.matches || []);
    const finalMatches = [
      ...(structure.intermediaryFinal?.rounds || []).flatMap((round) => round.matches || []),
      ...(structure.grandFinal?.rounds || []).flatMap((round) => round.matches || [])
    ];

    return [
      ...groupStageMatches,
      ...highMatches,
      ...middleMatches,
      ...lowMatches,
      ...finalMatches
    ];
  }

  if (structure.type === "double-elimination") {
    const winnersMatches = (structure.winnersBracket || [])
      .flatMap((round) => round.matches || []);

    const losersMatches = (structure.losersBracket || [])
      .flatMap((round) => round.matches || []);

    const grandFinalMatches = (structure.grandFinal?.rounds || [])
      .flatMap((round) => round.matches || []);

    return [
      ...winnersMatches,
      ...losersMatches,
      ...grandFinalMatches
    ];
  }

  return [];
}

    function makeDraftKey(matchId) {
      return `${selectedTournamentId || "sem-torneio"}:${matchId}`;
    }

    function getResultDraft(matchId) {
      return resultDrafts[makeDraftKey(matchId)] || {};
    }

    function saveResultDraft(matchId, draft) {
      const key = makeDraftKey(matchId);
      const isEmpty =
        !draft.selected &&
        String(draft.scoreA || "").trim() === "" &&
        String(draft.scoreB || "").trim() === "";

      if (isEmpty) {
        delete resultDrafts[key];
        return;
      }

      resultDrafts[key] = draft;
    }

    function clearResultDraft(matchId) {
      delete resultDrafts[makeDraftKey(matchId)];
    }

    function clearDraftsForTournament(tournamentId) {
      const prefix = `${tournamentId}:`;

      Object.keys(resultDrafts).forEach((key) => {
        if (key.startsWith(prefix)) {
          delete resultDrafts[key];
        }
      });
    }

    function updateDraftFromCard(matchCard) {
      if (!matchCard) return;

      const matchId = matchCard.dataset.matchCard;
      const checkbox = matchCard.querySelector("[data-select-result]");
      const scoreAInput = matchCard.querySelector("[data-score-a]");
      const scoreBInput = matchCard.querySelector("[data-score-b]");

      if (!matchId || !scoreAInput || !scoreBInput) return;

      saveResultDraft(matchId, {
        selected: checkbox ? checkbox.checked : false,
        scoreA: scoreAInput.value,
        scoreB: scoreBInput.value
      });
    }

    function getInputValueForMatch(match, field) {
      const draft = getResultDraft(match.id);

      if (Object.prototype.hasOwnProperty.call(draft, field)) {
        return draft[field];
      }

      if (match[field] !== null && match[field] !== undefined) {
        return match[field];
      }

      return "";
    }

    function isMatchDraftSelected(matchId) {
      return getResultDraft(matchId).selected === true;
    }

    async function generateTournamentStructure() {
      let tournament = getTournamentById(selectedTournamentId);

      if (!tournament) {
        alert("Nenhum torneio selecionado.");
        return;
      }

      const isRealTournament = isSupabaseTournament(tournament);

      if (isRealTournament) {
        generateStructureButton.disabled = true;
        generateStructureButton.textContent = "Carregando inscritos...";

        try {
          tournament = await loadSupabaseParticipantsIntoTournament(tournament);
        } catch (error) {
          console.warn("[SBW Torneios] Não foi possível atualizar inscritos antes de gerar estrutura:", error);
        } finally {
          generateStructureButton.disabled = false;
          generateStructureButton.textContent = "Gerar estrutura do torneio";
        }
      }

      const participants = getEligibleParticipants(tournament);
      const totalParticipants = Array.isArray(tournament.participants) ? tournament.participants.length : 0;
      const checkinMode = getTournamentCheckinMode(tournament);

      if (!isTripleBracketTournament(tournament) && participants.length < 2) {
        alert(
          checkinMode === "required"
            ? `É necessário ter pelo menos 2 participantes inscritos e com check-in confirmado. Agora: ${participants.length}/${totalParticipants}.`
            : `É necessário ter pelo menos 2 participantes inscritos válidos. Agora: ${participants.length}/${totalParticipants}.`
        );
        return;
      }

      if (tournament.structure) {
        const confirmReplace = confirm("Este torneio já tem uma estrutura gerada. Gerar novamente vai substituir a estrutura atual. Continuar?");
        if (!confirmReplace) return;
      }

      let confirmRealStructure = true;

      if (isRealTournament && isTripleBracketTournament(tournament)) {
        const missingSlots = Math.max(8 - participants.length, 0);
        const confirmationMessage = missingSlots > 0
          ? `Gerar estrutura modelo do Sistema de 3 Chaves com ${participants.length} inscrito(s) real(is) e ${missingSlots} vaga(s) em aberto? Depois que as 8 equipes reais estiverem definidas, regenere/atualize a estrutura antes de lançar resultados oficiais.`
          : "Gerar estrutura oficial do Sistema de 3 Chaves com 8 equipes reais? Depois disso, a estrutura será salva no Supabase.";
        confirmRealStructure = confirm(confirmationMessage);
      } else if (isRealTournament) {
        confirmRealStructure = confirm(`Gerar estrutura usando ${participants.length} inscritos reais válidos? Depois disso, a estrutura será salva no Supabase.`);
      }

      if (!confirmRealStructure) {
        return;
      }

      let structure = null;


      if (isTripleBracketTournament(tournament)) {
        structure = generateTripleBracketGroupStageStructure(tournament, participants);
        if (!structure) return;
      }

      if (tournament.format === "league") {
        structure = generateLeagueStructure(tournament, participants);
      }

      if (tournament.format === "groups-playoffs") {
        structure = generateGroupsStructure(tournament, participants);
        if (!structure) return;
      }

      if (tournament.format === "double-elimination") {
        structure = generateDoubleEliminationStructure(tournament, participants);
      }

      if (!structure) {
        alert("Formato de torneio não reconhecido.");
        return;
      }

      clearDraftsForTournament(selectedTournamentId);

      tournament.structure = {
        ...structure,
        source: isRealTournament ? "supabase-real-registrations" : "local-participants",
        checkinMode,
        eligibleParticipantsCount: participants.length,
        totalParticipantsSnapshot: totalParticipants
      };
      tournament.matches = flattenStructureMatches(tournament.structure);


      if (tournament.structure.type === "triple-bracket") {
        tournament.standings = tournament.structure.groupStage?.standings || tournament.structure.standings || [];
      }

      if (tournament.structure.type === "league") {
        tournament.standings = tournament.structure.standings;
      }

      if (tournament.structure.type === "groups-playoffs") {
        tournament.standings = tournament.structure.groups.map((group) => ({
          groupId: group.id,
          groupName: group.name,
          standings: group.standings
        }));
      }

      tournament.status = ["draft", "registration-open", "open", "published", "scheduled"].includes(tournament.status)
        ? "structure-generated"
        : tournament.status;
      tournament.updatedAt = new Date().toISOString();

      if (isRealTournament) {
        generateStructureButton.disabled = true;
        generateStructureButton.textContent = "Salvando estrutura...";

        const result = typeof sbwSaveSupabaseTournamentStructureAsync === "function"
          ? await sbwSaveSupabaseTournamentStructureAsync(tournament)
          : {
              success: false,
              message: "Função de salvamento da estrutura no Supabase não encontrada."
            };

        generateStructureButton.disabled = false;
        generateStructureButton.textContent = "Gerar estrutura do torneio";

        if (!result.success) {
          previewOutput.textContent = JSON.stringify(result, null, 2);
          alert(result.message || "Não foi possível salvar a estrutura do torneio real.");
          return;
        }

        tournament = {
          ...tournament,
          ...(result.tournament || {}),
          participants: tournament.participants,
          structure: tournament.structure,
          matches: tournament.matches,
          standings: tournament.standings,
          source: "supabase"
        };
      }

      updateTournament(tournament);
      renderTournamentManager();
      await renderSavedTournaments();
      renderStructurePreview(tournament);

      previewOutput.textContent = JSON.stringify(tournament, null, 2);
    }


function findEditableMatch(tournament, matchId) {
  if (!tournament || !tournament.structure) return null;

  const structure = tournament.structure;

  function findInRounds(rounds) {
    if (!Array.isArray(rounds)) {
      return null;
    }

    for (const round of rounds) {
      const matches = Array.isArray(round.matches)
        ? round.matches
        : [];

      const match = matches.find((item) => item.id === matchId);

      if (match) {
        return match;
      }
    }

    return null;
  }

  if (structure.type === "league") {
    return findInRounds(structure.rounds);
  }

  if (structure.type === "groups-playoffs") {
    for (const group of structure.groups || []) {
      const match = findInRounds(group.rounds);

      if (match) {
        return match;
      }
    }

    return null;
  }


  if (structure.type === "triple-bracket") {
    return findInRounds(structure.groupStage?.rounds || structure.rounds) ||
      findInRounds(structure.highBracket?.rounds) ||
      findInRounds(structure.middleBracket?.rounds) ||
      findInRounds(structure.lowBracket?.rounds) ||
      findInRounds(structure.intermediaryFinal?.rounds) ||
      findInRounds(structure.grandFinal?.rounds) ||
      null;
  }

  if (structure.type === "double-elimination") {
    return findInRounds(structure.winnersBracket) ||
      findInRounds(structure.losersBracket) ||
      findInRounds(structure.grandFinal?.rounds) ||
      null;
  }

  return null;
}

    function resetStandingRows(standings) {
      return standings.map((row) => ({
        participantId: row.participantId,
        nickname: row.nickname,
        team: row.team || "",
        played: 0,
        wins: 0,
        losses: 0,
        setsWon: 0,
        setsLost: 0,
        setBalance: 0,
        points: 0,
        winRate: 0
      }));
    }

    function calculateStandingsFromRounds(standings, rounds, pointsWin, pointsLoss) {
      const rows = resetStandingRows(standings);
      const standingsMap = {};

      rows.forEach((row) => {
        standingsMap[row.participantId] = row;
      });

      rounds.forEach((round) => {
        round.matches.forEach((match) => {
          if (match.status !== "completed") return;
          if (!match.playerA || !match.playerB) return;

          const rowA = standingsMap[match.playerA.id];
          const rowB = standingsMap[match.playerB.id];

          if (!rowA || !rowB) return;

          const scoreA = Number(match.scoreA);
          const scoreB = Number(match.scoreB);

          rowA.played += 1;
          rowB.played += 1;

          rowA.setsWon += scoreA;
          rowA.setsLost += scoreB;
          rowB.setsWon += scoreB;
          rowB.setsLost += scoreA;

          rowA.setBalance = rowA.setsWon - rowA.setsLost;
          rowB.setBalance = rowB.setsWon - rowB.setsLost;

          if (scoreA > scoreB) {
            rowA.wins += 1;
            rowB.losses += 1;
            rowA.points += pointsWin;
            rowB.points += pointsLoss;
          } else {
            rowB.wins += 1;
            rowA.losses += 1;
            rowB.points += pointsWin;
            rowA.points += pointsLoss;
          }

          rowA.winRate = rowA.played > 0 ? Math.round((rowA.wins / rowA.played) * 100) : 0;
          rowB.winRate = rowB.played > 0 ? Math.round((rowB.wins / rowB.played) * 100) : 0;
        });
      });

      return rows.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.setBalance !== a.setBalance) return b.setBalance - a.setBalance;
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon;
        return a.nickname.localeCompare(b.nickname);
      });
    }

    function updateStandingsByFormat(tournament) {
      const structure = tournament.structure;
      if (!structure) return;

      if (structure.type === "league") {
        const pointsWin = structure.rules.pointsWin || 3;
        const pointsLoss = structure.rules.pointsLoss || 0;

        structure.standings = calculateStandingsFromRounds(
          structure.standings,
          structure.rounds,
          pointsWin,
          pointsLoss
        );

        tournament.standings = structure.standings;
      }


      if (structure.type === "triple-bracket") {
        const groupStage = structure.groupStage || {};
        const pointsWin = groupStage.rules?.pointsWin || 3;
        const pointsLoss = groupStage.rules?.pointsLoss || 0;
        const rounds = groupStage.rounds || structure.rounds || [];
        const currentStandings = groupStage.standings || structure.standings || [];
        const updatedStandings = calculateStandingsFromRounds(
          currentStandings,
          rounds,
          pointsWin,
          pointsLoss
        ).map((row, index) => ({
          ...row,
          qualificationTarget: index < 4 ? "Chave Alta" : "Chave Média"
        }));

        structure.groupStage = {
          ...groupStage,
          standings: updatedStandings,
          rounds,
          matches: rounds.flatMap((round) => round.matches || []),
          status: updatedStandings.every((row) => Number(row.played || 0) >= 7) ? "completed" : "in_progress"
        };
        structure.standings = updatedStandings;
        structure.rounds = rounds;
        structure.matches = structure.groupStage.matches;
        tournament.standings = updatedStandings;
      }

      if (structure.type === "groups-playoffs") {
        structure.groups.forEach((group) => {
          group.standings = calculateStandingsFromRounds(
            group.standings,
            group.rounds,
            3,
            0
          );
        });

        tournament.standings = structure.groups.map((group) => ({
          groupId: group.id,
          groupName: group.name,
          standings: group.standings
        }));
      }

      tournament.matches = flattenStructureMatches(structure);
    }

        function getRequiredWinsForMatchFormat(matchFormat) {
      const formats = {
        MD1: 1,
        MD3: 2,
        MD5: 3,
        MD7: 4
      };

      return formats[matchFormat] || null;
    }

    function validateScoreByMatchFormat(scoreA, scoreB, tournament, match = null) {
      const matchFormat = getEffectiveMatchFormat(tournament, match);
      const requiredWins = getRequiredWinsForMatchFormat(matchFormat);

      if (!requiredWins) {
        return {
          valid: true
        };
      }

      const winnerScore = Math.max(scoreA, scoreB);
      const loserScore = Math.min(scoreA, scoreB);

      if (winnerScore !== requiredWins) {
        return {
          valid: false,
          message: `Formato ${matchFormat}: o vencedor precisa fechar com ${requiredWins} vitória(s).`
        };
      }

      if (loserScore >= requiredWins) {
        return {
          valid: false,
          message: `Formato ${matchFormat}: o perdedor não pode ter ${requiredWins} ou mais vitória(s).`
        };
      }

      return {
        valid: true
      };
    }

        function parseScoreInputs(scoreAInput, scoreBInput, match, tournament) {
      const rawA = String(scoreAInput.value).trim();
      const rawB = String(scoreBInput.value).trim();

      if (rawA === "" || rawB === "") {
        return {
          valid: false,
          message: `Preencha os dois placares da partida ${getRawPlayerName(match.playerA)} vs ${getRawPlayerName(match.playerB)}.`
        };
      }

      const scoreA = Number(rawA);
      const scoreB = Number(rawB);

      if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0) {
        return {
          valid: false,
          message: "Digite placares válidos. Use números inteiros iguais ou maiores que zero."
        };
      }

      if (scoreA === scoreB) {
        return {
          valid: false,
          message: "Empate ainda não é permitido. Informe um vencedor."
        };
      }

      const formatValidation = validateScoreByMatchFormat(scoreA, scoreB, tournament, match);

      if (!formatValidation.valid) {
        return formatValidation;
      }

      return {
        valid: true,
        scoreA,
        scoreB
      };
    }

function getMatchPlayerKey(player) {
  if (!player) {
    return "";
  }

  return String(player.id || player.participantId || player.nickname || player.name || "");
}

function getWinnerPlayerFromMatch(match) {
  if (!match || !match.playerA || !match.playerB) {
    return null;
  }

  if (match.winnerId) {
    const playerAKey = getMatchPlayerKey(match.playerA);
    const playerBKey = getMatchPlayerKey(match.playerB);
    const winnerKey = String(match.winnerId);

    if (winnerKey === playerAKey) {
      return match.playerA;
    }

    if (winnerKey === playerBKey) {
      return match.playerB;
    }
  }

  const scoreA = Number(match.scoreA);
  const scoreB = Number(match.scoreB);

  if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB) || scoreA === scoreB) {
    return null;
  }

  return scoreA > scoreB ? match.playerA : match.playerB;
}

function getLoserPlayerFromMatch(match) {
  if (!match || !match.playerA || !match.playerB) {
    return null;
  }

  const winner = getWinnerPlayerFromMatch(match);
  const winnerKey = getMatchPlayerKey(winner);

  if (!winnerKey) {
    return null;
  }

  if (winnerKey === getMatchPlayerKey(match.playerA)) {
    return match.playerB;
  }

  if (winnerKey === getMatchPlayerKey(match.playerB)) {
    return match.playerA;
  }

  return null;
}

function findMatchInRounds(rounds, matchId) {
  if (!Array.isArray(rounds)) {
    return null;
  }

  for (const round of rounds) {
    const matches = Array.isArray(round.matches)
      ? round.matches
      : [];

    const match = matches.find((item) => item.id === matchId);

    if (match) {
      return match;
    }
  }

  return null;
}

function findDoubleEliminationMatch(structure, matchId) {
  if (!structure) {
    return null;
  }

  return findMatchInRounds(structure.winnersBracket, matchId) ||
    findMatchInRounds(structure.losersBracket, matchId) ||
    findMatchInRounds(structure.grandFinal?.rounds, matchId) ||
    null;
}

function getWaitingStatusForMatch(match) {
  if (!match) {
    return "waiting-results";
  }

  if (match.playerA && match.playerB) {
    return "pending";
  }

  if (match.playerA || match.playerB) {
    return match.round === 1 && match.bracket === "winners"
      ? "bye"
      : "waiting-results";
  }

  return "waiting-results";
}

function resetMatchResultOnly(match) {
  if (!match) {
    return;
  }

  match.scoreA = null;
  match.scoreB = null;
  match.winnerId = null;
  match.status = getWaitingStatusForMatch(match);
  match.updatedAt = new Date().toISOString();

  if (match.resultWorkflow) {
    match.resultWorkflow.resultStatus = "none";
    match.resultWorkflow.report = {
      scoreA: null,
      scoreB: null,
      winnerId: null,
      createdAt: null,
      updatedAt: null
    };
  }
}

function isGrandFinalMainMatch(match) {
  if (!match) {
    return false;
  }

  const id = String(match.id || "").toLowerCase();
  const bracket = String(match.bracket || "").toLowerCase();

  return bracket === "grand-final" || (id.includes("gf-m1") && !id.includes("reset"));
}

function getGrandFinalResetMatch(tournament) {
  const rounds = Array.isArray(tournament?.structure?.grandFinal?.rounds)
    ? tournament.structure.grandFinal.rounds
    : [];

  for (const round of rounds) {
    const matches = Array.isArray(round.matches) ? round.matches : [];
    const resetMatch = matches.find((match) => {
      const id = String(match.id || "").toLowerCase();
      const bracket = String(match.bracket || "").toLowerCase();
      return bracket.includes("reset") || id.includes("reset");
    });

    if (resetMatch) {
      return resetMatch;
    }
  }

  return null;
}

function resetGrandFinalResetMatch(tournament) {
  const resetMatch = getGrandFinalResetMatch(tournament);

  if (!resetMatch) {
    return;
  }

  resetMatch.playerA = null;
  resetMatch.playerB = null;
  resetMatch.status = "waiting-results";
  resetMatch.updatedAt = new Date().toISOString();
  resetMatchResultOnly(resetMatch);
}

function syncGrandFinalResetAfterMain(tournament, match) {
  if (!tournament || tournament.structure?.type !== "double-elimination" || !isGrandFinalMainMatch(match)) {
    return;
  }

  if (!tournament.structure?.grandFinal?.resetIfNeeded) {
    return;
  }

  const resetMatch = getGrandFinalResetMatch(tournament);

  if (!resetMatch || !match.playerA || !match.playerB || match.status !== "completed") {
    resetGrandFinalResetMatch(tournament);
    return;
  }

  const winnerKey = String(match.winnerId || "");
  const lowerWinnerKey = getMatchPlayerKey(match.playerB);
  const lowerSideForcedReset = Boolean(winnerKey && lowerWinnerKey && winnerKey === lowerWinnerKey);

  if (!lowerSideForcedReset) {
    resetGrandFinalResetMatch(tournament);
    return;
  }

  const previousA = getMatchPlayerKey(resetMatch.playerA);
  const previousB = getMatchPlayerKey(resetMatch.playerB);
  const nextA = getMatchPlayerKey(match.playerA);
  const nextB = getMatchPlayerKey(match.playerB);

  if ((previousA && previousA !== nextA) || (previousB && previousB !== nextB)) {
    resetMatchResultOnly(resetMatch);
  }

  resetMatch.playerA = { ...match.playerA };
  resetMatch.playerB = { ...match.playerB };
  resetMatch.status = resetMatch.status === "completed" ? "completed" : "pending";
  resetMatch.updatedAt = new Date().toISOString();
}

function clearDoubleEliminationProgression(tournament, match, visited = new Set()) {
  if (!tournament || tournament.structure?.type !== "double-elimination" || !match) {
    return;
  }

  const visitKey = String(match.id || "");

  if (visitKey && visited.has(visitKey)) {
    return;
  }

  if (visitKey) {
    visited.add(visitKey);
  }

  const targets = [
    {
      matchId: match.nextMatchId,
      slot: match.nextSlot
    },
    {
      matchId: match.loserNextMatchId,
      slot: match.loserNextSlot
    }
  ];

  targets.forEach((target) => {
    if (!target.matchId || !target.slot) {
      return;
    }

    const nextMatch = findDoubleEliminationMatch(tournament.structure, target.matchId);

    if (!nextMatch) {
      return;
    }

    clearDoubleEliminationProgression(tournament, nextMatch, visited);
    nextMatch[target.slot] = null;
    resetMatchResultOnly(nextMatch);

    if (isGrandFinalMainMatch(nextMatch)) {
      resetGrandFinalResetMatch(tournament);
    }
  });
}

function placeDoubleEliminationPlayer(tournament, matchId, slot, player) {
  if (!tournament || tournament.structure?.type !== "double-elimination" || !matchId || !slot || !player) {
    return false;
  }

  const nextMatch = findDoubleEliminationMatch(tournament.structure, matchId);

  if (!nextMatch) {
    return false;
  }

  const currentSlotPlayer = nextMatch[slot];
  const currentSlotKey = getMatchPlayerKey(currentSlotPlayer);
  const playerKey = getMatchPlayerKey(player);

  if (currentSlotPlayer && currentSlotKey !== playerKey) {
    clearDoubleEliminationProgression(tournament, nextMatch);
    resetMatchResultOnly(nextMatch);
  }

  nextMatch[slot] = {
    ...player
  };

  if (nextMatch.status !== "completed") {
    nextMatch.status = nextMatch.playerA && nextMatch.playerB
      ? "pending"
      : "waiting-results";
  }

  nextMatch.updatedAt = new Date().toISOString();
  return true;
}

function advanceDoubleEliminationWinner(tournament, match) {
  if (!tournament || tournament.structure?.type !== "double-elimination") {
    return;
  }

  if (!match?.nextMatchId || !match?.nextSlot) {
    return;
  }

  const winner = getWinnerPlayerFromMatch(match);

  if (!winner) {
    return;
  }

  placeDoubleEliminationPlayer(tournament, match.nextMatchId, match.nextSlot, winner);
}

function advanceDoubleEliminationLoser(tournament, match) {
  if (!tournament || tournament.structure?.type !== "double-elimination") {
    return;
  }

  if (!match?.loserNextMatchId || !match?.loserNextSlot) {
    return;
  }

  const loser = getLoserPlayerFromMatch(match);

  if (!loser) {
    return;
  }

  placeDoubleEliminationPlayer(tournament, match.loserNextMatchId, match.loserNextSlot, loser);
}

function applyAutomaticDoubleEliminationByes(tournament) {
  if (!tournament || tournament.structure?.type !== "double-elimination") {
    return;
  }

  const rounds = Array.isArray(tournament.structure.winnersBracket)
    ? tournament.structure.winnersBracket
    : [];

  rounds.forEach((round) => {
    (round.matches || []).forEach((match) => {
      if (match.status === "bye" && match.winnerId) {
        advanceDoubleEliminationWinner(tournament, match);
      }
    });
  });
}

function applyMatchResult(match, scoreA, scoreB, tournament = null) {
  match.scoreA = scoreA;
  match.scoreB = scoreB;
  match.winnerId = scoreA > scoreB
    ? getMatchPlayerKey(match.playerA)
    : getMatchPlayerKey(match.playerB);
  match.status = "completed";
  match.updatedAt = new Date().toISOString();

  if (match.resultWorkflow) {
    match.resultWorkflow.resultStatus = "confirmed";
    match.resultWorkflow.report = {
      scoreA,
      scoreB,
      winnerId: match.winnerId,
      createdAt: match.resultWorkflow.report?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  advanceDoubleEliminationWinner(tournament, match);
  advanceDoubleEliminationLoser(tournament, match);
  syncGrandFinalResetAfterMain(tournament, match);
}

function clearMatchObject(match, tournament = null) {
  clearDoubleEliminationProgression(tournament, match);
  resetMatchResultOnly(match);

  if (isGrandFinalMainMatch(match)) {
    resetGrandFinalResetMatch(tournament);
  }
}

function isCompletedPlayableMatch(match) {
  return Boolean(match && match.playerA && match.playerB && match.status === "completed" && match.winnerId);
}

function getPlayableMatchesFromRounds(rounds) {
  if (!Array.isArray(rounds)) {
    return [];
  }

  return rounds.flatMap((round) => {
    const matches = Array.isArray(round.matches) ? round.matches : [];
    return matches.filter((match) => match && match.playerA && match.playerB);
  });
}

function countCompletedPlayableMatches(matches) {
  const playable = Array.isArray(matches)
    ? matches.filter((match) => match && match.playerA && match.playerB)
    : [];

  return {
    total: playable.length,
    completed: playable.filter(isCompletedPlayableMatch).length
  };
}

function normalizeFinalPlayer(player, placement, placementLabel, extra = {}) {
  if (!player) {
    return null;
  }

  const id = getMatchPlayerKey(player);

  return {
    placement,
    placementLabel,
    id,
    playerId: id,
    participantId: player.participantId || player.participant_id || id,
    profileId: player.profileId || player.profile_id || "",
    profileSlug: player.profileSlug || player.profile_slug || player.playerSlug || player.player_slug || "",
    playerSlug: player.playerSlug || player.player_slug || player.profileSlug || player.profile_slug || "",
    authUserId: player.authUserId || player.auth_user_id || "",
    nickname: player.nickname || player.name || player.playerName || "Jogador",
    name: player.nickname || player.name || player.playerName || "Jogador",
    team: player.team || player.teamName || "",
    seed: player.seed || null,
    seedLabel: player.seedLabel || "",
    ...extra
  };
}

function getExistingFinalResults(tournament) {
  return tournament?.settings?.finalResults || tournament?.metadata?.finalResults || tournament?.finalResults || null;
}

function getPlayerFinalKey(player) {
  if (!player) {
    return "";
  }

  return String(player.playerId || player.participantId || player.id || player.profileId || player.playerSlug || player.authUserId || player.nickname || player.name || "");
}

function appendUniqueFinalPlacement(placements, player, placementLabel, extra = {}) {
  const normalized = normalizeFinalPlayer(player, placements.length + 1, placementLabel, extra);

  if (!normalized) {
    return;
  }

  const key = getPlayerFinalKey(normalized);
  const alreadyAdded = placements.some((item) => getPlayerFinalKey(item) === key);

  if (!alreadyAdded) {
    placements.push(normalized);
  }
}

function buildLeagueFinalPlacements(structure) {
  const standings = Array.isArray(structure?.standings) ? structure.standings : [];

  return standings.map((row, index) => ({
    placement: index + 1,
    placementLabel: index === 0 ? "Campeão" : `${index + 1}º lugar`,
    id: row.participantId,
    playerId: row.participantId,
    participantId: row.participantId,
    profileId: row.profileId || row.profile_id || "",
    profileSlug: row.profileSlug || row.profile_slug || row.playerSlug || row.player_slug || "",
    playerSlug: row.playerSlug || row.player_slug || row.profileSlug || row.profile_slug || "",
    authUserId: row.authUserId || row.auth_user_id || "",
    nickname: row.nickname || row.name || "Jogador",
    name: row.nickname || row.name || "Jogador",
    team: row.team || "",
    played: row.played || 0,
    wins: row.wins || 0,
    losses: row.losses || 0,
    setsWon: row.setsWon || 0,
    setsLost: row.setsLost || 0,
    setBalance: row.setBalance || 0,
    points: row.points || 0,
    winRate: row.winRate || 0
  }));
}

function getPlayoffFinalMatch(playoffs) {
  if (!playoffs) {
    return null;
  }

  if (playoffs.final) {
    return playoffs.final;
  }

  if (Array.isArray(playoffs.rounds) && playoffs.rounds.length > 0) {
    const lastRound = playoffs.rounds[playoffs.rounds.length - 1];
    const matches = Array.isArray(lastRound.matches) ? lastRound.matches : [];
    return matches[matches.length - 1] || null;
  }

  return null;
}

function getDoubleEliminationFinalMatch(structure) {
  const grandFinalRounds = Array.isArray(structure?.grandFinal?.rounds)
    ? structure.grandFinal.rounds
    : [];

  const grandFinalMatches = grandFinalRounds.flatMap((round) => Array.isArray(round.matches) ? round.matches : []);
  const completedGrandFinals = grandFinalMatches.filter(isCompletedPlayableMatch);

  if (completedGrandFinals.length > 0) {
    return completedGrandFinals[completedGrandFinals.length - 1];
  }

  const winnersRounds = Array.isArray(structure?.winnersBracket) ? structure.winnersBracket : [];
  const lastWinnersRound = winnersRounds[winnersRounds.length - 1];
  const lastWinnersMatches = lastWinnersRound && Array.isArray(lastWinnersRound.matches)
    ? lastWinnersRound.matches
    : [];

  return lastWinnersMatches[lastWinnersMatches.length - 1] || null;
}

function getGroupStageMatches(structure) {
  if (!structure || !Array.isArray(structure.groups)) {
    return [];
  }

  return structure.groups.flatMap((group) => getPlayableMatchesFromRounds(group.rounds));
}

function buildGroupsFallbackPlacements(structure, existingPlacements) {
  const placements = Array.isArray(existingPlacements) ? [...existingPlacements] : [];
  const added = new Set(placements.map(getPlayerFinalKey));
  const allRows = [];

  (structure.groups || []).forEach((group) => {
    (group.standings || []).forEach((row) => {
      allRows.push({
        ...row,
        groupName: group.name || group.id || "Grupo"
      });
    });
  });

  allRows
    .sort((a, b) => {
      if ((b.points || 0) !== (a.points || 0)) return (b.points || 0) - (a.points || 0);
      if ((b.setBalance || 0) !== (a.setBalance || 0)) return (b.setBalance || 0) - (a.setBalance || 0);
      if ((b.wins || 0) !== (a.wins || 0)) return (b.wins || 0) - (a.wins || 0);
      return String(a.nickname || "").localeCompare(String(b.nickname || ""), "pt-BR");
    })
    .forEach((row) => {
      const key = String(row.participantId || row.id || row.nickname || "");

      if (added.has(key)) {
        return;
      }

      placements.push({
        placement: placements.length + 1,
        placementLabel: `${placements.length + 1}º lugar`,
        id: key,
        playerId: key,
        participantId: key,
        profileId: row.profileId || row.profile_id || "",
        profileSlug: row.profileSlug || row.profile_slug || row.playerSlug || row.player_slug || "",
        playerSlug: row.playerSlug || row.player_slug || row.profileSlug || row.profile_slug || "",
        authUserId: row.authUserId || row.auth_user_id || "",
        nickname: row.nickname || row.name || "Jogador",
        name: row.nickname || row.name || "Jogador",
        team: row.team || "",
        groupName: row.groupName || "",
        points: row.points || 0,
        wins: row.wins || 0,
        losses: row.losses || 0,
        setBalance: row.setBalance || 0
      });

      added.add(key);
    });

  return placements;
}

function buildPlayoffFinalPlacements(structure) {
  const playoffs = structure?.playoffs || null;
  const placements = [];
  const finalMatch = getPlayoffFinalMatch(playoffs);
  const finalWinner = getCompletedMatchWinner(finalMatch);
  const finalLoser = getCompletedMatchLoser(finalMatch);

  appendUniqueFinalPlacement(placements, finalWinner, "Campeão", { source: "playoff-final" });
  appendUniqueFinalPlacement(placements, finalLoser, "Vice-campeão", { source: "playoff-final" });

  if (playoffs?.thirdPlace && isCompletedPlayableMatch(playoffs.thirdPlace)) {
    appendUniqueFinalPlacement(placements, getCompletedMatchWinner(playoffs.thirdPlace), "3º lugar", { source: "third-place" });
    appendUniqueFinalPlacement(placements, getCompletedMatchLoser(playoffs.thirdPlace), "4º lugar", { source: "third-place" });
  }

  return buildGroupsFallbackPlacements(structure, placements).map((item, index) => ({
    ...item,
    placement: index + 1,
    placementLabel: index === 0
      ? "Campeão"
      : (index === 1 ? "Vice-campeão" : `${index + 1}º lugar`)
  }));
}

function buildDoubleEliminationFinalPlacements(structure) {
  const placements = [];
  const finalMatch = getDoubleEliminationFinalMatch(structure);

  appendUniqueFinalPlacement(placements, getCompletedMatchWinner(finalMatch), "Campeão", { source: "double-elimination-final" });
  appendUniqueFinalPlacement(placements, getCompletedMatchLoser(finalMatch), "Vice-campeão", { source: "double-elimination-final" });

  const allPlayers = [];
  const seen = new Set();

  flattenStructureMatches(structure).forEach((match) => {
    [match.playerA, match.playerB].forEach((player) => {
      const key = getMatchPlayerKey(player);
      if (!player || !key || seen.has(key)) return;
      seen.add(key);
      allPlayers.push(player);
    });
  });

  allPlayers.forEach((player) => {
    appendUniqueFinalPlacement(placements, player, `${placements.length + 1}º lugar`, { source: "double-elimination-participant" });
  });

  return placements.map((item, index) => ({
    ...item,
    placement: index + 1,
    placementLabel: index === 0
      ? "Campeão"
      : (index === 1 ? "Vice-campeão" : `${index + 1}º lugar`)
  }));
}

function getTournamentCompletionSummary(tournament) {
  const structure = tournament?.structure || null;
  const existingFinalResults = getExistingFinalResults(tournament);

  if (!structure) {
    return {
      ready: false,
      completed: false,
      reason: "Gere a estrutura do torneio antes de finalizar.",
      totalMatches: 0,
      completedMatches: 0,
      finalResults: existingFinalResults
    };
  }

  if (String(tournament.status || "").toLowerCase() === "completed" && existingFinalResults) {
    return {
      ready: false,
      completed: true,
      reason: "Torneio já finalizado.",
      totalMatches: existingFinalResults?.matchesSummary?.totalPlayableMatches || 0,
      completedMatches: existingFinalResults?.matchesSummary?.completedMatches || 0,
      finalResults: existingFinalResults
    };
  }

  if (structure.type === "league") {
    const playableMatches = getPlayableMatchesFromRounds(structure.rounds);
    const counts = countCompletedPlayableMatches(playableMatches);
    const placements = buildLeagueFinalPlacements(structure);
    const ready = counts.total > 0 && counts.completed === counts.total && placements.length > 0;

    return {
      ready,
      completed: false,
      reason: ready ? "Todas as partidas da liga foram finalizadas." : "Finalize todas as partidas da liga para liberar o fechamento.",
      totalMatches: counts.total,
      completedMatches: counts.completed,
      champion: placements[0] || null,
      finalResults: {
        format: "league",
        champion: placements[0] || null,
        runnerUp: placements[1] || null,
        thirdPlace: placements[2] || null,
        placements,
        standings: placements,
        matchesSummary: {
          totalPlayableMatches: counts.total,
          completedMatches: counts.completed
        }
      }
    };
  }

  if (structure.type === "groups-playoffs") {
    const groupMatches = getGroupStageMatches(structure);
    const groupCounts = countCompletedPlayableMatches(groupMatches);
    const playoffs = structure.playoffs || null;
    const playoffMatches = playoffs?.status === "generated"
      ? getAllPlayoffMatches(playoffs).filter((match) => match && match.playerA && match.playerB)
      : [];
    const allMatches = [...groupMatches, ...playoffMatches];
    const counts = countCompletedPlayableMatches(allMatches);
    const finalMatch = getPlayoffFinalMatch(playoffs);
    const finalCompleted = isCompletedPlayableMatch(finalMatch);

    if (groupCounts.total === 0 || groupCounts.completed !== groupCounts.total) {
      return {
        ready: false,
        completed: false,
        reason: "Finalize todas as partidas da fase de grupos antes de fechar o torneio.",
        totalMatches: counts.total,
        completedMatches: counts.completed,
        finalResults: existingFinalResults
      };
    }

    if (!playoffs || playoffs.status !== "generated") {
      return {
        ready: false,
        completed: false,
        reason: "Gere os playoffs com os classificados antes de fechar o torneio.",
        totalMatches: counts.total,
        completedMatches: counts.completed,
        finalResults: existingFinalResults
      };
    }

    if (!finalCompleted || counts.completed !== counts.total) {
      return {
        ready: false,
        completed: false,
        reason: "Finalize todas as partidas dos playoffs, incluindo final e disputa de terceiro lugar quando existir.",
        totalMatches: counts.total,
        completedMatches: counts.completed,
        finalResults: existingFinalResults
      };
    }

    const placements = buildPlayoffFinalPlacements(structure);

    return {
      ready: placements.length > 0,
      completed: false,
      reason: "Fase de grupos e playoffs finalizados.",
      totalMatches: counts.total,
      completedMatches: counts.completed,
      champion: placements[0] || null,
      finalResults: {
        format: "groups-playoffs",
        champion: placements[0] || null,
        runnerUp: placements[1] || null,
        thirdPlace: placements[2] || null,
        placements,
        matchesSummary: {
          totalPlayableMatches: counts.total,
          completedMatches: counts.completed,
          groupMatches: groupCounts.total,
          playoffMatches: playoffMatches.length
        }
      }
    };
  }


  if (structure.type === "triple-bracket") {
    const rounds = structure.groupStage?.rounds || structure.rounds || [];
    const matches = rounds.flatMap((round) => round.matches || []).filter((match) => match && match.playerA && match.playerB);
    const counts = countCompletedPlayableMatches(matches);
    const groupDone = counts.total > 0 && counts.completed === counts.total;
    const standings = structure.groupStage?.standings || structure.standings || [];

    return {
      ready: false,
      completed: false,
      reason: groupDone
        ? "Fase todos contra todos concluída. A geração das três chaves entra na próxima etapa do modo."
        : "Finalize a fase todos contra todos antes de gerar Chave Alta, Chave Média e Chave Baixa.",
      totalMatches: counts.total,
      completedMatches: counts.completed,
      champion: null,
      finalResults: {
        format: "triple-bracket",
        groupStageCompleted: groupDone,
        highBracketSeeds: standings.slice(0, 4),
        middleBracketSeeds: standings.slice(4, 8),
        matchesSummary: {
          totalPlayableMatches: counts.total,
          completedMatches: counts.completed,
          groupStageMatches: matches.length
        }
      }
    };
  }

  if (structure.type === "double-elimination") {
    const playableMatches = flattenStructureMatches(structure).filter((match) => match && match.playerA && match.playerB);
    const counts = countCompletedPlayableMatches(playableMatches);
    const finalMatch = getDoubleEliminationFinalMatch(structure);
    const finalCompleted = isCompletedPlayableMatch(finalMatch);
    const placements = buildDoubleEliminationFinalPlacements(structure);
    const ready = counts.total > 0 && counts.completed === counts.total && finalCompleted && placements.length > 0;

    return {
      ready,
      completed: false,
      reason: ready
        ? "Todas as partidas jogáveis do Double Elimination foram finalizadas."
        : "Finalize todas as partidas jogáveis do Double Elimination antes de fechar. A chave completa ainda é experimental nesta fase.",
      totalMatches: counts.total,
      completedMatches: counts.completed,
      champion: placements[0] || null,
      finalResults: {
        format: "double-elimination",
        champion: placements[0] || null,
        runnerUp: placements[1] || null,
        thirdPlace: placements[2] || null,
        placements,
        matchesSummary: {
          totalPlayableMatches: counts.total,
          completedMatches: counts.completed
        }
      }
    };
  }

  return {
    ready: false,
    completed: false,
    reason: "Formato ainda sem fechamento automático nesta versão.",
    totalMatches: 0,
    completedMatches: 0,
    finalResults: existingFinalResults
  };
}

function renderFinalPlacementsList(finalResults, limit = 4) {
  const placements = Array.isArray(finalResults?.placements) ? finalResults.placements : [];

  if (placements.length === 0) {
    return "";
  }

  return `
    <div class="final-placements-list">
      ${placements.slice(0, limit).map((player) => `
        <div class="final-placement-row">
          <strong>${escapeHTML(player.placementLabel || `${player.placement || "-"}º lugar`)}</strong>
          <span>${escapeHTML(player.nickname || player.name || "Jogador")}</span>
          ${player.team ? `<em>${escapeHTML(player.team)}</em>` : ""}
        </div>
      `).join("")}
    </div>
  `;
}

function renderTournamentFinalizationPanel(tournament) {
  if (!tournament || !tournament.structure) {
    return "";
  }

  const summary = getTournamentCompletionSummary(tournament);
  const finalResults = summary.finalResults || getExistingFinalResults(tournament);
  const championName = finalResults?.champion?.nickname || finalResults?.champion?.name || summary.champion?.nickname || summary.champion?.name || "A definir";
  const finalizedAt = finalResults?.finalizedAt || finalResults?.completedAt || "";
  const finalizedLabel = finalizedAt ? new Date(finalizedAt).toLocaleString("pt-BR") : "";

  if (summary.completed || String(tournament.status || "").toLowerCase() === "completed") {
    return `
      <div class="structure-card finalization-card finalization-card-done">
        <h4>Torneio finalizado</h4>
        <p class="manager-meta">
          Campeão: <strong>${escapeHTML(championName)}</strong>${finalizedLabel ? ` · Finalizado em ${escapeHTML(finalizedLabel)}` : ""}
        </p>
        ${renderFinalPlacementsList(finalResults, 8)}
      </div>
    `;
  }

  return `
    <div class="structure-card finalization-card ${summary.ready ? "finalization-card-ready" : ""}">
      <h4>Fechamento do torneio</h4>
      <p class="manager-meta">
        ${escapeHTML(summary.reason)} Resultados: ${escapeHTML(summary.completedMatches)} / ${escapeHTML(summary.totalMatches)}.
      </p>
      ${summary.ready ? `
        <p class="manager-meta">
          Campeão detectado: <strong>${escapeHTML(championName)}</strong>.
          Ao finalizar, o status será alterado para Encerrado e a classificação final ficará salva no Supabase.
        </p>
        ${renderFinalPlacementsList(summary.finalResults, 4)}
        <button type="button" data-action="finalize-tournament">
          Finalizar torneio
        </button>
      ` : `
        <button type="button" disabled>
          Finalização bloqueada
        </button>
      `}
    </div>
  `;
}


function getResultsSafetySummary(tournament) {
  const structure = tournament?.structure || null;
  const matches = flattenStructureMatches(structure);
  const playable = matches.filter((match) => match && match.playerA && match.playerB);
  const completed = playable.filter((match) => match.status === "completed" && match.winnerId);
  const pending = playable.filter((match) => match.status !== "completed" || !match.winnerId);
  const waitingPlayers = matches.filter((match) => match && (!match.playerA || !match.playerB));
  const checkinMode = structure?.checkinMode || getTournamentCheckinMode(tournament);
  const eligible = Number(structure?.eligibleParticipantsCount || 0);
  const totalSnapshot = Number(structure?.totalParticipantsSnapshot || (Array.isArray(tournament?.participants) ? tournament.participants.length : 0));

  return {
    matches,
    playable,
    completed,
    pending,
    waitingPlayers,
    checkinMode,
    eligible,
    totalSnapshot,
    isReal: isSupabaseTournament(tournament),
    format: structure?.type || tournament?.format || "sem estrutura"
  };
}

function renderResultsSafetyPanel(tournament) {
  if (!tournament || !tournament.structure) {
    return "";
  }

  const summary = getResultsSafetySummary(tournament);
  const phaseSummary = getTournamentPhaseRulesSummary(tournament);
  const sourceLabel = summary.isReal ? "Supabase / inscrições reais" : "Local / teste";
  const checkinLabel = summary.checkinMode === "required" ? "Obrigatório" : "Opcional";

  return `
    <div class="structure-card results-safety-card">
      <div class="results-safety-header">
        <div>
          <h4>Validação antes de lançar resultados</h4>
          <p class="manager-meta">
            Confira jogadores, formato da fase e placar antes de salvar. Em Double Elimination, editar uma partida já lançada pode recalcular avanços posteriores.
          </p>
        </div>
        <span class="results-safety-source">${escapeHTML(sourceLabel)}</span>
      </div>

      <div class="results-safety-grid">
        <div class="results-safety-metric">
          <strong>${escapeHTML(summary.completed.length)} / ${escapeHTML(summary.playable.length)}</strong>
          <span>partidas concluídas</span>
        </div>
        <div class="results-safety-metric">
          <strong>${escapeHTML(summary.pending.length)}</strong>
          <span>partidas pendentes</span>
        </div>
        <div class="results-safety-metric">
          <strong>${escapeHTML(summary.waitingPlayers.length)}</strong>
          <span>aguardando jogadores</span>
        </div>
        <div class="results-safety-metric">
          <strong>${escapeHTML(checkinLabel)}</strong>
          <span>check-in</span>
        </div>
      </div>

      <div class="results-safety-notes">
        <span>Participantes válidos na geração: ${escapeHTML(summary.eligible)} / ${escapeHTML(summary.totalSnapshot || summary.eligible)}</span>
        <span>Regras de partidas: ${escapeHTML(phaseSummary)}</span>
      </div>
    </div>
  `;
}


function renderRealTestChecklistItem(state, label, hint) {
  const normalizedState = String(state || "pending").toLowerCase();
  const stateLabels = {
    ok: "OK",
    pending: "Pendente",
    warning: "Atenção",
    neutral: "Opcional"
  };

  return `
    <li class="real-test-checklist-item ${escapeHTML(normalizedState)}">
      <span class="real-test-checklist-marker">${escapeHTML(stateLabels[normalizedState] || "Pendente")}</span>
      <div>
        <strong>${escapeHTML(label)}</strong>
        <p>${escapeHTML(hint)}</p>
      </div>
    </li>
  `;
}

function hasDoubleEliminationCoreSections(structure) {
  if (!structure || structure.type !== "double-elimination") {
    return false;
  }

  return Boolean(
    structure.winnersBracket ||
    structure.winnerBracket ||
    structure.upperBracket ||
    structure.lowerBracket ||
    structure.losersBracket ||
    structure.grandFinal ||
    structure.grand_final
  );
}

function renderRealTestChecklistPanel(tournament) {
  if (!tournament || !tournament.structure) {
    return "";
  }

  const summary = getResultsSafetySummary(tournament);
  const structure = tournament.structure;
  const isDoubleElimination = String(structure.type || tournament.format || "") === "double-elimination";
  const hasParticipants = summary.totalSnapshot > 0;
  const hasEligibleParticipants = summary.eligible > 0;
  const hasPlayableMatches = summary.playable.length > 0;
  const hasWaitingMatches = summary.waitingPlayers.length > 0;
  const hasCompletedMatches = summary.completed.length > 0;
  const doubleCoreReady = hasDoubleEliminationCoreSections(structure);

  const items = [
    renderRealTestChecklistItem(
      summary.isReal ? "ok" : "warning",
      "Origem dos dados",
      summary.isReal
        ? "Estrutura vinculada a torneio salvo/Supabase. Use este modo para validação real."
        : "Estrutura local/de teste. Use apenas para ensaio visual ou conferência rápida."
    ),
    renderRealTestChecklistItem(
      hasParticipants ? "ok" : "pending",
      "Inscrições carregadas",
      hasParticipants
        ? `${summary.totalSnapshot} participante(s) encontrados na estrutura ou no torneio.`
        : "Ainda não há participantes carregados para validar o fluxo real."
    ),
    renderRealTestChecklistItem(
      hasEligibleParticipants ? "ok" : "pending",
      "Check-in confirmado",
      hasEligibleParticipants
        ? `${summary.eligible} participante(s) válidos para geração da estrutura.`
        : "Confirme o check-in antes de validar chave e resultados reais."
    ),
    renderRealTestChecklistItem(
      hasPlayableMatches ? "ok" : (hasWaitingMatches ? "warning" : "pending"),
      "Partidas prontas para teste",
      hasPlayableMatches
        ? `${summary.playable.length} partida(s) com dois jogadores/equipes definidos.`
        : "A estrutura ainda possui partidas aguardando jogadores ou não tem confrontos jogáveis."
    ),
    renderRealTestChecklistItem(
      isDoubleElimination ? (doubleCoreReady ? "ok" : "warning") : "neutral",
      "Estrutura Double Elimination",
      isDoubleElimination
        ? (doubleCoreReady
          ? "Winners/Lower/Grand Final detectadas para o teste de progressão."
          : "Confira se Winners, Lower e Grand Final foram geradas antes do teste completo.")
        : "Este item se aplica apenas a torneios Double Elimination."
    ),
    renderRealTestChecklistItem(
      hasCompletedMatches ? "ok" : "pending",
      "Resultados lançados",
      hasCompletedMatches
        ? `${summary.completed.length} resultado(s) já lançados. Confira se a progressão dependente está correta.`
        : "Nenhum resultado lançado ainda. Faça este teste apenas com torneio de validação."
    )
  ];

  return `
    <div class="structure-card real-test-checklist-card">
      <div class="results-safety-header">
        <div>
          <h4>Checklist de teste real</h4>
          <p class="manager-meta">
            Use esta lista antes do teste com participantes reais. Ela não bloqueia ações, apenas ajuda a conferir se o torneio está pronto para validar inscrição, check-in, chave, resultados e progressão.
          </p>
        </div>
        <span class="results-safety-source">Teste guiado</span>
      </div>

      <ol class="real-test-checklist">
        ${items.join("")}
      </ol>

      <div class="results-safety-notes">
        <span>Fluxo sugerido: inscrição → check-in → gerar estrutura → lançar resultados → validar Lower/Grand Final.</span>
        <span>Use primeiro um torneio de teste. Não valide em torneio oficial antes de confirmar a progressão completa.</span>
      </div>
    </div>
  `;
}

function getResultMatchSafetyInfo(match, tournament) {
  const isPlayable = Boolean(match?.playerA && match?.playerB);
  const isCompleted = Boolean(match?.status === "completed" && match?.winnerId);
  const matchFormat = getEffectiveMatchFormat(tournament, match);

  if (!isPlayable) {
    return {
      className: "waiting",
      label: "Aguardando jogador",
      hint: "Esta partida ainda não possui os dois lados definidos."
    };
  }

  if (isCompleted) {
    return {
      className: "done",
      label: "Resultado lançado",
      hint: "Editar este resultado pode alterar progressões dependentes.",
      format: matchFormat
    };
  }

  return {
    className: "ready",
    label: "Pronta para resultado",
    hint: `Formato esperado: ${getMatchFormatLabel(matchFormat)}.`,
    format: matchFormat
  };
}

function describeMatchForResultAction(match, scoreA = null, scoreB = null, tournament = null) {
  const playerA = getRawPlayerName(match?.playerA) || "A definir";
  const playerB = getRawPlayerName(match?.playerB) || "A definir";
  const formatLabel = getMatchFormatLabel(getEffectiveMatchFormat(tournament, match));
  const phaseLabel = match?.phaseLabel || match?.roundName || match?.name || "Partida";
  const scoreLabel = scoreA !== null && scoreB !== null ? ` — placar ${scoreA} x ${scoreB}` : "";

  return `${phaseLabel}: ${playerA} vs ${playerB} (${formatLabel})${scoreLabel}`;
}

function hasDoubleEliminationDependentProgression(tournament, match) {
  if (!tournament || tournament.structure?.type !== "double-elimination" || !match?.nextMatchId || !match?.nextSlot) {
    return false;
  }

  const nextMatch = findDoubleEliminationMatch(tournament.structure, match.nextMatchId);
  if (!nextMatch) return false;

  return Boolean(nextMatch[match.nextSlot] || nextMatch.status === "completed" || nextMatch.winnerId);
}

function confirmResultSaveAction(tournament, updates) {
  if (!Array.isArray(updates) || updates.length === 0) {
    return false;
  }

  const isDouble = tournament?.structure?.type === "double-elimination";
  const hasCompletedEdit = updates.some((update) => update.match?.status === "completed" || update.match?.winnerId);
  const hasDependentProgression = updates.some((update) => hasDoubleEliminationDependentProgression(tournament, update.match));

  if (!isDouble && !hasCompletedEdit) {
    return true;
  }

  const lines = updates.slice(0, 5).map((update) => {
    return `• ${describeMatchForResultAction(update.match, update.scoreA, update.scoreB, tournament)}`;
  });

  const extraCount = updates.length > lines.length ? `\n• +${updates.length - lines.length} outra(s) partida(s)` : "";
  const warning = [
    `Confirmar salvamento de ${updates.length} resultado(s)?`,
    "",
    ...lines,
    extraCount,
    "",
    isDouble ? "Atenção: em Double Elimination, vencedores avançam e perdedores podem cair para a Lower Bracket automaticamente." : "",
    hasCompletedEdit ? "Você está editando uma partida que já tinha resultado lançado." : "",
    hasDependentProgression ? "Existem progressões dependentes desta partida. O sistema pode limpar/recalcular partidas seguintes." : "",
    "",
    "Confira o placar, o FT/MD da fase e os jogadores antes de continuar."
  ].filter(Boolean).join("\n");

  return confirm(warning);
}

function buildClearResultWarning(tournament, matches, allResults = false) {
  const list = Array.isArray(matches) ? matches : [];
  const isDouble = tournament?.structure?.type === "double-elimination";
  const hasDependentProgression = list.some((match) => hasDoubleEliminationDependentProgression(tournament, match));

  if (allResults) {
    return [
      "Limpar TODOS os resultados deste torneio?",
      "",
      "Isso reseta placares, vencedores, tabela/progressão e rascunhos de resultado.",
      isDouble ? "No Double Elimination, Winners, Lower, Grand Final e Reset serão recalculados a partir do estado limpo." : "",
      "",
      "Continuar?"
    ].filter(Boolean).join("\n");
  }

  const lines = list.slice(0, 5).map((match) => `• ${describeMatchForResultAction(match, null, null, tournament)}`);
  const extraCount = list.length > lines.length ? `\n• +${list.length - lines.length} outra(s) partida(s)` : "";

  return [
    `Limpar resultado de ${list.length} partida(s)?`,
    "",
    ...lines,
    extraCount,
    "",
    hasDependentProgression ? "Atenção: uma ou mais partidas possuem progressão dependente e partidas seguintes podem ser limpas/recalculadas." : "",
    "Continuar?"
  ].filter(Boolean).join("\n");
}

async function finalizeTournament() {
  const tournament = getTournamentById(selectedTournamentId);

  if (!tournament || !tournament.structure) {
    alert("Gere a estrutura antes de finalizar o torneio.");
    return;
  }

  updateStandingsByFormat(tournament);

  const summary = getTournamentCompletionSummary(tournament);

  if (!summary.ready || !summary.finalResults?.champion) {
    alert(summary.reason || "O torneio ainda não está pronto para ser finalizado.");
    return;
  }

  const championName = summary.finalResults.champion.nickname || summary.finalResults.champion.name || "Campeão";
  const confirmFinish = confirm(`Finalizar este torneio agora? Campeão detectado: ${championName}. Esta ação salvará a classificação final.`);

  if (!confirmFinish) {
    return;
  }

  const now = new Date().toISOString();
  const previousMetadata = tournament.metadata && typeof tournament.metadata === "object" ? tournament.metadata : {};
  const previousSettings = tournament.settings && typeof tournament.settings === "object" ? tournament.settings : {};
  const previousFinalAudit = Array.isArray(previousMetadata.finalResultsAudit)
    ? previousMetadata.finalResultsAudit
    : [];
  const finalResults = {
    ...summary.finalResults,
    status: "completed",
    finalizedAt: now,
    completedAt: now,
    finalizedByAuthUserId: currentAuthUser?.id || currentUser?.id || "",
    finalizedByProfileId: currentProfile?.id || currentUser?.playerId || "",
    source: "tournament-admin-panel"
  };

  const auditEntry = {
    action: "finalize-tournament",
    at: now,
    championId: finalResults.champion?.playerId || finalResults.champion?.id || "",
    championName: finalResults.champion?.nickname || finalResults.champion?.name || "",
    completedMatches: summary.completedMatches,
    totalPlayableMatches: summary.totalMatches,
    byAuthUserId: finalResults.finalizedByAuthUserId,
    byProfileId: finalResults.finalizedByProfileId
  };

  tournament.settings = {
    ...previousSettings,
    finalResults,
    completedAt: now
  };

  tournament.metadata = {
    ...previousMetadata,
    finalResults,
    completedAt: now,
    finalResultsLastAction: auditEntry,
    finalResultsAudit: [...previousFinalAudit.slice(-49), auditEntry]
  };

  tournament.finalResults = finalResults;
  tournament.completedAt = now;
  tournament.status = "completed";
  tournament.updatedAt = now;

  const saved = await finishResultsUpdate(tournament, {
    action: "finalize-tournament",
    status: "completed"
  });

  if (saved) {
    alert(`Torneio finalizado. Campeão: ${championName}.`);
  }
}

    async function finishResultsUpdate(tournament, options = {}) {
      updateStandingsByFormat(tournament);

      tournament.updatedAt = new Date().toISOString();

      const currentMatches = flattenStructureMatches(tournament.structure);
      const hasCompletedMatch = currentMatches.some((match) => match.status === "completed");
      const requestedStatus = options.status || null;

      tournament.matches = currentMatches;
      tournament.status = requestedStatus || (hasCompletedMatch ? "in-progress" : "structure-generated");

      if (isSupabaseTournament(tournament)) {
        if (typeof sbwSaveSupabaseTournamentResultsAsync !== "function") {
          alert("Função de salvamento de resultados reais não encontrada. Confira se tournaments-storage.js está atualizado para a v1.5.8.7.");
          return false;
        }

        previewOutput.textContent = "Salvando resultados reais no Supabase...";

        const result = await sbwSaveSupabaseTournamentResultsAsync(tournament, {
          action: options.action || "results-update",
          status: tournament.status,
          authUserId: currentAuthUser?.id || currentUser?.id || "",
          profileId: currentProfile?.id || currentUser?.playerId || "",
          source: "tournament-admin-panel"
        });

        if (!result.success) {
          previewOutput.textContent = JSON.stringify(result, null, 2);
          alert(result.message || "Não foi possível salvar os resultados no Supabase.");
          return false;
        }

        tournament = {
          ...tournament,
          ...(result.tournament || {}),
          participants: tournament.participants,
          structure: tournament.structure,
          matches: tournament.matches,
          standings: tournament.standings,
          source: "supabase"
        };
      }

      updateTournament(tournament);
      renderTournamentManager();
      await renderSavedTournaments();
      renderStructurePreview(tournament);

      previewOutput.textContent = JSON.stringify(tournament, null, 2);
      return true;
    }

     function isTripleBracketTemplateStructure(tournamentOrStructure) {
      const structure = tournamentOrStructure?.structure || tournamentOrStructure;
      if (!structure || structure.type !== "triple-bracket") return false;

      if (window.SBWTripleBracket && typeof window.SBWTripleBracket.isTemplateStructure === "function") {
        return window.SBWTripleBracket.isTemplateStructure(structure);
      }

      const groupStage = structure.groupStage || {};
      const resultLock = structure.resultLock || groupStage.resultLock || {};
      const placeholderSlots = Number(structure.placeholderSlots || groupStage.placeholderSlots || 0);
      const realPlayersUsed = Number(structure.realPlayersUsed || groupStage.realTeams || 0);

      return Boolean(
        structure.templateMode ||
        groupStage.templateMode ||
        resultLock.locked ||
        placeholderSlots > 0 ||
        (realPlayersUsed > 0 && realPlayersUsed < 8)
      );
    }

    function getTripleBracketOfficializationSummary(tournamentOrStructure) {
      const structure = tournamentOrStructure?.structure || tournamentOrStructure;
      if (window.SBWTripleBracket && typeof window.SBWTripleBracket.buildOfficializationSummary === "function") {
        return window.SBWTripleBracket.buildOfficializationSummary(structure);
      }

      const groupStage = structure?.groupStage || {};
      const placeholderSlots = Number(structure?.placeholderSlots || groupStage.placeholderSlots || 0);
      const realPlayersUsed = Number(structure?.realPlayersUsed || groupStage.realTeams || 0);
      const templateMode = isTripleBracketTemplateStructure(structure);

      return {
        templateMode,
        officialMode: !templateMode,
        resultLocked: templateMode,
        realPlayersUsed,
        placeholderSlots,
        requiredTeams: 8,
        title: templateMode ? "Modelo com vagas em aberto" : "Estrutura oficial",
        message: templateMode
          ? `Este modelo tem ${realPlayersUsed} inscrito(s) real(is) e ${placeholderSlots} vaga(s) em aberto. Resultados ficam bloqueados até regenerar com 8 equipes reais.`
          : "Esta estrutura foi gerada com 8 equipes reais. Resultados oficiais da fase todos contra todos estão liberados."
      };
    }

    function ensureTripleBracketResultsUnlocked(tournament) {
      if (!tournament || !tournament.structure || tournament.structure.type !== "triple-bracket") return true;

      if (!isTripleBracketTemplateStructure(tournament)) return true;

      const summary = getTripleBracketOfficializationSummary(tournament);
      alert(
        `${summary.title}\n\n${summary.message}\n\n` +
        "Ação correta: quando as 8 equipes reais estiverem definidas, gere novamente a estrutura oficial antes de lançar resultados."
      );
      return false;
    }

    function ensureEditableResultsMode(tournament) {
     if (!tournament || !tournament.structure) return false;

      return [
     "league",
     "groups-playoffs",
     "double-elimination",
     "triple-bracket"
     ].includes(tournament.structure.type);
    }

    async function saveSingleResult(matchId, matchCard) {
      const tournament = getTournamentById(selectedTournamentId);

      if (!ensureEditableResultsMode(tournament)) {
        alert("O lançamento de resultados está ativo para Liga, Grupos + Playoffs, Double Elimination e Sistema de 3 Chaves.");
        return;
      }

      if (!ensureTripleBracketResultsUnlocked(tournament)) {
        return;
      }

      const match = findEditableMatch(tournament, matchId);

      if (!match) {
        alert("Partida não encontrada.");
        return;
      }

      if (!match.playerA || !match.playerB) {
        alert("Esta partida é BYE/descanso e não precisa de resultado.");
        return;
      }

      updateDraftFromCard(matchCard);

      const scoreAInput = matchCard.querySelector("[data-score-a]");
      const scoreBInput = matchCard.querySelector("[data-score-b]");
      const parsed = parseScoreInputs(scoreAInput, scoreBInput, match, tournament);

      if (!parsed.valid) {
        alert(parsed.message);
        return;
      }

      if (!confirmResultSaveAction(tournament, [{
        matchId,
        match,
        scoreA: parsed.scoreA,
        scoreB: parsed.scoreB
      }])) {
        return;
      }

      applyMatchResult(match, parsed.scoreA, parsed.scoreB, tournament);
      clearResultDraft(matchId);

      await finishResultsUpdate(tournament, { action: "save-single-result" });
    }

    async function saveSelectedResults() {
      const tournament = getTournamentById(selectedTournamentId);

      if (!ensureEditableResultsMode(tournament)) {
        alert("O salvamento em lote está ativo para Liga, Grupos + Playoffs, Double Elimination e Sistema de 3 Chaves.");
        return;
      }

      if (!ensureTripleBracketResultsUnlocked(tournament)) {
        return;
      }

      const selectedCards = Array.from(structureOutput.querySelectorAll("[data-match-card]"))
        .filter((card) => card.querySelector("[data-select-result]")?.checked);

      if (selectedCards.length === 0) {
        alert("Marque pelo menos uma partida para salvar.");
        return;
      }

      const updates = [];

      for (const card of selectedCards) {
        updateDraftFromCard(card);

        const matchId = card.dataset.matchCard;
        const match = findEditableMatch(tournament, matchId);

        if (!match || !match.playerA || !match.playerB) {
          alert("Uma das partidas selecionadas não pode receber resultado.");
          return;
        }

        const parsed = parseScoreInputs(
          card.querySelector("[data-score-a]"),
          card.querySelector("[data-score-b]"),
          match,
          tournament
        );

        if (!parsed.valid) {
          alert(parsed.message);
          return;
        }

        updates.push({
          matchId,
          match,
          scoreA: parsed.scoreA,
          scoreB: parsed.scoreB
        });
      }

      if (!confirmResultSaveAction(tournament, updates)) {
        return;
      }

      updates.forEach((update) => {
        applyMatchResult(update.match, update.scoreA, update.scoreB, tournament);
        clearResultDraft(update.matchId);
      });

      const saved = await finishResultsUpdate(tournament, { action: "save-selected-results" });

      if (saved) {
        alert(`${updates.length} resultado(s) selecionado(s) salvo(s) com sucesso.`);
      }
    }

    async function clearSingleResult(matchId) {
      const tournament = getTournamentById(selectedTournamentId);
      if (!ensureEditableResultsMode(tournament)) return;

      const match = findEditableMatch(tournament, matchId);
      if (!match) return;

      const confirmClear = confirm(buildClearResultWarning(tournament, [match]));
      if (!confirmClear) return;

      clearMatchObject(match, tournament);
      clearResultDraft(matchId);

      await finishResultsUpdate(tournament, { action: "clear-single-result" });
    }

    async function clearSelectedResults() {
      const tournament = getTournamentById(selectedTournamentId);

      if (!ensureEditableResultsMode(tournament)) {
        alert("A limpeza em lote está ativa para Liga, Grupos + Playoffs e Double Elimination.");
        return;
      }

      const selectedCards = Array.from(structureOutput.querySelectorAll("[data-match-card]"))
        .filter((card) => card.querySelector("[data-select-result]")?.checked);

      if (selectedCards.length === 0) {
        alert("Marque pelo menos uma partida para limpar.");
        return;
      }

      const selectedMatchesForWarning = selectedCards
        .map((card) => findEditableMatch(tournament, card.dataset.matchCard))
        .filter(Boolean);
      const confirmClear = confirm(buildClearResultWarning(tournament, selectedMatchesForWarning));
      if (!confirmClear) return;

      let clearedCount = 0;

      selectedCards.forEach((card) => {
        const matchId = card.dataset.matchCard;
        const match = findEditableMatch(tournament, matchId);

        if (!match) return;

        clearMatchObject(match, tournament);
        clearResultDraft(matchId);
        clearedCount += 1;
      });

      const saved = await finishResultsUpdate(tournament, { action: "clear-selected-results" });

      if (saved) {
        alert(`${clearedCount} partida(s) selecionada(s) foram limpas.`);
      }
    }

    async function clearAllResults() {
      const tournament = getTournamentById(selectedTournamentId);

      if (!ensureEditableResultsMode(tournament)) {
        alert("A limpeza total está ativa para Liga, Grupos + Playoffs e Double Elimination.");
        return;
      }

      const confirmClear = confirm(buildClearResultWarning(tournament, flattenStructureMatches(tournament.structure), true));
      if (!confirmClear) return;

      let clearedCount = 0;

      if (tournament.structure.type === "league") {
        tournament.structure.rounds.forEach((round) => {
          round.matches.forEach((match) => {
            if (!match.playerA || !match.playerB) return;
            clearMatchObject(match, tournament);
            clearResultDraft(match.id);
            clearedCount += 1;
          });
        });
      }

      if (tournament.structure.type === "groups-playoffs") {
        tournament.structure.groups.forEach((group) => {
          group.rounds.forEach((round) => {
            round.matches.forEach((match) => {
              if (!match.playerA || !match.playerB) return;
              clearMatchObject(match, tournament);
              clearResultDraft(match.id);
              clearedCount += 1;
            });
          });
        });
      }

      if (tournament.structure.type === "double-elimination") {
        flattenStructureMatches(tournament.structure).forEach((match) => {
          if (!match) return;

          const hadResult = match.status === "completed" || match.scoreA !== null || match.scoreB !== null || match.winnerId;
          const hasPlayers = Boolean(match.playerA || match.playerB);

          if (!hadResult && !hasPlayers) return;

          clearMatchObject(match, tournament);
          clearResultDraft(match.id);
          clearedCount += 1;
        });

        applyAutomaticDoubleEliminationByes(tournament);
      }

      if (tournament.structure.type === "triple-bracket") {
        flattenStructureMatches(tournament.structure).forEach((match) => {
          if (!match) return;

          const hadResult = match.status === "completed" || match.scoreA !== null || match.scoreB !== null || match.winnerId;
          if (!hadResult) return;

          clearMatchObject(match, tournament);
          clearResultDraft(match.id);
          clearedCount += 1;
        });
      }

      clearDraftsForTournament(selectedTournamentId);
      const saved = await finishResultsUpdate(tournament, { action: "clear-all-results" });

      if (saved) {
        alert(`Todos os resultados foram limpos. ${clearedCount} partida(s) resetada(s).`);
      }
    }

    function setAllSelection(selected) {
      const cards = Array.from(structureOutput.querySelectorAll("[data-match-card]"));

      cards.forEach((card) => {
        const checkbox = card.querySelector("[data-select-result]");
        if (!checkbox) return;

        checkbox.checked = selected;
        updateDraftFromCard(card);
      });
    }

    function renderMatchRows(matches) {
      return matches
        .map((match) => `
          <div class="match-row">
            <span>${getPlayerName(match.playerA)}</span>
            <span class="match-vs">vs</span>
            <span>${getPlayerName(match.playerB)}</span>
            <span class="match-status">${match.status === "bye" ? "Descanso/Bye" : "Pendente"}</span>
          </div>
        `)
        .join("");
    }

    function renderEditableMatchRows(matches) {
      return matches
        .map((match) => {
          const isBye = !match.playerA || !match.playerB;
          const isCompleted = match.status === "completed";
          const winnerA = isCompleted && match.playerA && String(match.winnerId || "") === getMatchPlayerKey(match.playerA);
          const winnerB = isCompleted && match.playerB && String(match.winnerId || "") === getMatchPlayerKey(match.playerB);
          const scoreAValue = getInputValueForMatch(match, "scoreA");
          const scoreBValue = getInputValueForMatch(match, "scoreB");
          const activeTournament = getSelectedTournament();
          const matchFormat = getEffectiveMatchFormat(activeTournament, match);
          const matchPhaseLabel = match.phaseLabel || "Regra padrão";
          const safetyInfo = getResultMatchSafetyInfo(match, activeTournament);
          const isSelected = isMatchDraftSelected(match.id);
          const tripleTemplateLocked = Boolean(
            activeTournament?.structure?.type === "triple-bracket" &&
            isTripleBracketTemplateStructure(activeTournament)
          );

          if (isBye) {
            return `
              <div class="match-row">
                <span>${getPlayerName(match.playerA)}</span>
                <span class="match-vs">vs</span>
                <span>${getPlayerName(match.playerB)}</span>
                <span class="match-status">Descanso/Bye</span>
              </div>
            `;
          }

          if (tripleTemplateLocked) {
            return `
              <div class="result-match-card is-result-locked" data-match-card="${match.id}">
                <div class="result-format-line">
                  <span>${escapeHTML(matchPhaseLabel)}</span>
                  <strong>Modelo bloqueado</strong>
                </div>

                <div class="result-safety-line warning">
                  <strong>Resultados bloqueados</strong>
                  <span>Este Sistema de 3 Chaves foi gerado com vagas em aberto. Regenere com 8 equipes reais antes de lançar placares.</span>
                </div>

                <div class="result-match-top">
                  <div class="result-player">${getPlayerName(match.playerA)}</div>
                  <div class="match-vs">vs</div>
                  <div class="result-player right">${getPlayerName(match.playerB)}</div>
                </div>
              </div>
            `;
          }

          return `
            <div class="result-match-card" data-match-card="${match.id}">
              <label class="match-select-line">
                <input type="checkbox" data-select-result="${match.id}" ${isSelected ? "checked" : ""} />
                <span>Selecionar partida</span>
              </label>

              <div class="result-format-line">
                <span>${escapeHTML(matchPhaseLabel)}</span>
                <strong>${escapeHTML(getMatchFormatLabel(matchFormat))}</strong>
              </div>

              <div class="result-safety-line ${escapeHTML(safetyInfo.className)}">
                <strong>${escapeHTML(safetyInfo.label)}</strong>
                <span>${escapeHTML(safetyInfo.hint)}</span>
              </div>

              <div class="result-match-top">
                <div class="result-player">
                  ${getPlayerName(match.playerA)}
                  ${winnerA ? `<div class="winner-badge">Vencedor</div>` : ""}
                </div>

                <div class="match-vs">vs</div>

                <div class="result-player right">
                  ${getPlayerName(match.playerB)}
                  ${winnerB ? `<div class="winner-badge">Vencedor</div>` : ""}
                </div>
              </div>

              <div class="result-controls">
                <div class="score-box">
                  <label>Placar A</label>
                  <input class="score-input" type="number" min="0" value="${escapeHTML(scoreAValue)}" data-score-a="${match.id}" />
                </div>

                <div class="score-box">
                  <label>Placar B</label>
                  <input class="score-input" type="number" min="0" value="${escapeHTML(scoreBValue)}" data-score-b="${match.id}" />
                </div>

                <button type="button" class="btn-small" data-action="save-single-result" data-match-id="${match.id}">
                  Salvar resultado
                </button>

                <button type="button" class="btn-secondary btn-small" data-action="clear-single-result" data-match-id="${match.id}">
                  Limpar
                </button>

                <span class="result-state ${isCompleted ? "done" : ""}">
                  ${isCompleted ? "Resultado lançado" : "Pendente"}
                </span>
              </div>
            </div>
          `;
        })
        .join("");
    }

        function renderStandingsTable(standings, qualifiedCount = 0) {
      if (!standings || standings.length === 0) {
        return `<p class="structure-empty">Nenhuma classificação criada.</p>`;
      }

      return `
        <table class="structure-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Jogador</th>
              <th>J</th>
              <th>V</th>
              <th>D</th>
              <th>Sets</th>
              <th>Saldo</th>
              <th>WR</th>
              <th>Pts</th>
            </tr>
          </thead>
          <tbody>
            ${standings.map((row, index) => {
              const isQualified = index < qualifiedCount;

              return `
                <tr class="${isQualified ? "qualified-row" : ""}">
                  <td>${index + 1}</td>
                  <td>
                    ${escapeHTML(row.nickname)}
                  </td>
                  <td>${row.played || 0}</td>
                  <td>${row.wins || 0}</td>
                  <td>${row.losses || 0}</td>
                  <td>${row.setsWon || 0}-${row.setsLost || 0}</td>
                  <td>${row.setBalance || 0}</td>
                  <td>${row.winRate || 0}%</td>
                  <td>${row.points || 0}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      `;
    }

    function renderBulkResultActions(label) {
      return `
        <div class="bulk-result-actions">
          <button type="button" data-action="save-selected-results">Salvar resultados selecionados</button>
          <button type="button" class="btn-secondary" data-action="select-all-results">Selecionar todas</button>
          <button type="button" class="btn-secondary" data-action="unselect-all-results">Desmarcar todas</button>
          <button type="button" class="btn-secondary" data-action="clear-selected-results">Limpar selecionadas</button>
          <button type="button" class="btn-danger" data-action="clear-all-results">Limpar todos os resultados</button>
          <span>${label}</span>
        </div>
      `;
    }


    function renderTripleBracketPlayoffPlayer(player, fallback = "A definir") {
      if (!player) {
        return `<div class="playoff-player empty">${escapeHTML(fallback)}</div>`;
      }

      const isWaiting = Boolean(player.waitingSlot || player.placeholder || player.isPlaceholder || player.slotStatus === "waiting");
      return `
        <div class="playoff-player ${isWaiting ? "empty" : ""}">
          ${escapeHTML(player.nickname || fallback)}
          <span>${escapeHTML(player.seedLabel || player.team || (isWaiting ? "A definir" : ""))}</span>
        </div>
      `;
    }

    function renderTripleBracketPlayoffMatch(match) {
      const locked = match.resultLocked !== false;
      return `
        <div class="playoff-match triple-bracket-playoff-match">
          <div class="playoff-bracket-round-title">${escapeHTML(match.label || match.name || match.id)}</div>
          ${renderTripleBracketPlayoffPlayer(match.playerA, match.slotA)}
          <div class="playoff-vs">vs</div>
          ${renderTripleBracketPlayoffPlayer(match.playerB, match.slotB)}
          <div class="match-status">
            ${locked ? "Resultados das chaves bloqueados nesta etapa" : escapeHTML(match.status || "pendente")}
          </div>
          ${(match.winnerTo || match.loserTo) ? `
            <div class="results-safety-notes">
              ${match.winnerTo ? `<span>Vencedor → ${escapeHTML(match.winnerTo)}</span>` : ""}
              ${match.loserTo ? `<span>Perdedor → ${escapeHTML(match.loserTo)}</span>` : ""}
            </div>
          ` : ""}
        </div>
      `;
    }

    function renderTripleBracketBracketPanel(title, bracket, description = "") {
      if (!bracket || bracket.status !== "generated") {
        return "";
      }

      return `
        <div class="structure-card triple-bracket-playoff-card">
          <h4>${escapeHTML(title || bracket.label || "Chave")}</h4>
          ${description ? `<p class="manager-meta">${escapeHTML(description)}</p>` : ""}
          ${(bracket.rounds || []).map((round) => `
            <div class="match-round-title">${escapeHTML(round.name || round.label || "Rodada")}</div>
            <div class="match-list">
              ${(round.matches || []).map(renderTripleBracketPlayoffMatch).join("")}
            </div>
          `).join("")}
        </div>
      `;
    }

    function renderTripleBracketPlayoffsPanel(structure) {
      const generated = structure.highBracket?.status === "generated" ||
        structure.middleBracket?.status === "generated" ||
        structure.lowBracket?.status === "generated";

      if (!generated) {
        return "";
      }

      return `
        <div class="structure-card triple-bracket-summary-card">
          <h4>Chaves geradas</h4>
          <p class="manager-meta">
            As chaves foram criadas com base na classificação final da fase todos contra todos. Nesta versão, elas são visualmente oficiais, mas os resultados das chaves ainda ficam bloqueados até a próxima etapa de automação.
          </p>
        </div>

        <div class="structure-grid triple-bracket-playoffs-grid">
          ${renderTripleBracketBracketPanel("Chave Alta", structure.highBracket, "1º ao 4º geral. Perdeu, desce para a Chave Média.")}
          ${renderTripleBracketBracketPanel("Chave Média", structure.middleBracket, "5º ao 8º geral + quedas da Chave Alta. Perdeu, desce para a Chave Baixa.")}
          ${renderTripleBracketBracketPanel("Chave Baixa", structure.lowBracket, "Última chance. Perdeu aqui, está eliminado.")}
          ${renderTripleBracketBracketPanel("Final Intermediária", structure.intermediaryFinal, "Vencedor da Chave Média contra vencedor da Chave Baixa.")}
          ${renderTripleBracketBracketPanel("Grande Final", structure.grandFinal, "Vencedor da Chave Alta contra vencedor da Final Intermediária. FT5 sem reset, com vantagem para a Chave Alta.")}
        </div>
      `;
    }

    function isTripleBracketGroupStageFinished(structure) {
      const rounds = structure?.groupStage?.rounds || structure?.rounds || [];
      const matches = rounds.flatMap((round) => round.matches || []).filter((match) => match.playerA && match.playerB);

      return matches.length > 0 && matches.every((match) => match.status === "completed");
    }

    function renderTripleBracketStructure(structure) {
      const groupStage = structure.groupStage || {};
      const rounds = groupStage.rounds || structure.rounds || [];
      const standings = groupStage.standings || structure.standings || [];
      const finished = isTripleBracketGroupStageFinished(structure);
      const officialization = getTripleBracketOfficializationSummary(structure);
      const playoffsGenerated = structure.highBracket?.status === "generated" || structure.middleBracket?.status === "generated" || structure.lowBracket?.status === "generated";
      const canGeneratePlayoffs = !officialization.resultLocked && finished;
      const highSeeds = standings.slice(0, 4);
      const middleSeeds = standings.slice(4, 8);

      return `
        <div class="structure-card triple-bracket-summary-card">
          <h4>${escapeHTML(structure.label || "Sistema de 3 Chaves")}</h4>
          <p class="manager-meta">
            Fase todos contra todos gerada para ${escapeHTML(structure.playersUsed || 8)} equipes.
            Esta etapa tem ${escapeHTML(groupStage.matchesTotal || 28)} partidas e define 1º–4º para Chave Alta e 5º–8º para Chave Média.
          </p>
          <div class="results-safety-notes">
            <span><strong>${escapeHTML(officialization.title)}</strong></span>
            <span>${escapeHTML(officialization.message)}</span>
          </div>

          <p class="manager-meta">
            Status: <strong>${finished ? "fase inicial concluída" : "fase inicial em andamento"}</strong>.
            ${officialization.resultLocked
              ? "Resultados bloqueados enquanto a estrutura tiver vagas em aberto."
              : (finished ? "Próxima etapa: gerar Chave Alta, Chave Média e Chave Baixa." : "Lance todos os resultados da fase inicial antes de avançar.")}
          </p>

          ${officialization.resultLocked
            ? `<p class="structure-empty">Modelo de visualização ativo. Quando houver 8 equipes reais, gere novamente a estrutura oficial antes de lançar resultados.</p>`
            : renderBulkResultActions(playoffsGenerated
              ? "Fase todos contra todos salva. As chaves já foram geradas; resultados das chaves entram na próxima etapa."
              : "Salve os resultados da fase todos contra todos. Depois, gere Chave Alta, Média e Baixa.")}

          ${canGeneratePlayoffs ? `
            <div class="bulk-result-actions">
              <button type="button" data-action="generate-triple-bracket-playoffs">
                ${playoffsGenerated ? "Regerar Chave Alta, Média e Baixa" : "Gerar Chave Alta, Média e Baixa"}
              </button>
              <span>${playoffsGenerated ? "As chaves já existem e serão substituídas se você regerar." : "Disponível porque a fase todos contra todos está concluída."}</span>
            </div>
          ` : ""}
        </div>

        <div class="structure-card triple-bracket-standings-card">
          <h4>Classificação geral</h4>
          <p class="manager-meta">
            Top 4 entram na Chave Alta. 5º ao 8º entram na Chave Média.
          </p>
          ${renderStandingsTable(standings, 4)}

          <div class="results-safety-notes">
            <span>Chave Alta provisória: ${highSeeds.map((row) => escapeHTML(row.nickname)).join(", ") || "aguardando resultados"}</span>
            <span>Chave Média provisória: ${middleSeeds.map((row) => escapeHTML(row.nickname)).join(", ") || "aguardando resultados"}</span>
          </div>
        </div>

        ${renderTripleBracketPlayoffsPanel(structure)}

        <div class="structure-grid triple-bracket-rounds-grid">
          ${rounds.map((round) => `
            <div class="structure-card">
              <h4>${escapeHTML(round.name)}</h4>
              <p class="manager-meta">Fase todos contra todos · ${escapeHTML((round.matches || []).length)} partida(s)</p>
              <div class="match-list">
                ${renderEditableMatchRows(round.matches || [])}
              </div>
            </div>
          `).join("")}
        </div>
      `;
    }

    function renderLeagueStructure(structure) {
      return `
        <div class="structure-card">
          <h4>${escapeHTML(structure.label)}</h4>
          <p class="manager-meta">
            ${structure.playersUsed} participantes. Vitória: ${structure.rules.pointsWin} pts. Derrota: ${structure.rules.pointsLoss} pts. Sem chave final.
          </p>

          ${renderStandingsTable(structure.standings)}
          ${renderBulkResultActions("Preencha placares, marque as partidas desejadas e salve ou limpe em lote.")}
        </div>

        <div class="structure-grid">
          ${structure.rounds.map((round) => `
            <div class="structure-card">
              <h4>${escapeHTML(round.name)}</h4>
              <div class="match-list">
                ${renderEditableMatchRows(round.matches)}
              </div>
            </div>
          `).join("")}
        </div>
      `;
    }

        function getPlayableGroupMatches(structure) {
      if (!structure || !structure.groups) return [];

      return structure.groups.flatMap((group) => {
        return group.rounds.flatMap((round) => {
          return round.matches.filter((match) => match.playerA && match.playerB);
        });
      });
    }

    function isGroupStageFinished(structure) {
      const matches = getPlayableGroupMatches(structure);

      if (matches.length === 0) {
        return false;
      }

      return matches.every((match) => match.status === "completed");
    }

    function getGroupQualifiers(structure) {
      const advancePerGroup = Number(structure.settings.advancePerGroup || 0);

      return structure.groups.flatMap((group, groupIndex) => {
        return group.standings.slice(0, advancePerGroup).map((row, index) => ({
          id: row.participantId,
          nickname: row.nickname,
          team: row.team || "",
          groupId: group.id,
          groupName: group.name,
          groupIndex,
          rank: index + 1,
          seedLabel: `${group.name} #${index + 1}`
        }));
      });
    }

    function getPlayoffRoundNameByPlayerCount(playerCount) {
      const names = {
        64: "32 avos de final",
        32: "16 avos de final",
        16: "Oitavas de final",
        8: "Quartas de final",
        4: "Semifinais",
        2: "Final"
      };

      return names[playerCount] || `Rodada com ${playerCount} jogadores`;
    }

          function buildPlayoffFirstRoundPairings(qualifiers) {
      const byGroupAndRank = {};

      qualifiers.forEach((player) => {
        const key = `${player.groupIndex}-${player.rank}`;
        byGroupAndRank[key] = player;
      });

      const groupIndexes = [...new Set(qualifiers.map((player) => player.groupIndex))]
        .sort((a, b) => a - b);

      const maxRank = Math.max(...qualifiers.map((player) => player.rank));
      const pairings = [];

      if (maxRank === 1) {
        const ordered = [...qualifiers].sort((a, b) => a.groupIndex - b.groupIndex);
        const half = ordered.length / 2;

        for (let index = 0; index < half; index += 1) {
          const playerA = ordered[index];
          const playerB = ordered[ordered.length - 1 - index];

          pairings.push({
            playerA,
            playerB,
            rule: `${playerA.seedLabel} x ${playerB.seedLabel}`
          });
        }

        return pairings;
      }

      const rankPairs = [];

      for (let rank = 1; rank <= Math.floor(maxRank / 2); rank += 1) {
        rankPairs.push([rank, maxRank - rank + 1]);
      }

      if (maxRank % 2 !== 0) {
        const middleRank = Math.ceil(maxRank / 2);
        rankPairs.push([middleRank, middleRank]);
      }

      rankPairs.forEach(([highRank, lowRank], rankPairIndex) => {
        groupIndexes.forEach((groupIndex, orderIndex) => {
          const opponentGroupIndex = groupIndexes[
            (orderIndex + rankPairIndex + 1) % groupIndexes.length
          ];

          const playerA = byGroupAndRank[`${groupIndex}-${highRank}`];
          const playerB = byGroupAndRank[`${opponentGroupIndex}-${lowRank}`];

          if (playerA && playerB && playerA.id !== playerB.id) {
            pairings.push({
              playerA,
              playerB,
              rule: `${playerA.seedLabel} x ${playerB.seedLabel}`
            });
          }
        });
      });

      const usedMatchKeys = new Set();

      return pairings.filter((pairing) => {
        const ids = [pairing.playerA.id, pairing.playerB.id].sort().join("|");

        if (usedMatchKeys.has(ids)) {
          return false;
        }

        usedMatchKeys.add(ids);
        return true;
      });
    }

        function buildRoundsFromPairings(pairings, tournamentKey, bracketKey, bracketLabel = "") {
      const playerCount = pairings.length * 2;

      const firstRoundMatches = pairings.map((pairing, index) => ({
        id: `${tournamentKey}-${bracketKey}-r1-m${index + 1}`,
        round: 1,
        order: index + 1,
        playerA: pairing.playerA,
        playerB: pairing.playerB,
        pairingRule: pairing.rule,
        status: pairing.playerA && pairing.playerB ? "pending" : "bye",
        scoreA: null,
        scoreB: null,
        winnerId: null,
        resultWorkflow: createMatchWorkflow()
      }));

      const firstRoundName = bracketLabel
        ? `${getPlayoffRoundNameByPlayerCount(playerCount)} - ${bracketLabel}`
        : getPlayoffRoundNameByPlayerCount(playerCount);

      const rounds = [
        {
          id: `${tournamentKey}-${bracketKey}-round-1`,
          name: firstRoundName,
          matches: firstRoundMatches
        }
      ];

      let playersInRound = playerCount;
      let roundNumber = 1;

      while (playersInRound > 2) {
        playersInRound = playersInRound / 2;
        roundNumber += 1;

        const matchCount = playersInRound / 2;

        let roundName = getPlayoffRoundNameByPlayerCount(playersInRound);

        if (bracketLabel && playersInRound === 2) {
          roundName = `Final - ${bracketLabel}`;
        } else if (bracketLabel) {
          roundName = `${roundName} - ${bracketLabel}`;
        }

        rounds.push({
          id: `${tournamentKey}-${bracketKey}-round-${roundNumber}`,
          name: roundName,
          matches: Array.from({ length: matchCount }, (_, index) => ({
            id: `${tournamentKey}-${bracketKey}-r${roundNumber}-m${index + 1}`,
            round: roundNumber,
            order: index + 1,
            playerA: null,
            playerB: null,
            pairingRule: "A definir",
            status: "waiting",
            scoreA: null,
            scoreB: null,
            winnerId: null,
            sourceA: null,
            sourceB: null,
            resultWorkflow: createMatchWorkflow()
          }))
        });
      }

      return rounds;
    }

    function splitPairingsIntoSides(pairings) {
      const sideA = [];
      const sideB = [];

      pairings.forEach((pairing, index) => {
        if (index % 2 === 0) {
          sideA.push(pairing);
        } else {
          sideB.push(pairing);
        }
      });

      return {
        sideA,
        sideB
      };
    }

    function buildPlayoffData(qualifiers, tournamentKey) {
      const pairings = buildPlayoffFirstRoundPairings(qualifiers);
      const totalQualified = qualifiers.length;

      if (totalQualified <= 8) {
        return {
          mode: "single",
          rounds: buildRoundsFromPairings(pairings, tournamentKey, "single"),
          final: null,
          thirdPlace: {
            id: `${tournamentKey}-po-third-place`,
            name: "Disputa de terceiro lugar",
            playerA: null,
            playerB: null,
            status: "waiting-semifinal-losers",
            scoreA: null,
            scoreB: null,
            winnerId: null,
            resultWorkflow: createMatchWorkflow()
          }
        };
      }

      const { sideA, sideB } = splitPairingsIntoSides(pairings);

      return {
        mode: "split-sides",
        sides: [
          {
            id: "A",
            label: "Chave A",
            totalPlayers: sideA.length * 2,
            rounds: buildRoundsFromPairings(sideA, tournamentKey, "side-a", "Chave A")
          },
          {
            id: "B",
            label: "Chave B",
            totalPlayers: sideB.length * 2,
            rounds: buildRoundsFromPairings(sideB, tournamentKey, "side-b", "Chave B")
          }
        ],
        final: {
          id: `${tournamentKey}-po-grand-final`,
          name: "Final Geral",
          playerA: null,
          playerB: null,
          status: "waiting-side-winners",
          scoreA: null,
          scoreB: null,
          winnerId: null,
          resultWorkflow: createMatchWorkflow()
        },
          thirdPlace: {
          id: `${tournamentKey}-po-third-place`,
          name: "Disputa de terceiro lugar",
          playerA: null,
          playerB: null,
          status: "waiting-side-final-losers",
          scoreA: null,
          scoreB: null,
          winnerId: null,
          resultWorkflow: createMatchWorkflow()
        }
      };
    }

    async function generateTripleBracketPlayoffs() {
      activePlayoffMatchId = null;
      const tournament = getTournamentById(selectedTournamentId);

      if (!tournament || !tournament.structure || tournament.structure.type !== "triple-bracket") {
        alert("Selecione um torneio Sistema de 3 Chaves.");
        return;
      }

      if (!window.SBWTripleBracket || typeof window.SBWTripleBracket.buildPlayoffBracketsFromGroupStage !== "function") {
        alert("Helper do Sistema de 3 Chaves não foi carregado. Confira triple-bracket.js.");
        return;
      }

      const structure = tournament.structure;
      const officialization = getTripleBracketOfficializationSummary(structure);

      if (officialization.resultLocked) {
        alert("Não é possível gerar chaves oficiais a partir de um modelo com vagas em aberto. Regenere a estrutura com 8 equipes reais primeiro.");
        return;
      }

      if (!window.SBWTripleBracket.areGroupStageMatchesCompleted(structure)) {
        alert("Finalize as 28 partidas da fase todos contra todos antes de gerar Chave Alta, Chave Média e Chave Baixa.");
        return;
      }

      if (structure.highBracket?.status === "generated" || structure.middleBracket?.status === "generated" || structure.lowBracket?.status === "generated") {
        const confirmRegenerate = confirm("As chaves do Sistema de 3 Chaves já foram geradas. Gerar novamente vai substituir Chave Alta, Média, Baixa e finais. Continuar?");
        if (!confirmRegenerate) return;
      }

      const playoffResult = window.SBWTripleBracket.buildPlayoffBracketsFromGroupStage(structure, {
        matchFormat: tournament?.settings?.matchFormat || tournament?.matchFormat || "MD3"
      });

      if (!playoffResult || !playoffResult.success) {
        alert(playoffResult?.message || "Não foi possível gerar as chaves do Sistema de 3 Chaves.");
        return;
      }

      structure.playoffs = playoffResult.playoffSummary;
      structure.highBracket = playoffResult.highBracket;
      structure.middleBracket = playoffResult.middleBracket;
      structure.lowBracket = playoffResult.lowBracket;
      structure.intermediaryFinal = playoffResult.intermediaryFinal;
      structure.grandFinal = playoffResult.grandFinal;
      structure.currentStep = "triple_playoffs";
      structure.automationStage = "triple_playoff_brackets_generated";
      structure.playoffGeneratedAt = playoffResult.generatedAt;
      structure.notes = {
        ...(structure.notes || {}),
        playoffMessage: "Chaves geradas com base na classificação final da fase todos contra todos. Resultados das chaves ainda ficam bloqueados até a automação de avanço entre chaves."
      };

      tournament.structure = structure;
      tournament.matches = flattenStructureMatches(structure);
      tournament.updatedAt = new Date().toISOString();

      const saved = await finishResultsUpdate(tournament, {
        action: "generate-triple-bracket-playoffs",
        status: "playoffs-generated"
      });

      if (saved) {
        alert("Chave Alta, Chave Média, Chave Baixa, Final Intermediária e Grande Final foram geradas.");
      }
    }

    async function generatePlayoffsFromGroups() {
            activePlayoffMatchId = null;
      const tournament = getTournamentById(selectedTournamentId);

      if (!tournament || !tournament.structure || tournament.structure.type !== "groups-playoffs") {
        alert("Selecione um torneio de Grupos + Playoffs.");
        return;
      }

      const structure = tournament.structure;

      if (!isGroupStageFinished(structure)) {
        alert("Finalize todas as partidas da fase de grupos antes de gerar os playoffs.");
        return;
      }

      if (structure.playoffs && structure.playoffs.status === "generated") {
        const confirmRegenerate = confirm("Os playoffs já foram gerados. Gerar novamente vai substituir a chave atual. Continuar?");
        if (!confirmRegenerate) return;
      }

      const qualifiers = getGroupQualifiers(structure);
      const expectedTotal = Number(structure.settings.playoffQualifiedTotal || 0);

      if (qualifiers.length !== expectedTotal) {
        alert(`A quantidade de classificados não fecha. Esperado: ${expectedTotal}. Encontrado: ${qualifiers.length}.`);
        return;
      }

           const tournamentKey = tournament.slug || tournament.id;
      const playoffData = buildPlayoffData(qualifiers, tournamentKey);

      structure.playoffs = {
        status: "generated",
        totalQualified: qualifiers.length,
        format: "single-elimination",
        thirdPlaceMatch: true,
        generatedAt: new Date().toISOString(),
        qualifiers,
        ...playoffData
      };

      tournament.structure = structure;
      tournament.updatedAt = new Date().toISOString();

      const saved = await finishResultsUpdate(tournament, { action: "generate-group-playoffs" });

      if (saved) {
        alert("Playoffs gerados com os classificados dos grupos.");
      }
    }

    function renderPlayoffPlayer(player) {
      if (!player) {
        return `
          <div class="playoff-player empty">
            A definir
          </div>
        `;
      }

      return `
        <div class="playoff-player">
          ${escapeHTML(player.nickname)}
          <span>${escapeHTML(player.seedLabel || "")}</span>
        </div>
      `;
    }

    function renderPlayoffMatchRows(matches) {
      return matches.map((match) => `
        <div class="playoff-match">
          ${renderPlayoffPlayer(match.playerA)}
          <div class="playoff-vs">vs</div>
          ${renderPlayoffPlayer(match.playerB)}
        </div>
      `).join("");
    }

        function createMatchWorkflow() {
      return {
        resultStatus: "none",
        reportedBy: null,
        confirmedBy: [],
        disputedBy: null,
        adminResolved: false,
        resultLocked: false,

        report: {
          scoreA: null,
          scoreB: null,
          winnerId: null,
          createdAt: null,
          updatedAt: null
        },

        supportRequest: {
          status: "none",
          requestedBy: null,
          reason: "",
          createdAt: null,
          resolvedBy: null,
          resolvedAt: null
        },

        matchChat: {
          enabled: true,
          messages: []
        }
      };
    }

    function normalizeMatchWorkflow(match) {
      if (!match.resultWorkflow) {
        match.resultWorkflow = createMatchWorkflow();
      }

      if (!Array.isArray(match.resultWorkflow.confirmedBy)) {
        match.resultWorkflow.confirmedBy = [];
      }

      if (!match.resultWorkflow.report) {
        match.resultWorkflow.report = {
          scoreA: match.scoreA ?? null,
          scoreB: match.scoreB ?? null,
          winnerId: match.winnerId ?? null,
          createdAt: null,
          updatedAt: null
        };
      }

      if (!match.resultWorkflow.supportRequest) {
        match.resultWorkflow.supportRequest = {
          status: "none",
          requestedBy: null,
          reason: "",
          createdAt: null,
          resolvedBy: null,
          resolvedAt: null
        };
      }

      if (!match.resultWorkflow.matchChat) {
        match.resultWorkflow.matchChat = {
          enabled: true,
          messages: []
        };
      }

      return match.resultWorkflow;
    }

    function getCurrentUserId() {
      return String(currentUser.id || currentUser.email || "local-user");
    }

    function getCurrentPlayerId() {
      if (!currentUser.playerId) {
        return null;
      }

      return String(currentUser.playerId);
    }

    function getPlayerId(player) {
      if (!player) {
        return null;
      }

      return String(player.id || player.participantId || player.nickname || player.name || "");
    }

    function getMatchPlayerIds(match) {
      return [
        getPlayerId(match.playerA),
        getPlayerId(match.playerB)
      ].filter(Boolean);
    }

    function isAdminOrOrganizerForTournament(tournament) {
      const permissions = currentUser.permissions || {};

      return Boolean(
        currentUser.role === "admin" ||
        currentUser.role === "organizer" ||
        permissions.canCreateTournament ||
        permissions.canManageTournamentResults
      );
    }

    function isCurrentPlayerInMatch(match) {
      const currentPlayerId = getCurrentPlayerId();

      if (!currentPlayerId) {
        return false;
      }

      return getMatchPlayerIds(match).includes(currentPlayerId);
    }

    function canCurrentUserReportMatch(match, tournament) {
      if (isAdminOrOrganizerForTournament(tournament)) {
        return true;
      }

      return isCurrentPlayerInMatch(match);
    }

    function canCurrentUserConfirmMatch(match, tournament) {
      if (isAdminOrOrganizerForTournament(tournament)) {
        return true;
      }

      return isCurrentPlayerInMatch(match);
    }

    function canCurrentUserResolveMatch(match, tournament) {
      const permissions = currentUser.permissions || {};

      return Boolean(
        isAdminOrOrganizerForTournament(tournament) ||
        permissions.canResolveMatchDisputes
      );
    }

    function canCurrentUserViewMatchChat(match, tournament) {
      const permissions = currentUser.permissions || {};

      return Boolean(
        permissions.canViewAllMatchChats ||
        isAdminOrOrganizerForTournament(tournament) ||
        isCurrentPlayerInMatch(match)
      );
    }

    function canCurrentUserRequestMatchSupport(match, tournament) {
      return Boolean(
        !isAdminOrOrganizerForTournament(tournament) &&
        isCurrentPlayerInMatch(match)
      );
    }

    function getMatchResultStatusLabel(match) {
      const workflow = normalizeMatchWorkflow(match);

      const labels = {
        none: "Sem resultado",
        pending: "Aguardando confirmação",
        confirmed: "Resultado confirmado",
        disputed: "Resultado contestado",
        "admin-resolved": "Resolvido por admin"
      };

      return labels[workflow.resultStatus] || "Sem resultado";
    }

        function isMatchResultApproved(match) {
      if (!match) {
        return false;
      }

      const workflow = normalizeMatchWorkflow(match);

      return Boolean(
        match.status === "completed" ||
        workflow.resultStatus === "confirmed" ||
        workflow.resultStatus === "admin-resolved"
      );
    }

    function getApprovedMatchScore(match, slot) {
      if (!isMatchResultApproved(match)) {
        return "";
      }

      const field = slot === "playerA" ? "scoreA" : "scoreB";
      const workflow = normalizeMatchWorkflow(match);

      if (match[field] !== null && match[field] !== undefined) {
        return match[field];
      }

      if (
        workflow.report &&
        workflow.report[field] !== null &&
        workflow.report[field] !== undefined
      ) {
        return workflow.report[field];
      }

      return "";
    }

    function isMatchSlotWinner(match, slot) {
      if (!isMatchResultApproved(match) || !match.winnerId || !match[slot]) {
        return false;
      }

      return String(match[slot].id) === String(match.winnerId);
    }

    function renderBracketMatchPlayer(match, slot) {
      const player = match ? match[slot] : null;

      if (!player) {
        return renderBracketPlayer(null);
      }

      const score = getApprovedMatchScore(match, slot);
      const winnerClass = isMatchSlotWinner(match, slot) ? "winner" : "";

      return `
        <div class="playoff-bracket-player ${winnerClass}">
          ${
            score !== ""
              ? `<strong class="playoff-bracket-player-score">${escapeHTML(score)}</strong>`
              : ""
          }

          <strong class="playoff-bracket-player-name">
            ${escapeHTML(player.nickname || player.name || "Jogador")}
          </strong>

          <span>
            ${escapeHTML(player.seedLabel || player.team || "")}
          </span>
        </div>
      `;
    }

        function renderBracketPlayer(player) {
      if (!player) {
        return `
          <div class="playoff-bracket-player empty">
            A definir
          </div>
        `;
      }

      return `
        <div class="playoff-bracket-player">
          ${escapeHTML(player.nickname)}
          <span>${escapeHTML(player.seedLabel || "")}</span>
        </div>
      `;
    }

        function getMatchPlayerName(player) {
      if (!player) {
        return "A definir";
      }

      return player.nickname || player.name || player.playerName || "Jogador";
    }

    function getAllPlayoffMatches(playoffs) {
      const matches = [];

      if (!playoffs) {
        return matches;
      }

      if (Array.isArray(playoffs.rounds)) {
        playoffs.rounds.forEach((round) => {
          round.matches.forEach((match) => matches.push(match));
        });
      }

      if (Array.isArray(playoffs.sides)) {
        playoffs.sides.forEach((side) => {
          side.rounds.forEach((round) => {
            round.matches.forEach((match) => matches.push(match));
          });
        });
      }

      if (playoffs.final) {
        matches.push(playoffs.final);
      }

      if (playoffs.thirdPlace) {
        matches.push(playoffs.thirdPlace);
      }

      return matches;
    }

    function findPlayoffMatchById(playoffs, matchId) {
      return getAllPlayoffMatches(playoffs).find((match) => String(match.id) === String(matchId));
    }

    function matchHasAnyPlayer(match) {
      return Boolean(match && (match.playerA || match.playerB));
    }

    function renderMatchWorkflowActions(match) {
      if (!matchHasAnyPlayer(match)) {
        return "";
      }

      return `
        <div class="match-workflow-actions">
          <button type="button" data-action="open-match-workflow" data-match-id="${escapeHTML(match.id)}">
            Gerenciar
          </button>
        </div>
      `;
    }

        function getWorkflowScoreValue(match, field) {
      const workflow = normalizeMatchWorkflow(match);

      if (
        workflow.report &&
        workflow.report[field] !== null &&
        workflow.report[field] !== undefined
      ) {
        return workflow.report[field];
      }

      if (match[field] !== null && match[field] !== undefined) {
        return match[field];
      }

      return "";
    }

    function getMatchWinnerName(match) {
      if (!match || !match.winnerId) {
        return "A definir";
      }

      const winnerId = String(match.winnerId);

      if (match.playerA && String(match.playerA.id) === winnerId) {
        return getMatchPlayerName(match.playerA);
      }

      if (match.playerB && String(match.playerB.id) === winnerId) {
        return getMatchPlayerName(match.playerB);
      }

      return "A definir";
    }

    function renderMatchReportSummary(match) {
      const workflow = normalizeMatchWorkflow(match);
      const hasReport =
        workflow.report &&
        workflow.report.scoreA !== null &&
        workflow.report.scoreB !== null;

      if (!hasReport) {
        return `
          <div class="match-report-summary">
            Nenhum placar registrado para esta partida ainda.
          </div>
        `;
      }

      return `
        <div class="match-report-summary">
          Placar atual:
          <strong>${escapeHTML(getMatchPlayerName(match.playerA))}</strong>
          ${escapeHTML(workflow.report.scoreA)}
          x
          ${escapeHTML(workflow.report.scoreB)}
          <strong>${escapeHTML(getMatchPlayerName(match.playerB))}</strong>
          <br />
          Vencedor: <strong>${escapeHTML(getMatchWinnerName(match))}</strong>
        </div>
      `;
    }

    function renderMatchResultForm(match) {
      return `
        <div class="match-result-form">
          <div class="score-box">
            <label>${escapeHTML(getMatchPlayerName(match.playerA))}</label>
            <input
              type="number"
              min="0"
              class="score-input"
              data-playoff-score-a="${escapeHTML(match.id)}"
              value="${escapeHTML(getWorkflowScoreValue(match, "scoreA"))}"
              placeholder="0"
            />
          </div>

          <div class="match-result-separator">x</div>

          <div class="score-box">
            <label>${escapeHTML(getMatchPlayerName(match.playerB))}</label>
            <input
              type="number"
              min="0"
              class="score-input"
              data-playoff-score-b="${escapeHTML(match.id)}"
              value="${escapeHTML(getWorkflowScoreValue(match, "scoreB"))}"
              placeholder="0"
            />
          </div>
        </div>
      `;
    }

    function getPlayoffScoreInputs(matchId) {
      return {
        scoreAInput: structureOutput.querySelector(`[data-playoff-score-a="${CSS.escape(String(matchId))}"]`),
        scoreBInput: structureOutput.querySelector(`[data-playoff-score-b="${CSS.escape(String(matchId))}"]`)
      };
    }

        function cloneMatchPlayer(player) {
      if (!player) {
        return null;
      }

      return {
        ...player
      };
    }

    function getCompletedMatchWinner(match) {
      if (!match || match.status !== "completed" || !match.winnerId) {
        return null;
      }

      const winnerId = String(match.winnerId);

      if (match.playerA && String(match.playerA.id) === winnerId) {
        return match.playerA;
      }

      if (match.playerB && String(match.playerB.id) === winnerId) {
        return match.playerB;
      }

      return null;
    }

    function getCompletedMatchLoser(match) {
      if (!match || match.status !== "completed" || !match.winnerId) {
        return null;
      }

      const winnerId = String(match.winnerId);

      if (match.playerA && String(match.playerA.id) !== winnerId) {
        return match.playerA;
      }

      if (match.playerB && String(match.playerB.id) !== winnerId) {
        return match.playerB;
      }

      return null;
    }

    function resetMatchResult(match) {
      match.scoreA = null;
      match.scoreB = null;
      match.winnerId = null;
      match.updatedAt = new Date().toISOString();

      if (match.playerA && match.playerB) {
        match.status = "pending";
      } else {
        match.status = "waiting";
      }

      match.resultWorkflow = createMatchWorkflow();
    }

    function setMatchPlayerSlot(match, slot, player) {
      if (!match) {
        return;
      }

      const previousPlayerId = match[slot] ? String(match[slot].id) : null;
      const nextPlayerId = player ? String(player.id) : null;

      match[slot] = cloneMatchPlayer(player);

      if (previousPlayerId !== nextPlayerId) {
        resetMatchResult(match);
      }

      if (match.playerA && match.playerB && match.status === "waiting") {
        match.status = "pending";
      }
    }

    function advanceMatchInsideRounds(rounds, matchId) {
      if (!Array.isArray(rounds)) {
        return {
          found: false
        };
      }

      for (let roundIndex = 0; roundIndex < rounds.length; roundIndex += 1) {
        const round = rounds[roundIndex];
        const matchIndex = round.matches.findIndex((match) => {
          return String(match.id) === String(matchId);
        });

        if (matchIndex === -1) {
          continue;
        }

        const match = round.matches[matchIndex];
        const winner = getCompletedMatchWinner(match);
        const loser = getCompletedMatchLoser(match);
        const isFinalOfRounds = roundIndex === rounds.length - 1;

        if (!winner) {
          return {
            found: true,
            advanced: false,
            match,
            winner: null,
            loser: null,
            roundIndex,
            matchIndex,
            isFinalOfRounds
          };
        }

        if (!isFinalOfRounds) {
          const nextRound = rounds[roundIndex + 1];
          const nextMatch = nextRound.matches[Math.floor(matchIndex / 2)];
          const slot = matchIndex % 2 === 0 ? "playerA" : "playerB";

          setMatchPlayerSlot(nextMatch, slot, winner);
        }

        return {
          found: true,
          advanced: true,
          match,
          winner,
          loser,
          roundIndex,
          matchIndex,
          isFinalOfRounds
        };
      }

      return {
        found: false
      };
    }

    function advanceSinglePlayoffResult(playoffs, matchId) {
      const result = advanceMatchInsideRounds(playoffs.rounds, matchId);

      if (!result.found || !result.advanced) {
        return;
      }

      const semifinalRoundIndex = playoffs.rounds.length - 2;

      if (
        playoffs.thirdPlace &&
        result.roundIndex === semifinalRoundIndex &&
        result.loser
      ) {
        const slot = result.matchIndex % 2 === 0 ? "playerA" : "playerB";
        setMatchPlayerSlot(playoffs.thirdPlace, slot, result.loser);
      }
    }

    function advanceSplitSidePlayoffResult(playoffs, matchId) {
      if (!Array.isArray(playoffs.sides)) {
        return;
      }

      for (const side of playoffs.sides) {
        const result = advanceMatchInsideRounds(side.rounds, matchId);

        if (!result.found || !result.advanced) {
          continue;
        }

        if (result.isFinalOfRounds) {
          const isSideA = side.id === "A";
          const finalSlot = isSideA ? "playerA" : "playerB";
          const thirdPlaceSlot = isSideA ? "playerA" : "playerB";

          if (playoffs.final && result.winner) {
            setMatchPlayerSlot(playoffs.final, finalSlot, result.winner);
          }

          if (playoffs.thirdPlace && result.loser) {
            setMatchPlayerSlot(playoffs.thirdPlace, thirdPlaceSlot, result.loser);
          }
        }

        return;
      }
    }

    function advancePlayoffResult(tournament, matchId) {
      if (!tournament || !tournament.structure || !tournament.structure.playoffs) {
        return;
      }

      const playoffs = tournament.structure.playoffs;

      if (playoffs.mode === "split-sides") {
        advanceSplitSidePlayoffResult(playoffs, matchId);
        return;
      }

      advanceSinglePlayoffResult(playoffs, matchId);
    }

    async function savePlayoffResult(matchId) {
      const tournament = getSelectedTournament();

      if (!tournament || !tournament.structure || !tournament.structure.playoffs) {
        alert("Nenhum playoff encontrado para salvar resultado.");
        return;
      }

      const playoffs = tournament.structure.playoffs;
      const match = findPlayoffMatchById(playoffs, matchId);

      if (!match) {
        alert("Partida não encontrada.");
        return;
      }

      if (!match.playerA || !match.playerB) {
        alert("Esta partida ainda não possui os dois jogadores definidos.");
        return;
      }

      if (!canCurrentUserReportMatch(match, tournament)) {
        alert("Você não tem permissão para registrar resultado nesta partida.");
        return;
      }

      const { scoreAInput, scoreBInput } = getPlayoffScoreInputs(match.id);

      if (!scoreAInput || !scoreBInput) {
        alert("Campos de placar não encontrados.");
        return;
      }

      const parsed = parseScoreInputs(scoreAInput, scoreBInput, match, tournament);

      if (!parsed.valid) {
        alert(parsed.message);
        return;
      }

      const workflow = normalizeMatchWorkflow(match);
      const now = new Date().toISOString();
      const winnerId = parsed.scoreA > parsed.scoreB ? match.playerA.id : match.playerB.id;
      const isAdmin = isAdminOrOrganizerForTournament(tournament);

      workflow.report = {
        scoreA: parsed.scoreA,
        scoreB: parsed.scoreB,
        winnerId,
        createdAt: workflow.report && workflow.report.createdAt ? workflow.report.createdAt : now,
        updatedAt: now
      };

      workflow.reportedBy = getCurrentUserId();
      workflow.disputedBy = null;

      match.scoreA = parsed.scoreA;
      match.scoreB = parsed.scoreB;
      match.winnerId = winnerId;
      match.updatedAt = now;

      if (isAdmin) {
        workflow.resultStatus = "confirmed";
        workflow.confirmedBy = [getCurrentUserId()];
        workflow.adminResolved = true;
        workflow.resultLocked = true;

        match.status = "completed";

        advancePlayoffResult(tournament, match.id);
      } else {
        workflow.resultStatus = "pending";
        workflow.confirmedBy = [getCurrentUserId()];
        workflow.adminResolved = false;
        workflow.resultLocked = false;

        match.status = "pending-confirmation";
      }

      tournament.updatedAt = now;
      const saved = await finishResultsUpdate(tournament, { action: "save-playoff-result" });

      if (saved) {
        alert(isAdmin
          ? "Resultado registrado e validado pelo administrador."
          : "Resultado registrado. Aguardando confirmação do adversário."
        );
      }
    }

    async function confirmPlayoffResult(matchId) {
      const tournament = getSelectedTournament();

      if (!tournament || !tournament.structure || !tournament.structure.playoffs) {
        alert("Nenhum playoff encontrado.");
        return;
      }

      const match = findPlayoffMatchById(tournament.structure.playoffs, matchId);

      if (!match) {
        alert("Partida não encontrada.");
        return;
      }

      if (!canCurrentUserConfirmMatch(match, tournament)) {
        alert("Você não tem permissão para confirmar esta partida.");
        return;
      }

      const workflow = normalizeMatchWorkflow(match);
      const hasReport =
        workflow.report &&
        workflow.report.scoreA !== null &&
        workflow.report.scoreB !== null;

      if (!hasReport) {
        alert("Ainda não existe resultado registrado para confirmar.");
        return;
      }

      const now = new Date().toISOString();
      const isAdmin = isAdminOrOrganizerForTournament(tournament);
      const currentId = getCurrentUserId();

      if (!workflow.confirmedBy.includes(currentId)) {
        workflow.confirmedBy.push(currentId);
      }

      if (isAdmin) {
        workflow.resultStatus = "confirmed";
        workflow.adminResolved = true;
        workflow.resultLocked = true;

        match.scoreA = workflow.report.scoreA;
        match.scoreB = workflow.report.scoreB;
        match.winnerId = workflow.report.winnerId;
        match.status = "completed";
        match.updatedAt = now;

        advancePlayoffResult(tournament, match.id);

        tournament.updatedAt = now;
        const saved = await finishResultsUpdate(tournament, { action: "confirm-playoff-result-admin" });

        if (saved) {
          alert("Resultado validado pelo administrador.");
        }
        return;
      }

      const playerIds = getMatchPlayerIds(match);
      const allPlayersConfirmed = playerIds.every((playerId) => {
        return workflow.confirmedBy.includes(playerId);
      });

      if (allPlayersConfirmed) {
        workflow.resultStatus = "confirmed";
        workflow.resultLocked = true;

        match.scoreA = workflow.report.scoreA;
        match.scoreB = workflow.report.scoreB;
        match.winnerId = workflow.report.winnerId;
        match.status = "completed";
        match.updatedAt = now;

        advancePlayoffResult(tournament, match.id);
      } else {
        workflow.resultStatus = "pending";
        match.status = "pending-confirmation";
        match.updatedAt = now;
      }

      tournament.updatedAt = now;
      const saved = await finishResultsUpdate(tournament, { action: "confirm-playoff-result" });

      if (saved) {
        alert(allPlayersConfirmed
          ? "Resultado confirmado pelos dois jogadores."
          : "Sua confirmação foi registrada. Ainda falta a confirmação do adversário."
        );
      }
    }

    async function disputePlayoffResult(matchId) {
      const tournament = getSelectedTournament();

      if (!tournament || !tournament.structure || !tournament.structure.playoffs) {
        alert("Nenhum playoff encontrado.");
        return;
      }

      const match = findPlayoffMatchById(tournament.structure.playoffs, matchId);

      if (!match) {
        alert("Partida não encontrada.");
        return;
      }

      if (!canCurrentUserResolveMatch(match, tournament) && !isCurrentPlayerInMatch(match)) {
        alert("Você não tem permissão para contestar ou resolver esta partida.");
        return;
      }

      const workflow = normalizeMatchWorkflow(match);

      workflow.resultStatus = "disputed";
      workflow.disputedBy = getCurrentUserId();
      workflow.resultLocked = false;

      match.status = "disputed";
      match.updatedAt = new Date().toISOString();

      tournament.updatedAt = new Date().toISOString();
      const saved = await finishResultsUpdate(tournament, { action: "dispute-playoff-result" });

      if (saved) {
        alert("Partida marcada como resultado contestado.");
      }
    }

        function getCurrentUserDisplayName() {
      return currentUser.name || currentUser.nickname || currentUser.id || "Usuário";
    }

    function formatChatTimestamp(value) {
      if (!value) {
        return "";
      }

      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        return "";
      }

      return date.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
    }

    function getMatchChatMessages(match) {
      const workflow = normalizeMatchWorkflow(match);

      if (!workflow.matchChat) {
        workflow.matchChat = {
          enabled: true,
          messages: []
        };
      }

      if (!Array.isArray(workflow.matchChat.messages)) {
        workflow.matchChat.messages = [];
      }

      return workflow.matchChat.messages;
    }

    function renderMatchChatMessage(message) {
      const currentUserId = getCurrentUserId();
      const isOwn = String(message.authorId) === String(currentUserId);
      const isAdminMessage = message.authorRole === "admin" || message.authorRole === "organizer";

      const classes = [
        "match-chat-message",
        isOwn ? "own" : "",
        isAdminMessage ? "admin" : ""
      ].join(" ");

      return `
        <div class="${classes}">
          <div class="match-chat-meta">
            <strong>${escapeHTML(message.authorName || "Usuário")}</strong>
            <span>${escapeHTML(formatChatTimestamp(message.createdAt))}</span>
          </div>

          <div class="match-chat-body">
            ${escapeHTML(message.body || "")}
          </div>
        </div>
      `;
    }

        function getSupportRequest(match) {
      const workflow = normalizeMatchWorkflow(match);

      if (!workflow.supportRequest) {
        workflow.supportRequest = {
          status: "none",
          requestedBy: null,
          reason: "",
          createdAt: null,
          resolvedBy: null,
          resolvedAt: null
        };
      }

      return workflow.supportRequest;
    }

    function getSupportStatusLabel(status) {
      const labels = {
        none: "Sem chamado",
        open: "Ajuda solicitada",
        "in-review": "Em análise pelo admin",
        resolved: "Chamado resolvido"
      };

      return labels[status] || "Sem chamado";
    }

    function hasActiveSupportRequest(match) {
      const support = getSupportRequest(match);
      return support.status === "open" || support.status === "in-review";
    }

    function renderMatchSupportBadge(match) {
      const support = getSupportRequest(match);

      if (support.status === "none") {
        return "";
      }

      const resolvedClass = support.status === "resolved" ? "resolved" : "";

      return `
        <div class="match-support-badge ${resolvedClass}">
          ${escapeHTML(getSupportStatusLabel(support.status))}
        </div>
      `;
    }

    function getAllSupportRequests(playoffs) {
      return getAllPlayoffMatches(playoffs)
        .filter((match) => {
          const support = getSupportRequest(match);
          return support.status === "open" || support.status === "in-review";
        })
        .map((match) => {
          const support = getSupportRequest(match);

          return {
            match,
            support
          };
        });
    }

    function renderSupportOverview(playoffs) {
      const tournament = getSelectedTournament();

      if (!tournament || !isAdminOrOrganizerForTournament(tournament)) {
        return "";
      }

      const requests = getAllSupportRequests(playoffs);

      if (requests.length === 0) {
        return "";
      }

      return `
        <div class="support-overview">
          <h5>Chamados abertos nas partidas</h5>

          <div class="support-list">
            ${requests.map(({ match, support }) => `
              <div class="support-item">
                <div>
                  <strong>
                    ${escapeHTML(getMatchPlayerName(match.playerA))}
                    x
                    ${escapeHTML(getMatchPlayerName(match.playerB))}
                  </strong>

                  <span>
                    ${escapeHTML(getSupportStatusLabel(support.status))}
                    ${support.reason ? ` — ${escapeHTML(support.reason)}` : ""}
                  </span>
                </div>

                <button
                  type="button"
                  class="btn-secondary btn-small"
                  data-action="open-match-workflow"
                  data-match-id="${escapeHTML(match.id)}"
                >
                  Abrir partida
                </button>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    }

    function renderMatchSupportPanel(match) {
      const tournament = getSelectedTournament();
      const support = getSupportRequest(match);

      if (support.status === "none") {
        return "";
      }

      const isAdmin = tournament ? isAdminOrOrganizerForTournament(tournament) : false;

      return `
        <div class="match-support-panel">
          <strong>${escapeHTML(getSupportStatusLabel(support.status))}</strong>

          <p>
            Motivo:
            <span class="support-reason">
              ${escapeHTML(support.reason || "Nenhum motivo informado.")}
            </span>
          </p>

          ${
            isAdmin && support.status !== "resolved"
              ? `
                <div class="match-detail-actions">
                  <button
                    type="button"
                    class="match-detail-warning"
                    data-action="review-match-support"
                    data-match-id="${escapeHTML(match.id)}"
                  >
                    Marcar em análise
                  </button>

                  <button
                    type="button"
                    class="match-detail-primary"
                    data-action="resolve-match-support"
                    data-match-id="${escapeHTML(match.id)}"
                  >
                    Resolver chamado
                  </button>

                  <button
                    type="button"
                    class="match-detail-secondary"
                    data-action="open-match-chat"
                    data-match-id="${escapeHTML(match.id)}"
                  >
                    Ver chat
                  </button>
                </div>
              `
              : ""
          }
        </div>
      `;
    }

    function addSystemChatMessage(match, body) {
      const messages = getMatchChatMessages(match);

      messages.push({
        id: `system-${Date.now()}`,
        authorId: "system",
        authorName: "Sistema SaberWolf",
        authorRole: "system",
        body,
        createdAt: new Date().toISOString()
      });
    }

    function requestMatchSupport(matchId) {
      const tournament = getSelectedTournament();

      if (!tournament || !tournament.structure || !tournament.structure.playoffs) {
        alert("Nenhuma partida de playoff encontrada.");
        return;
      }

      const match = findPlayoffMatchById(tournament.structure.playoffs, matchId);

      if (!match) {
        alert("Partida não encontrada.");
        return;
      }

      if (!canCurrentUserRequestMatchSupport(match, tournament)) {
        alert("Somente jogadores participantes da partida podem pedir ajuda.");
        return;
      }

      const reason = prompt("Explique rapidamente o problema da partida:");

      if (reason === null) {
        return;
      }

      const support = getSupportRequest(match);
      const now = new Date().toISOString();

      support.status = "open";
      support.requestedBy = getCurrentUserId();
      support.reason = reason.trim() || "Jogador solicitou ajuda sem informar motivo.";
      support.createdAt = now;
      support.resolvedBy = null;
      support.resolvedAt = null;

      addSystemChatMessage(
        match,
        `Pedido de ajuda aberto por ${getCurrentUserDisplayName()}: ${support.reason}`
      );

      match.updatedAt = now;
      tournament.updatedAt = now;

      updateTournament(tournament);
      refreshSelectedTournamentView();

      alert("Pedido de ajuda enviado para a administração.");
    }

    function reviewMatchSupport(matchId) {
      const tournament = getSelectedTournament();

      if (!tournament || !tournament.structure || !tournament.structure.playoffs) {
        alert("Nenhuma partida de playoff encontrada.");
        return;
      }

      const match = findPlayoffMatchById(tournament.structure.playoffs, matchId);

      if (!match) {
        alert("Partida não encontrada.");
        return;
      }

      if (!isAdminOrOrganizerForTournament(tournament)) {
        alert("Somente administradores/organizadores podem analisar chamados.");
        return;
      }

      const support = getSupportRequest(match);

      if (support.status === "none") {
        alert("Esta partida não possui chamado aberto.");
        return;
      }

      support.status = "in-review";

      addSystemChatMessage(
        match,
        `${getCurrentUserDisplayName()} marcou o chamado como em análise.`
      );

      match.updatedAt = new Date().toISOString();
      tournament.updatedAt = new Date().toISOString();

      updateTournament(tournament);
      refreshSelectedTournamentView();
    }

    function resolveMatchSupport(matchId) {
      const tournament = getSelectedTournament();

      if (!tournament || !tournament.structure || !tournament.structure.playoffs) {
        alert("Nenhuma partida de playoff encontrada.");
        return;
      }

      const match = findPlayoffMatchById(tournament.structure.playoffs, matchId);

      if (!match) {
        alert("Partida não encontrada.");
        return;
      }

      if (!isAdminOrOrganizerForTournament(tournament)) {
        alert("Somente administradores/organizadores podem resolver chamados.");
        return;
      }

      const support = getSupportRequest(match);
      const now = new Date().toISOString();

      if (support.status === "none") {
        alert("Esta partida não possui chamado aberto.");
        return;
      }

      support.status = "resolved";
      support.resolvedBy = getCurrentUserId();
      support.resolvedAt = now;

      addSystemChatMessage(
        match,
        `${getCurrentUserDisplayName()} resolveu o chamado desta partida.`
      );

      match.updatedAt = now;
      tournament.updatedAt = now;

      updateTournament(tournament);
      refreshSelectedTournamentView();

      alert("Chamado resolvido.");
    }

    function renderMatchChatPanel(match) {
      const tournament = getSelectedTournament();

      if (!tournament || !canCurrentUserViewMatchChat(match, tournament)) {
        return `
          <div class="match-chat-panel">
            <div class="match-chat-empty">
              Você não tem permissão para visualizar o chat desta partida.
            </div>
          </div>
        `;
      }

      const messages = getMatchChatMessages(match);

      return `
        <div class="match-chat-panel">
          <div class="match-chat-header">
            <strong>Chat da partida</strong>
            <span>${messages.length} mensagem(ns)</span>
          </div>

          <div class="match-chat-messages">
            ${
              messages.length > 0
                ? messages.map(renderMatchChatMessage).join("")
                : `
                  <div class="match-chat-empty">
                    Nenhuma mensagem ainda. Use este chat para combinar a partida, avisar problemas ou registrar informações úteis para o admin.
                  </div>
                `
            }
          </div>

          <div class="match-chat-composer">
            <textarea
              data-match-chat-input="${escapeHTML(match.id)}"
              placeholder="Digite uma mensagem para o chat desta partida..."
            ></textarea>

            <div class="match-chat-actions">
              <button
                type="button"
                class="match-detail-primary"
                data-action="send-match-chat"
                data-match-id="${escapeHTML(match.id)}"
              >
                Enviar mensagem
              </button>

              <button
                type="button"
                class="match-detail-secondary"
                data-action="close-match-chat"
                data-match-id="${escapeHTML(match.id)}"
              >
                Fechar chat
              </button>
            </div>
          </div>
        </div>
      `;
    }

    function getMatchChatInput(matchId) {
      return structureOutput.querySelector(
        `[data-match-chat-input="${CSS.escape(String(matchId))}"]`
      );
    }

    function sendMatchChatMessage(matchId) {
      const tournament = getSelectedTournament();

      if (!tournament || !tournament.structure || !tournament.structure.playoffs) {
        alert("Nenhuma partida de playoff encontrada.");
        return;
      }

      const match = findPlayoffMatchById(tournament.structure.playoffs, matchId);

      if (!match) {
        alert("Partida não encontrada.");
        return;
      }

      if (!canCurrentUserViewMatchChat(match, tournament)) {
        alert("Você não tem permissão para enviar mensagem neste chat.");
        return;
      }

      const input = getMatchChatInput(match.id);

      if (!input) {
        alert("Campo de mensagem não encontrado.");
        return;
      }

      const body = input.value.trim();

      if (!body) {
        alert("Digite uma mensagem antes de enviar.");
        return;
      }

      const messages = getMatchChatMessages(match);

      messages.push({
        id: `chat-${Date.now()}`,
        authorId: getCurrentUserId(),
        authorName: getCurrentUserDisplayName(),
        authorRole: currentUser.role || "user",
        body,
        createdAt: new Date().toISOString()
      });

      match.updatedAt = new Date().toISOString();
      tournament.updatedAt = new Date().toISOString();

      updateTournament(tournament);
      refreshSelectedTournamentView();

      setTimeout(() => {
        const panel = document.querySelector(".match-chat-panel");

        if (panel) {
          panel.scrollIntoView({
            behavior: "smooth",
            block: "center"
          });
        }
      }, 0);
    }

          function renderActivePlayoffMatchPanel(playoffs) {
      if (!activePlayoffMatchId) {
        return "";
      }

      const match = findPlayoffMatchById(playoffs, activePlayoffMatchId);

      if (!match) {
        return "";
      }

      const tournament = getSelectedTournament();
      const isAdmin = tournament ? isAdminOrOrganizerForTournament(tournament) : false;
      const isParticipant = isCurrentPlayerInMatch(match);
      normalizeMatchWorkflow(match);

      const playerActions = isParticipant && !isAdmin
        ? `
          <button type="button" class="match-detail-primary" data-action="report-playoff-result" data-match-id="${escapeHTML(match.id)}">
            Registrar resultado
          </button>

          <button type="button" class="match-detail-secondary" data-action="confirm-playoff-result" data-match-id="${escapeHTML(match.id)}">
            Confirmar resultado
          </button>

          <button type="button" class="match-detail-danger" data-action="dispute-playoff-result" data-match-id="${escapeHTML(match.id)}">
            Contestar
          </button>

          <button type="button" class="match-detail-warning" data-action="request-match-support" data-match-id="${escapeHTML(match.id)}">
            Pedir ajuda
          </button>

          <button type="button" class="match-detail-secondary" data-action="open-match-chat" data-match-id="${escapeHTML(match.id)}">
            Chat da partida
          </button>
        `
        : "";

      const adminActions = isAdmin
        ? `
          <button type="button" class="match-detail-primary" data-action="report-playoff-result" data-match-id="${escapeHTML(match.id)}">
            Registrar/editar resultado
          </button>

          <button type="button" class="match-detail-secondary" data-action="confirm-playoff-result" data-match-id="${escapeHTML(match.id)}">
            Validar resultado
          </button>

          <button type="button" class="match-detail-danger" data-action="dispute-playoff-result" data-match-id="${escapeHTML(match.id)}">
            Resolver conflito
          </button>

          <button type="button" class="match-detail-secondary" data-action="open-match-chat" data-match-id="${escapeHTML(match.id)}">
            Ver chat da partida
          </button>
        `
        : "";

      const noActions = !isAdmin && !isParticipant
        ? `
          <p style="margin: 0; color: var(--muted); font-size: 0.78rem;">
            Você não tem permissão para gerenciar esta partida.
          </p>
        `
        : "";

      return `
        <div class="match-detail-panel">
          <div class="match-detail-header">
            <div>
              <h5>Gerenciar partida</h5>
              <p>
                Status: ${escapeHTML(getMatchResultStatusLabel(match))}
              </p>
            </div>

            <button type="button" class="match-detail-close" data-action="close-match-workflow">
              Fechar
            </button>
          </div>

          <div class="match-detail-grid">
            <div class="match-detail-player">
              <strong>${escapeHTML(getMatchPlayerName(match.playerA))}</strong>
              <span>Jogador A</span>
            </div>

            <div class="match-detail-player">
              <strong>${escapeHTML(getMatchPlayerName(match.playerB))}</strong>
              <span>Jogador B</span>
            </div>
          </div>

          ${renderMatchReportSummary(match)}

          ${renderMatchSupportPanel(match)}

          ${renderMatchResultForm(match)}

          <div class="match-detail-actions">
            ${playerActions}
            ${adminActions}
            ${noActions}
          </div>

          ${
            String(activeMatchChatId) === String(match.id)
              ? renderMatchChatPanel(match)
              : ""
          }
        </div>
      `;
    }

        function refreshSelectedTournamentView() {
      const tournament = getSelectedTournament();

      if (!tournament) {
        return;
      }

      renderTournamentManager();
      renderStructurePreview(tournament);
      previewOutput.textContent = JSON.stringify(tournament, null, 2);
    }

        function renderBracketMatch(match, options = {}) {
      normalizeMatchWorkflow(match);

      const classes = [
        "playoff-bracket-match",
        options.isFirstRound ? "is-first-round" : "",
        options.isLastRound ? "is-last-round" : "",
        options.matchIndex % 2 === 0 ? "is-pair-top" : "is-pair-bottom"
      ].join(" ");

      const gridStyle = options.gridRow
        ? `style="grid-row: ${options.gridRow}; --connector-height: ${options.connectorHeight}px;"`
        : "";

      return `
        <div class="${classes}" ${gridStyle}>
          <span class="bracket-connector bracket-connector-in"></span>
          <span class="bracket-connector bracket-connector-out"></span>
          <span class="bracket-connector bracket-connector-vertical"></span>

          ${renderBracketMatchPlayer(match, "playerA")}
          <div class="playoff-bracket-vs">vs</div>
          ${renderBracketMatchPlayer(match, "playerB")}

          <div class="match-workflow-status">
            ${escapeHTML(getMatchResultStatusLabel(match))}
          </div>

          ${renderMatchSupportBadge(match)}

          ${renderMatchWorkflowActions(match)}
        </div>
      `;
    }

           function renderPlayoffBracket(playoffs) {
      const baseMatchCount = playoffs.rounds[0] ? playoffs.rounds[0].matches.length : 1;
      const slotHeight = 178;

      return `
        <div class="playoff-bracket-wrapper">
          <div class="playoff-bracket">
            ${playoffs.rounds.map((round, roundIndex) => {
              const span = Math.pow(2, roundIndex);
              const isFirstRound = roundIndex === 0;
              const isLastRound = roundIndex === playoffs.rounds.length - 1;
              const connectorHeight = slotHeight * span;

              return `
                <div class="playoff-bracket-round">
                  <div class="playoff-bracket-round-title">
                    ${escapeHTML(round.name)}
                  </div>

                  <div
                    class="playoff-bracket-grid"
                    style="
                      --base-match-count: ${baseMatchCount};
                      --bracket-slot-height: ${slotHeight}px;
                    "
                  >
                    ${round.matches.map((match, matchIndex) => {
                      const startRow = matchIndex * span + 1;
                      const gridRow = `${startRow} / span ${span}`;

                      return renderBracketMatch(match, {
                        matchIndex,
                        isFirstRound,
                        isLastRound,
                        gridRow,
                        connectorHeight
                      });
                    }).join("")}
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `;
    }

        function renderStandalonePlayoffMatch(match) {
      if (!match) {
        return "";
      }

      normalizeMatchWorkflow(match);

      return `
        <div class="playoff-bracket-match is-last-round">
          ${renderBracketMatchPlayer(match, "playerA")}
          <div class="playoff-bracket-vs">vs</div>
          ${renderBracketMatchPlayer(match, "playerB")}

          <div class="match-workflow-status">
            ${escapeHTML(getMatchResultStatusLabel(match))}
          </div>

          ${renderMatchSupportBadge(match)}

          ${renderMatchWorkflowActions(match)}
        </div>
      `;
    }

    function renderSplitPlayoffBracket(playoffs) {
      return `
        <div class="playoff-sides-grid">
          ${playoffs.sides.map((side) => `
            <div class="playoff-side-block">
              <div class="playoff-side-title">
                ${escapeHTML(side.label)} — ${side.totalPlayers} jogadores
              </div>

              ${renderPlayoffBracket({ rounds: side.rounds })}
            </div>
          `).join("")}
        </div>

        <div class="playoff-finals-area">
          <div class="playoff-final-card">
            <div class="playoff-bracket-round-title">
              ${escapeHTML(playoffs.final.name)}
            </div>

            ${renderStandalonePlayoffMatch(playoffs.final)}
          </div>

          <div class="playoff-final-card">
            <div class="playoff-bracket-round-title">
              ${escapeHTML(playoffs.thirdPlace.name)}
            </div>

            ${renderStandalonePlayoffMatch(playoffs.thirdPlace)}
          </div>
        </div>
      `;
    }

         function renderPlayoffsPanel(structure) {
      const playoffs = structure.playoffs || {
        status: "waiting-group-results"
      };

      const groupStageFinished = isGroupStageFinished(structure);

      if (playoffs.status !== "generated") {
        return `
          <div class="playoff-panel">
            <h5>Playoffs</h5>
            <p>
              Os playoffs serão gerados automaticamente usando as posições classificadas de cada grupo.
              ${
                groupStageFinished
                  ? "A fase de grupos está finalizada. Você já pode gerar a chave."
                  : "Finalize todas as partidas dos grupos para liberar a geração da chave."
              }
            </p>

            <button type="button" data-action="generate-group-playoffs">
              Gerar bracket com classificados
            </button>
          </div>
        `;
      }

      const playoffVisual = playoffs.mode === "split-sides"
        ? renderSplitPlayoffBracket(playoffs)
        : `
          ${renderPlayoffBracket(playoffs)}

          <div class="playoff-third-place">
            <div class="playoff-bracket-round-title">
              ${escapeHTML(playoffs.thirdPlace.name)}
            </div>

            ${renderStandalonePlayoffMatch(playoffs.thirdPlace)}
          </div>
        `;

      return `
        <div class="playoff-panel">
          <h5>Playoffs gerados</h5>
          <p>
            ${playoffs.totalQualified} classificados enviados para a fase final.
            ${playoffs.mode === "split-sides"
              ? "Modelo dividido em Chave A e Chave B, com Final Geral e disputa de terceiro lugar."
              : "Modelo em bracket única, com disputa de terceiro lugar."}
          </p>

          <button type="button" class="btn-secondary btn-small" data-action="generate-group-playoffs">
            Regerar bracket
          </button>

          ${renderSupportOverview(playoffs)}

          ${playoffVisual}

          ${renderActivePlayoffMatchPanel(playoffs)}
        </div>
      `;
    }

        function renderGroupsStructure(structure) {
      const playoffFormatLabel = structure.settings.playoffFormat === "single-elimination"
        ? "Eliminação simples"
        : "Double Elimination futuro";

      return `
        <div class="structure-card">
          <h4>${escapeHTML(structure.label)}</h4>
          <p class="manager-meta">
            ${structure.playersUsed} participantes em ${structure.settings.groupCount} grupos.
            Classificam ${structure.settings.advancePerGroup} por grupo, totalizando ${structure.settings.playoffQualifiedTotal} classificados.
            Playoffs: ${playoffFormatLabel}.
            Terceiro lugar: ${structure.settings.thirdPlaceMatch ? "Sim" : "Não"}.
          </p>

          ${renderBulkResultActions("Na fase de grupos, os resultados atualizam a tabela de cada grupo separadamente.")}

          ${renderPlayoffsPanel(structure)}
        </div>

        <div class="structure-grid">
          ${structure.groups.map((group) => `
            <div class="structure-card">
              <h4>${escapeHTML(group.name)}</h4>
              <p class="manager-meta">
                Jogadores: ${group.players.map((player) => escapeHTML(player.nickname)).join(", ")}
              </p>

              ${renderStandingsTable(group.standings, structure.settings.advancePerGroup)}

              <div class="match-list">
                ${group.rounds.map((round) => `
                  <div class="match-round-title">${escapeHTML(round.name)}</div>
                  ${renderEditableMatchRows(round.matches)}
                `).join("")}
              </div>
            </div>
          `).join("")}
        </div>
      `;
    }

function renderDoubleEliminationStructure(structure) {
  const winnersRounds = Array.isArray(structure.winnersBracket)
    ? structure.winnersBracket
    : [];

  const losersRounds = Array.isArray(structure.losersBracket)
    ? structure.losersBracket
    : [];

  const grandFinalRounds = Array.isArray(structure.grandFinal?.rounds)
    ? structure.grandFinal.rounds
    : [];

  return `
    <div class="structure-card double-results-summary-card">
      <h4>${escapeHTML(structure.label)}</h4>

      <p class="manager-meta">
        ${structure.playersUsed} participantes em ${structure.settings.targetSlots} slots.
        Esta versão já gera Winners Bracket, Lower Bracket e Grand Final com progressão real de vencedores e perdedores.
      </p>

      ${renderBulkResultActions("No Double Elimination, salve os resultados com atenção: vencedores avançam, derrotados podem cair para a Lower e editar uma partida já lançada pode recalcular progressões dependentes.")}
    </div>

    <div class="structure-grid double-results-grid">
      ${
        winnersRounds.length > 0
          ? winnersRounds.map((round) => `
            <div class="structure-card double-results-round winners">
              <h4>${escapeHTML(round.name)}</h4>
              <p class="manager-meta">Winners Bracket · ${escapeHTML((round.matches || []).length)} partida(s)</p>

              <div class="match-list">
                ${renderEditableMatchRows(round.matches || [])}
              </div>
            </div>
          `).join("")
          : `
            <div class="structure-card">
              <h4>Winners Bracket</h4>
              <p class="manager-meta">
                Nenhuma partida gerada ainda.
              </p>
            </div>
          `
      }

      ${
        losersRounds.length > 0
          ? losersRounds.map((round) => `
            <div class="structure-card double-results-round lower">
              <h4>${escapeHTML(round.name)}</h4>
              <p class="manager-meta">Lower Bracket · ${escapeHTML((round.matches || []).length)} partida(s)</p>

              <div class="match-list">
                ${renderEditableMatchRows(round.matches || [])}
              </div>
            </div>
          `).join("")
          : `
            <div class="structure-card">
              <h4>Lower Bracket</h4>
              <p class="manager-meta">
                A Lower Bracket será exibida quando a estrutura Double Elimination for gerada.
              </p>
            </div>
          `
      }

      ${
        grandFinalRounds.length > 0
          ? grandFinalRounds.map((round) => `
            <div class="structure-card double-results-round grand-final">
              <h4>${escapeHTML(round.name)}</h4>
              <p class="manager-meta">Grand Final${structure.grandFinal?.resetIfNeeded ? " · Reset se necessário ativo" : ""}</p>

              <div class="match-list">
                ${renderEditableMatchRows(round.matches || [])}
              </div>
            </div>
          `).join("")
          : ""
      }
    </div>
  `;
}

    function renderStructurePreview(tournament) {
      const structure = tournament ? tournament.structure : null;

      if (!structure) {
        structureOutput.innerHTML = `
          <div class="structure-empty">
            Nenhuma estrutura gerada ainda. Cadastre participantes, confirme o check-in quando necessário e clique em “Gerar estrutura do torneio”.
          </div>
        `;
        return;
      }

      const finalizationPanel = renderTournamentFinalizationPanel(tournament);
      const resultsSafetyPanel = renderResultsSafetyPanel(tournament);
      const realTestChecklistPanel = renderRealTestChecklistPanel(tournament);


      if (structure.type === "triple-bracket") {
        structureOutput.innerHTML = finalizationPanel + resultsSafetyPanel + realTestChecklistPanel + renderTripleBracketStructure(structure);
        return;
      }

      if (structure.type === "league") {
        structureOutput.innerHTML = finalizationPanel + resultsSafetyPanel + realTestChecklistPanel + renderLeagueStructure(structure);
        return;
      }

      if (structure.type === "groups-playoffs") {
        structureOutput.innerHTML = finalizationPanel + resultsSafetyPanel + realTestChecklistPanel + renderGroupsStructure(structure);
        return;
      }

      if (structure.type === "double-elimination") {
        structureOutput.innerHTML = finalizationPanel + resultsSafetyPanel + realTestChecklistPanel + renderDoubleEliminationStructure(structure);
        return;
      }

      structureOutput.innerHTML = `<div class="structure-empty">Formato ainda sem renderização visual.</div>`;
    }

    async function loadSupabaseParticipantsIntoTournament(tournament) {
      if (!isSupabaseTournament(tournament) || typeof sbwGetSupabaseTournamentParticipants !== "function") {
        return tournament;
      }

      participantCounter.textContent = "Carregando inscrições reais do Supabase...";
      participantList.innerHTML = `
        <div class="saved-item">
          <span>Buscando inscritos reais...</span>
        </div>
      `;

      const participants = await sbwGetSupabaseTournamentParticipants(tournament);

      tournament.participants = participants.map(normalizeAdminParticipant);
      tournament.currentParticipants = tournament.participants.length;
      tournament.participantsCount = tournament.participants.length;

      updateTournament(tournament);

      return tournament;
    }

    async function refreshSupabaseTournamentParticipants(tournament) {
      if (!isSupabaseTournament(tournament)) {
        return tournament;
      }

      const refreshedTournament = await loadSupabaseParticipantsIntoTournament(tournament);
      renderTournamentManager();
      renderStructurePreview(refreshedTournament);
      previewOutput.textContent = JSON.stringify(refreshedTournament, null, 2);
      await renderSavedTournaments();
      return refreshedTournament;
    }

    async function openTournamentManager(tournamentId) {
      selectedTournamentId = tournamentId;

      let tournament = getTournamentById(selectedTournamentId);

      if (!tournament) {
        alert("Torneio não encontrado.");
        selectedTournamentId = null;
        return;
      }

      managerArea.classList.remove("hidden");
      renderTournamentManager();
      tournament = await loadSupabaseParticipantsIntoTournament(tournament);
      renderTournamentManager();
      renderStructurePreview(tournament);
      previewOutput.textContent = JSON.stringify(tournament, null, 2);

      managerArea.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }

    function renderTournamentManager() {
      const tournament = getTournamentById(selectedTournamentId);

      if (!tournament) {
        managerArea.classList.add("hidden");
        selectedTournamentId = null;
        return;
      }

      if (!tournament.participants) {
        tournament.participants = [];
      }

      const isRealTournament = isSupabaseTournament(tournament);
      const participants = tournament.participants.map(normalizeAdminParticipant);
      const checkedParticipants = participants.filter((participant) => participant.checkin).length;
      const maxPlayers = getTournamentMaxPlayers(tournament);

      participantForm.classList.toggle("hidden", isRealTournament);
      generateStructureButton.disabled = false;
      generateStructureButton.title = isRealTournament
        ? "Gerar estrutura usando inscritos reais válidos do Supabase."
        : "Gerar estrutura do torneio";

      managerTitle.textContent = `Gerenciar: ${tournament.title || tournament.name || "Torneio"}`;
      managerMeta.textContent = `${tournament.game || tournament.gameName || "Jogo"} | ${getTournamentFormatLabel(tournament)} | ${participants.length}/${maxPlayers || "?"} participantes | Check-in: ${checkedParticipants}/${participants.length} | ${isRealTournament ? "Supabase" : "Local"}`;

      if (participants.length === 0) {
        participantCounter.textContent = isRealTournament
          ? "Nenhuma inscrição real encontrada para este torneio."
          : "Nenhum participante cadastrado.";
        participantList.innerHTML = `
          <div class="saved-item">
            <span>${isRealTournament ? "Quando jogadores se inscreverem pelo detalhe público do torneio, eles aparecerão aqui." : "Adicione participantes para começar a montar o torneio."}</span>
          </div>
        `;
        return;
      }

      const eligibleParticipants = participants.filter((participant) => isParticipantEligibleForStructure(participant, tournament)).length;
      const checkinMode = getTournamentCheckinMode(tournament);

      participantCounter.textContent = `${participants.length}/${maxPlayers || "?"} participantes cadastrados. ${checkedParticipants} com check-in confirmado. ${eligibleParticipants} válidos para estrutura${checkinMode === "required" ? " (check-in obrigatório)" : ""}.`;

      participantList.innerHTML = participants
        .map((participant) => {
          const checked = getParticipantCheckinValue(participant);
          const status = participant.status || "registered";
          const participantId = participant.participantId || participant.id;

          return `
            <div class="participant-item">
              <div class="participant-info">
                <strong>${escapeHTML(participant.nickname)}</strong>
                <span>
                  Time: ${escapeHTML(participant.team || "Sem equipe")} |
                  Perfil: ${escapeHTML(participant.playerSlug || participant.profileId || "Não informado")} |
                  Fonte: ${isRealTournament ? "Supabase" : "Local"}
                </span>

                <div class="status-pill ${checked ? "checked" : "pending"}">
                  ${checked ? "Check-in confirmado" : "Check-in pendente"}
                </div>

                <div class="status-pill ${status === "registered" ? "checked" : "pending"}">
                  ${escapeHTML(getParticipantStatusLabel(status))}
                </div>

                <div class="status-pill ${isParticipantEligibleForStructure(participant, tournament) ? "checked" : "pending"}">
                  ${isParticipantEligibleForStructure(participant, tournament) ? "Válido para estrutura" : "Fora da estrutura"}
                </div>
              </div>

              <div class="participant-actions">
                <button type="button" class="btn-secondary btn-small" data-action="toggle-checkin" data-id="${escapeHTML(participantId)}">
                  ${checked ? "Desfazer check-in" : "Confirmar check-in"}
                </button>

                <button type="button" class="btn-secondary btn-small" data-action="remove-participant" data-id="${escapeHTML(participantId)}">
                  Remover
                </button>
              </div>
            </div>
          `;
        })
        .join("");
    }

    function addParticipantToSelectedTournament() {
      const tournament = getTournamentById(selectedTournamentId);

      if (!tournament) {
        alert("Nenhum torneio selecionado.");
        return;
      }

      if (isSupabaseTournament(tournament)) {
        alert("Este torneio está no Supabase. Nesta etapa, participantes entram pela inscrição pública real; adição manual será feita em uma próxima fase.");
        return;
      }

      const participants = tournament.participants || [];
      const maxPlayers = getTournamentMaxPlayers(tournament);

      if (participants.length >= maxPlayers) {
        alert("Este torneio já atingiu o limite de participantes.");
        return;
      }

      const nickname = document.getElementById("participantNickname").value.trim();

      if (!nickname) {
        alert("Digite o nickname do participante.");
        return;
      }

      const alreadyExists = participants.some((participant) => {
        return participant.nickname.toLowerCase() === nickname.toLowerCase();
      });

      if (alreadyExists) {
        alert("Já existe um participante com esse nickname neste torneio.");
        return;
      }

      const participant = {
        id: `player-${Date.now()}`,
        nickname,
        team: document.getElementById("participantTeam").value.trim(),
        character: document.getElementById("participantCharacter").value.trim(),
        platform: document.getElementById("participantPlatform").value,
        checkin: document.getElementById("participantCheckin").value === "checked",
        status: "registered",
        createdAt: new Date().toISOString()
      };

      tournament.participants = [...participants, participant];
      tournament.updatedAt = new Date().toISOString();

      updateTournament(tournament);
      participantForm.reset();

      renderTournamentManager();
      renderSavedTournaments();
      renderStructurePreview(tournament);

      previewOutput.textContent = JSON.stringify(tournament, null, 2);
    }

    async function toggleParticipantCheckin(participantId) {
      const tournament = getTournamentById(selectedTournamentId);
      if (!tournament) return;

      const participant = (tournament.participants || []).map(normalizeAdminParticipant).find((item) => {
        return String(item.id) === String(participantId) || String(item.participantId) === String(participantId);
      });

      if (!participant) {
        alert("Participante não encontrado.");
        return;
      }

      if (isSupabaseTournament(tournament)) {
        const result = await sbwSetSupabaseTournamentParticipantCheckInAsync(participant, !getParticipantCheckinValue(participant));

        if (!result.success) {
          alert(result.message || "Não foi possível atualizar o check-in.");
          previewOutput.textContent = JSON.stringify(result, null, 2);
          return;
        }

        await refreshSupabaseTournamentParticipants(tournament);
        return;
      }

      tournament.participants = tournament.participants.map((item) => {
        return item.id === participantId
          ? { ...item, checkin: !item.checkin }
          : item;
      });

      tournament.updatedAt = new Date().toISOString();

      updateTournament(tournament);
      renderTournamentManager();
      renderSavedTournaments();
      renderStructurePreview(tournament);

      previewOutput.textContent = JSON.stringify(tournament, null, 2);
    }

    async function removeParticipant(participantId) {
      const tournament = getTournamentById(selectedTournamentId);
      if (!tournament) return;

      const participant = (tournament.participants || []).map(normalizeAdminParticipant).find((item) => {
        return String(item.id) === String(participantId) || String(item.participantId) === String(participantId);
      });

      if (!participant) {
        alert("Participante não encontrado.");
        return;
      }

      const confirmRemove = confirm("Remover este participante do torneio?");
      if (!confirmRemove) return;

      if (isSupabaseTournament(tournament)) {
        const result = await sbwRemoveSupabaseTournamentParticipantAsync(participant);

        if (!result.success) {
          alert(result.message || "Não foi possível remover a inscrição.");
          previewOutput.textContent = JSON.stringify(result, null, 2);
          return;
        }

        await refreshSupabaseTournamentParticipants(tournament);
        return;
      }

      tournament.participants = tournament.participants.filter((item) => item.id !== participantId);
      tournament.updatedAt = new Date().toISOString();

      updateTournament(tournament);
      renderTournamentManager();
      renderSavedTournaments();
      renderStructurePreview(tournament);

      previewOutput.textContent = JSON.stringify(tournament, null, 2);
    }

    function clearForm() {
      form.reset();
      updateFormatInfo();
      successMessage.classList.add("hidden");
      previewOutput.textContent = "Nenhum torneio criado ainda.";
    }

    form.addEventListener("submit", async function(event) {
      event.preventDefault();

      if (!validateTournamentForm()) return;

      const tournament = createTournamentObject();
      successMessage.classList.add("hidden");
      previewOutput.textContent = "Salvando torneio...";

      if (typeof sbwCreateTournamentAsync === "function") {
        const result = await sbwCreateTournamentAsync(tournament, {
          authUser: currentAuthUser,
          profile: currentProfile,
          organizer: getSelectedOrganizer()
        });

        if (!result.success) {
          previewOutput.textContent = JSON.stringify({
            error: true,
            message: result.message,
            details: result.error || null
          }, null, 2);
          alert(result.message || "Não foi possível criar o torneio.");
          return;
        }

        previewOutput.textContent = JSON.stringify(result.tournament || tournament, null, 2);
        successMessage.textContent = result.source === "supabase"
          ? "Torneio criado no Supabase. Ele já deve aparecer na página pública e em outros computadores."
          : "Supabase desativado. Torneio salvo localmente neste navegador.";
        successMessage.classList.remove("hidden");

        await renderSavedTournaments();

        return;
      }

      saveTournament(tournament);

      previewOutput.textContent = JSON.stringify(tournament, null, 2);
      successMessage.textContent = "Torneio salvo localmente neste navegador.";
      successMessage.classList.remove("hidden");

      renderSavedTournaments();
    });

    document.getElementById("clearForm").addEventListener("click", clearForm);

    savedList.addEventListener("click", async function(event) {
      const button = event.target.closest("[data-action='manage-tournament']");
      if (!button) return;

      await openTournamentManager(button.dataset.id);
    });

    selectAllSavedTournamentsButton.addEventListener("click", function() {
      setSavedTournamentsSelection(true);
    });

    unselectAllSavedTournamentsButton.addEventListener("click", function() {
      setSavedTournamentsSelection(false);
    });

    deleteSelectedTournamentsButton.addEventListener("click", deleteSelectedTournaments);

    closeManager.addEventListener("click", function() {
      managerArea.classList.add("hidden");
      selectedTournamentId = null;
    });

    participantForm.addEventListener("submit", function(event) {
      event.preventDefault();
      addParticipantToSelectedTournament();
    });

    participantList.addEventListener("click", async function(event) {
      const button = event.target.closest("[data-action]");
      if (!button) return;

      const action = button.dataset.action;
      const participantId = button.dataset.id;

      if (action === "toggle-checkin") {
        await toggleParticipantCheckin(participantId);
      }

      if (action === "remove-participant") {
        await removeParticipant(participantId);
      }
    });

    dynamicSettings.addEventListener("change", function(event) {
      if (event.target.id === "playoffQualifiedTotal") {
        updateGroupPresetOptions();
      }

      if (event.target.id === "groupPreset") {
        updateGroupMathHint();
      }
    });

    maxPlayersInput.addEventListener("input", function() {
      if (formatSelect.value === "groups-playoffs") {
        updateGroupMathHint();
      }
    });

    maxPlayersInput.addEventListener("change", function() {
      getTournamentCapacityFromInput(formatSelect.value);
      if (formatSelect.value === "groups-playoffs") {
        updateGroupMathHint();
      }
    });

    maxPlayersInput.addEventListener("blur", function() {
      getTournamentCapacityFromInput(formatSelect.value);
    });

    structureOutput.addEventListener("input", function(event) {
      const isScoreInput = event.target.matches("[data-score-a], [data-score-b]");
      if (!isScoreInput) return;

      const matchCard = event.target.closest("[data-match-card]");
      if (!matchCard) return;

      const checkbox = matchCard.querySelector("[data-select-result]");

      if (checkbox) {
        checkbox.checked = true;
      }

      updateDraftFromCard(matchCard);
    });

    structureOutput.addEventListener("change", function(event) {
      const isCheckbox = event.target.matches("[data-select-result]");
      if (!isCheckbox) return;

      const matchCard = event.target.closest("[data-match-card]");
      if (!matchCard) return;

      updateDraftFromCard(matchCard);
    });

     structureOutput.addEventListener("click", async function(event) {
      const button = event.target.closest("[data-action]");

      if (!button) {
        return;
      }

      const action = button.dataset.action;

      if (action === "generate-group-playoffs") {
        event.preventDefault();
        await generatePlayoffsFromGroups();
        return;
      }

      if (action === "generate-triple-bracket-playoffs") {
        event.preventDefault();
        await generateTripleBracketPlayoffs();
        return;
      }

      if (action === "finalize-tournament") {
        event.preventDefault();
        await finalizeTournament();
        return;
      }

      if (action === "open-match-workflow") {
        event.preventDefault();

        activePlayoffMatchId = button.dataset.matchId || null;
                activeMatchChatId = null;
        refreshSelectedTournamentView();

        setTimeout(() => {
          const panel = document.querySelector(".match-detail-panel");

          if (panel) {
            panel.scrollIntoView({
              behavior: "smooth",
              block: "center"
            });
          }
        }, 0);

        return;
      }

      if (action === "close-match-workflow") {
        event.preventDefault();

        activePlayoffMatchId = null;
                activeMatchChatId = null;
        refreshSelectedTournamentView();

        return;
      }

            if (action === "report-playoff-result") {
        event.preventDefault();
        await savePlayoffResult(button.dataset.matchId);
        return;
      }

      if (action === "confirm-playoff-result") {
        event.preventDefault();
        await confirmPlayoffResult(button.dataset.matchId);
        return;
      }

      if (action === "dispute-playoff-result") {
        event.preventDefault();
        await disputePlayoffResult(button.dataset.matchId);
        return;
      }

      if (action === "request-match-support") {
        event.preventDefault();

        requestMatchSupport(button.dataset.matchId);
        return;
      }

            if (action === "review-match-support") {
        event.preventDefault();

        reviewMatchSupport(button.dataset.matchId);
        return;
      }

      if (action === "resolve-match-support") {
        event.preventDefault();

        resolveMatchSupport(button.dataset.matchId);
        return;
      }

      if (action === "open-match-chat") {
        event.preventDefault();

        activeMatchChatId = button.dataset.matchId || activePlayoffMatchId || null;
        activePlayoffMatchId = activeMatchChatId;

        refreshSelectedTournamentView();

        setTimeout(() => {
          const panel = document.querySelector(".match-chat-panel");

          if (panel) {
            panel.scrollIntoView({
              behavior: "smooth",
              block: "center"
            });
          }
        }, 0);

        return;
      }

            if (action === "send-match-chat") {
        event.preventDefault();

        sendMatchChatMessage(button.dataset.matchId);
        return;
      }

      if (action === "close-match-chat") {
        event.preventDefault();

        activeMatchChatId = null;
        refreshSelectedTournamentView();
        return;
      }

      if (action === "save-selected-results") {
        event.preventDefault();
        await saveSelectedResults();
        return;
      }

      if (action === "select-all-results") {
        event.preventDefault();
        setAllSelection(true);
        return;
      }

      if (action === "unselect-all-results") {
        event.preventDefault();
        setAllSelection(false);
        return;
      }

      if (action === "clear-selected-results") {
        event.preventDefault();
        await clearSelectedResults();
        return;
      }

      if (action === "clear-all-results") {
        event.preventDefault();
        await clearAllResults();
        return;
      }

      const matchId = button.dataset.matchId;
      const matchCard = button.closest("[data-match-card]");

      if (action === "save-single-result") {
        event.preventDefault();
        await saveSingleResult(matchId, matchCard);
        return;
      }

      if (action === "clear-single-result") {
        event.preventDefault();
        await clearSingleResult(matchId);
        return;
      }
    });

    generateStructureButton.addEventListener("click", function () {
      generateTournamentStructure().catch(function (error) {
        console.error("[SBW Torneios] Erro ao gerar estrutura:", error);
        alert("Não foi possível gerar a estrutura do torneio. Veja o Console para detalhes.");
      });
    });
    formatSelect.addEventListener("change", updateFormatInfo);
    document.getElementById("phaseRulesPreset")?.addEventListener("change", applyPhaseRulesPreset);
    document.getElementById("matchFormat")?.addEventListener("change", function() {
      if (getPhaseRuleElementValue("phaseRulesPreset", "standard") === "standard") {
        applyPhaseRulesPreset();
      }
    });

   initAccessControl()
  .then(async function (isAuthorized) {
    if (!isAuthorized) {
      return;
    }

    await loadTournamentOrganizerOptions();
    updateFormatInfo();
    await renderSavedTournaments();
  })
  .catch(function (error) {
    console.warn("[SBW Torneios] Erro ao verificar permissão:", error);
    denyCreatorAccess("Não foi possível verificar sua permissão de organizador. Tente novamente.");
  });