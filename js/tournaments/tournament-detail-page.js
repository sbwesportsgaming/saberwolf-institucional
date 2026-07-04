const root = document.getElementById("tournamentDetailRoot");

const escapeHTML = sbwEscapeHTML;
const getQueryParam = sbwGetQueryParam;

let sbwCurrentDetailTournament = null;
let sbwCurrentDetailAuthUser = null;
let sbwCurrentDetailProfile = null;
let sbwCurrentDetailRegistration = null;
let sbwCurrentDetailParticipants = [];
let sbwCurrentDetailRegistrationChecked = false;
let sbwCurrentDetailRegistrationBusy = false;
let sbwCurrentDetailOrganizerAccess = null;



function sbwGetTournamentCoverData(tournament) {
  const metadata = tournament?.metadata && typeof tournament.metadata === "object" ? tournament.metadata : {};
  const settings = tournament?.settings && typeof tournament.settings === "object" ? tournament.settings : {};
  const assets = metadata.tournamentAssets || metadata.tournament_assets || settings.tournamentAssets || settings.tournament_assets || {};
  const cover = assets.cover || assets.banner || metadata.cover || settings.cover || {};
  const coverUrl =
    tournament?.coverUrl ||
    tournament?.cover_url ||
    tournament?.bannerUrl ||
    tournament?.banner_url ||
    tournament?.imageUrl ||
    tournament?.image_url ||
    cover.url ||
    cover.publicUrl ||
    cover.public_url ||
    metadata.coverUrl ||
    metadata.cover_url ||
    settings.coverUrl ||
    settings.cover_url ||
    "";

  const framing = cover.framing || cover.frame || cover.crop || cover.position || metadata.coverFrame || metadata.coverFraming || settings.coverFrame || {};
  const zoom = Number(framing.zoom || framing.scale || cover.zoom || 100);
  const x = Number(framing.x || framing.positionX || framing.horizontal || cover.x || 50);
  const y = Number(framing.y || framing.positionY || framing.vertical || cover.y || 50);

  return {
    url: String(coverUrl || "").trim(),
    zoom: Number.isFinite(zoom) && zoom > 0 ? zoom : 100,
    x: Number.isFinite(x) ? x : 50,
    y: Number.isFinite(y) ? y : 50
  };
}

function sbwBuildTournamentHeroStyle(tournament) {
  const cover = sbwGetTournamentCoverData(tournament);

  if (!cover.url) {
    return "";
  }

  const safeUrl = String(cover.url).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const size = Math.max(100, Math.min(180, cover.zoom));
  const x = Math.max(0, Math.min(100, cover.x));
  const y = Math.max(0, Math.min(100, cover.y));

  return ` style="--tournament-cover: url('${safeUrl}'); --tournament-cover-x: ${x}%; --tournament-cover-y: ${y}%; --tournament-cover-size: ${size}% auto; --tournament-cover-opacity: 0.88;"`;
}


function sbwTournamentDetailAsObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function sbwTournamentDetailIsExplicitFalse(value) {
  const normalized = String(value).trim().toLowerCase();
  return value === false || value === 0 || normalized === "false" || normalized === "0" || normalized === "nao" || normalized === "não" || normalized === "off" || normalized === "none";
}

function sbwTournamentDetailFirstDefined(values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function sbwGetTournamentDetailRankingState(tournament) {
  const settings = sbwTournamentDetailAsObject(tournament?.settings);
  const metadata = sbwTournamentDetailAsObject(tournament?.metadata);
  const ranking = sbwTournamentDetailAsObject(settings.ranking || metadata.ranking || tournament?.ranking);
  const finalResults = sbwTournamentDetailAsObject(settings.finalResults || metadata.finalResults || tournament?.finalResults || tournament?.final_results);
  const rawFlag = sbwTournamentDetailFirstDefined([
    ranking.enabled,
    ranking.rankingEnabled,
    ranking.ranking_enabled,
    ranking.countsForRanking,
    ranking.counts_for_ranking,
    ranking.countsForOrganizerRanking,
    ranking.counts_for_organizer_ranking,
    ranking.globalRankingEligible,
    ranking.global_ranking_eligible,
    settings.rankingEnabled,
    settings.ranking_enabled,
    settings.countsForRanking,
    settings.counts_for_ranking,
    settings.countsForOrganizerRanking,
    settings.counts_for_organizer_ranking,
    settings.globalRankingEligible,
    settings.global_ranking_eligible,
    settings.sbwGlobalRankingEligible,
    metadata.rankingEnabled,
    metadata.ranking_enabled,
    metadata.countsForRanking,
    metadata.counts_for_ranking,
    metadata.countsForOrganizerRanking,
    metadata.counts_for_organizer_ranking,
    metadata.globalRankingEligible,
    metadata.global_ranking_eligible,
    metadata.sbwGlobalRankingEligible,
    tournament?.rankingEnabled,
    tournament?.ranking_enabled,
    tournament?.countsForRanking,
    tournament?.counts_for_ranking,
    tournament?.countsForOrganizerRanking,
    tournament?.counts_for_organizer_ranking,
    tournament?.globalRankingEligible,
    tournament?.global_ranking_eligible,
    finalResults.rankingApplied,
    finalResults.ranking_applied
  ]);
  const pointable = rawFlag === undefined ? true : !sbwTournamentDetailIsExplicitFalse(rawFlag);

  return pointable
    ? {
        pointable: true,
        className: "ranking-global",
        icon: "fa-ranking-star",
        label: "Pontua Ranking Global",
        shortLabel: "Pontuável",
        summaryLabel: "Global + organizador",
        description: "Este torneio pontua no ranking do organizador e no Ranking Global -SBW-."
      }
    : {
        pointable: false,
        className: "no-ranking",
        icon: "fa-circle-minus",
        label: "Sem pontuação",
        shortLabel: "Não pontuável",
        summaryLabel: "Sem pontuação",
        description: "Este torneio aparece na plataforma, mas não gera pontos de ranking."
      };
}

function findTournamentById(tournamentId) {
  if (typeof sbwGetTournamentById === "function") {
    return sbwGetTournamentById(tournamentId);
  }

  return null;
}

function sbwLooksLikeUUID(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

async function findTournamentByIdAsync(tournamentId) {
  if (!tournamentId) {
    return null;
  }

  if (
    window.SBWSupabase &&
    typeof window.SBWSupabase.isEnabled === "function" &&
    window.SBWSupabase.isEnabled()
  ) {
    const tableName =
      window.SBWSupabaseConfig?.tables?.tournaments || "tournaments";

    try {
      const slugResult = await window.SBWSupabase.client
        .from(tableName)
        .select("*")
        .eq("slug", tournamentId)
        .maybeSingle();

      if (slugResult.error) {
        console.warn("[SaberWolf Supabase] Busca por slug falhou:", slugResult.error);
      }

      if (slugResult.data) {
        return typeof sbwNormalizeSupabaseTournament === "function"
          ? sbwNormalizeSupabaseTournament(slugResult.data)
          : slugResult.data;
      }

      if (sbwLooksLikeUUID(tournamentId)) {
        const idResult = await window.SBWSupabase.client
          .from(tableName)
          .select("*")
          .eq("id", tournamentId)
          .maybeSingle();

        if (idResult.error) {
          console.warn("[SaberWolf Supabase] Busca por id falhou:", idResult.error);
        }

        if (idResult.data) {
          return typeof sbwNormalizeSupabaseTournament === "function"
            ? sbwNormalizeSupabaseTournament(idResult.data)
            : idResult.data;
        }
      }
    } catch (error) {
      console.error("[SaberWolf Supabase] Erro ao buscar torneio no detalhe:", error);
    }
  }

  if (typeof sbwGetTournamentByIdAsync === "function") {
    try {
      const tournament = await sbwGetTournamentByIdAsync(tournamentId);

      if (tournament) {
        return tournament;
      }
    } catch (error) {
      console.error("Erro ao buscar torneio de forma assíncrona:", error);
    }
  }

  return findTournamentById(tournamentId);
}

function renderLoading() {
  root.innerHTML = `
    <section class="not-found-state">
      <div class="not-found-card">
        <h2>Carregando torneio...</h2>

        <p>
          Buscando informações do torneio na plataforma -SBW-.
        </p>
      </div>
    </section>
  `;
}

function getTournamentStructure(tournament) {
  if (!tournament) {
    return null;
  }

  return tournament.structure ||
    tournament.tournamentStructure ||
    tournament.generatedStructure ||
    tournament.settings?.structure ||
    tournament.metadata?.structure ||
    null;
}

function getTournamentMatches(tournament) {
  const structure = getTournamentStructure(tournament);

  if (Array.isArray(tournament?.matches) && tournament.matches.length > 0) {
    return tournament.matches;
  }

  if (Array.isArray(tournament?.settings?.matches) && tournament.settings.matches.length > 0) {
    return tournament.settings.matches;
  }

  if (Array.isArray(tournament?.metadata?.matches) && tournament.metadata.matches.length > 0) {
    return tournament.metadata.matches;
  }

  if (Array.isArray(structure?.matches) && structure.matches.length > 0) {
    return structure.matches;
  }

  return [];
}

function sbwBuildPublicMatchKey(match, index = 0, prefix = "match") {
  return String(
    match?.id ||
    match?.matchId ||
    match?.match_id ||
    `${prefix}-${index + 1}`
  );
}

function sbwNormalizePublicMatch(match, context = {}) {
  if (!match || typeof match !== "object") {
    return null;
  }

  const index = Number.isFinite(context.index) ? context.index : 0;
  const prefix = context.prefix || context.bracket || context.roundName || "match";
  const roundName =
    match.roundName ||
    match.roundLabel ||
    match.round_name ||
    match.name ||
    context.roundName ||
    context.roundLabel ||
    (match.round ? `Rodada ${match.round}` : "Partida");

  return {
    ...match,
    id: match.id || match.matchId || match.match_id || sbwBuildPublicMatchKey(match, index, prefix),
    roundName,
    roundLabel: match.roundLabel || match.round_name || roundName,
    groupName: match.groupName || match.group_name || context.groupName || "",
    bracketLabel: match.bracketLabel || match.bracket_label || context.bracketLabel || context.bracket || match.bracket || "",
    stageLabel: match.stageLabel || match.stage_label || context.stageLabel || "",
    _sbwPublicMatchKey: sbwBuildPublicMatchKey(match, index, prefix)
  };
}

function sbwAddPublicMatches(target, matches, context = {}) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return;
  }

  matches.forEach((match, index) => {
    const normalized = sbwNormalizePublicMatch(match, {
      ...context,
      index
    });

    if (normalized) {
      target.push(normalized);
    }
  });
}

function sbwCollectPublicMatchesFromStructure(tournament) {
  const structure = getTournamentStructure(tournament);
  const matches = [];

  if (!structure || typeof structure !== "object") {
    return matches;
  }

  if (Array.isArray(structure.rounds)) {
    structure.rounds.forEach((round, roundIndex) => {
      sbwAddPublicMatches(matches, round.matches, {
        roundName: round.name || round.label || `Rodada ${roundIndex + 1}`,
        bracketLabel: structure.label || getFormatLabel(getTournamentFormat(tournament)),
        prefix: `round-${roundIndex + 1}`
      });
    });
  }

  if (Array.isArray(structure.winnersBracket)) {
    structure.winnersBracket.forEach((round, roundIndex) => {
      sbwAddPublicMatches(matches, round.matches, {
        roundName: round.name || round.label || `Winners R${roundIndex + 1}`,
        bracketLabel: "Winners Bracket",
        prefix: `winners-${roundIndex + 1}`
      });
    });
  }

  if (Array.isArray(structure.losersBracket)) {
    structure.losersBracket.forEach((round, roundIndex) => {
      sbwAddPublicMatches(matches, round.matches, {
        roundName: round.name || round.label || `Lower R${roundIndex + 1}`,
        bracketLabel: "Lower Bracket",
        prefix: `lower-${roundIndex + 1}`
      });
    });
  }

  if (Array.isArray(structure.grandFinal?.rounds)) {
    structure.grandFinal.rounds.forEach((round, roundIndex) => {
      sbwAddPublicMatches(matches, round.matches, {
        roundName: round.name || round.label || (roundIndex === 0 ? "Grand Final" : "Reset se necessário"),
        bracketLabel: "Grand Final",
        prefix: `grand-final-${roundIndex + 1}`
      });
    });
  }


  if (Array.isArray(structure.groupStage?.rounds)) {
    structure.groupStage.rounds.forEach((round, roundIndex) => {
      sbwAddPublicMatches(matches, round.matches, {
        roundName: round.name || round.label || `Rodada ${roundIndex + 1}`,
        bracketLabel: "Sistema de 3 Chaves · Todos contra todos",
        stageLabel: "Fase inicial",
        prefix: `triple-group-stage-${roundIndex + 1}`
      });
    });
  }

  if (Array.isArray(structure.groups)) {
    structure.groups.forEach((group, groupIndex) => {
      const groupName = group.name || group.label || `Grupo ${String.fromCharCode(65 + groupIndex)}`;

      if (Array.isArray(group.rounds)) {
        group.rounds.forEach((round, roundIndex) => {
          sbwAddPublicMatches(matches, round.matches, {
            groupName,
            roundName: `${groupName} — ${round.name || round.label || `Rodada ${roundIndex + 1}`}`,
            bracketLabel: "Fase de grupos",
            prefix: `${groupName}-round-${roundIndex + 1}`
          });
        });
      }

      sbwAddPublicMatches(matches, group.matches, {
        groupName,
        roundName: `${groupName} — partidas`,
        bracketLabel: "Fase de grupos",
        prefix: `${groupName}-matches`
      });
    });
  }

  if (structure.playoffs) {
    const playoffs = structure.playoffs;

    if (Array.isArray(playoffs.rounds)) {
      playoffs.rounds.forEach((round, roundIndex) => {
        sbwAddPublicMatches(matches, round.matches, {
          roundName: round.name || round.label || `Playoffs R${roundIndex + 1}`,
          bracketLabel: "Playoffs",
          prefix: `playoffs-${roundIndex + 1}`
        });
      });
    }

    if (Array.isArray(playoffs.sides)) {
      playoffs.sides.forEach((side, sideIndex) => {
        const sideLabel = side.name || side.label || `Lado ${sideIndex + 1}`;

        (side.rounds || []).forEach((round, roundIndex) => {
          sbwAddPublicMatches(matches, round.matches, {
            roundName: round.name || round.label || `${sideLabel} R${roundIndex + 1}`,
            bracketLabel: sideLabel,
            prefix: `${sideLabel}-round-${roundIndex + 1}`
          });
        });
      });
    }

    if (playoffs.final) {
      sbwAddPublicMatches(matches, [playoffs.final], {
        roundName: "Final",
        bracketLabel: "Playoffs",
        prefix: "playoffs-final"
      });
    }

    if (playoffs.thirdPlace) {
      sbwAddPublicMatches(matches, [playoffs.thirdPlace], {
        roundName: "Disputa de 3º lugar",
        bracketLabel: "Playoffs",
        prefix: "playoffs-third"
      });
    }
  }

  return matches;
}

function sbwGetPublicMatches(tournament) {
  const directMatches = getTournamentMatches(tournament).map((match, index) => {
    return sbwNormalizePublicMatch(match, {
      index,
      prefix: "direct",
      bracketLabel: getFormatLabel(getTournamentFormat(tournament))
    });
  }).filter(Boolean);

  const structureMatches = sbwCollectPublicMatchesFromStructure(tournament);
  const seen = new Set();
  const merged = [];

  [...directMatches, ...structureMatches].forEach((match, index) => {
    const key = String(match.id || match._sbwPublicMatchKey || `public-${index}`);

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    merged.push(match);
  });

  return merged;
}

function sbwGetPublicMatchRoundLabel(match) {
  return match?.roundName || match?.roundLabel || match?.round_name || match?.name || "Partida";
}

function sbwGetPublicMatchBracketLabel(match) {
  return match?.bracketLabel || match?.bracket_label || match?.groupName || match?.bracket || match?.stageLabel || "Torneio";
}

function getTournamentStandings(tournament) {
  const structure = getTournamentStructure(tournament);

  if (Array.isArray(tournament?.standings) && tournament.standings.length > 0) {
    return tournament.standings;
  }

  if (Array.isArray(tournament?.settings?.standings) && tournament.settings.standings.length > 0) {
    return tournament.settings.standings;
  }

  if (Array.isArray(tournament?.metadata?.standings) && tournament.metadata.standings.length > 0) {
    return tournament.metadata.standings;
  }

  if (Array.isArray(structure?.standings) && structure.standings.length > 0) {
    return structure.standings;
  }

  if (Array.isArray(structure?.league?.standings) && structure.league.standings.length > 0) {
    return structure.league.standings;
  }

  return [];
}

function getStructureGeneratedAt(tournament) {
  const structure = getTournamentStructure(tournament);

  return tournament?.settings?.structureGeneratedAt ||
    tournament?.metadata?.structureGeneratedAt ||
    structure?.generatedAt ||
    "";
}

function getStructureGeneratedFrom(tournament) {
  const structure = getTournamentStructure(tournament);

  return tournament?.settings?.structureGeneratedFrom ||
    tournament?.metadata?.structureGeneratedFrom ||
    structure?.source ||
    "";
}

function getStructurePlayersUsed(tournament) {
  const structure = getTournamentStructure(tournament);

  return Number(
    structure?.eligibleParticipantsCount ||
    structure?.playersUsed ||
    tournament?.metadata?.structurePlayersUsed ||
    tournament?.settings?.structurePlayersUsed ||
    0
  );
}

function hasGeneratedStructure(tournament) {
  return Boolean(getTournamentStructure(tournament));
}

function getTournamentFormat(tournament) {
  const structure = getTournamentStructure(tournament);
  const settings = tournament?.settings || {};
  const metadata = tournament?.metadata || {};
  const formatMeta = metadata.format || metadata.tournamentFormat || metadata.tournament_format || settings.formatMeta || settings.formatMetadata || settings.format_metadata || {};

  const rawFormat =
    formatMeta.key ||
    formatMeta.formatKey ||
    formatMeta.format_key ||
    tournament?.formatKey ||
    tournament?.format_key ||
    tournament?.format ||
    tournament?.type ||
    settings.formatKey ||
    settings.format_key ||
    settings.format ||
    structure?.type ||
    structure?.format ||
    "";

  const normalized = String(rawFormat).toLowerCase().trim();

  if (window.SBWTournamentFormats?.get) {
    const registered = window.SBWTournamentFormats.get(normalized || rawFormat);
    if (registered?.key) {
      return registered.key;
    }
  }


  if (
    normalized === "triple-bracket" ||
    normalized === "triple_bracket" ||
    normalized === "triple-bracket-8" ||
    normalized === "sistema-3-chaves" ||
    normalized === "sistema-de-3-chaves" ||
    normalized.includes("3 chaves") ||
    normalized.includes("triple")
  ) {
    return "triple-bracket";
  }

  if (
    normalized === "groups-playoffs" ||
    normalized === "groups_playoffs" ||
    normalized === "group-playoffs" ||
    normalized === "grupo-playoffs" ||
    normalized.includes("grupo")
  ) {
    return "groups-playoffs";
  }

  if (
    normalized === "league" ||
    normalized === "liga" ||
    normalized === "pontos-corridos" ||
    normalized === "pontos corridos" ||
    normalized === "round-robin" ||
    normalized.includes("liga") ||
    normalized.includes("pontos")
  ) {
    return "league";
  }

  if (
    normalized === "double-elimination" ||
    normalized === "double_elimination" ||
    normalized.includes("double")
  ) {
    return "double-elimination";
  }

  if (
    normalized === "single-elimination" ||
    normalized === "single_elimination" ||
    normalized.includes("single") ||
    normalized.includes("simples")
  ) {
    return "single-elimination";
  }

  return rawFormat || "unknown";
}

  function getFormatLabel(format) {
    if (window.SBWTournamentFormats?.getLabel) {
      const label = window.SBWTournamentFormats.getLabel(format, "");
      if (label) return label;
    }

    const labels = {
      "triple-bracket": "Sistema de 3 Chaves",
      "groups-playoffs": "Grupos + Playoffs",
      league: "Liga / Pontos Corridos",
      "double-elimination": "Double Elimination",
      "single-elimination": "Eliminação Simples"
    };

    return labels[format] || format || "Formato não definido";
  }

  function sbwGetTournamentFormatDefinition(format) {
    const registry = window.SBWTournamentFormats;
    const registered = registry && typeof registry.get === "function" ? registry.get(format) : null;

    if (registered) {
      return {
        key: registered.key || format,
        label: registered.label || registered.shortLabel || getFormatLabel(format),
        shortLabel: registered.shortLabel || registered.label || getFormatLabel(format),
        family: registered.family || "custom",
        category: registered.category || "custom",
        status: registered.status || "custom",
        teamMode: registered.teamMode || "solo",
        description: registered.description || registered.publicNote || "Formato competitivo da plataforma -SBW-.",
        publicNote: registered.publicNote || registered.description || "",
        flowTitle: registered.flowTitle || "Fluxo competitivo",
        flowDescription: registered.flowDescription || registered.publicNote || registered.description || "O fluxo aparece conforme a estrutura publicada pelo organizador.",
        features: Array.isArray(registered.features) ? registered.features : [],
        specs: Array.isArray(registered.specs) ? registered.specs : [],
        capabilities: registered.capabilities && typeof registered.capabilities === "object" ? registered.capabilities : {}
      };
    }

    const label = getFormatLabel(format);

    return {
      key: String(format || "custom").trim() || "custom",
      label,
      shortLabel: label,
      family: "custom",
      category: "custom",
      status: "custom",
      teamMode: "solo",
      description: "Formato competitivo configurado pelo organizador.",
      publicNote: "As informações públicas serão exibidas conforme o organizador configurar a estrutura.",
      flowTitle: "Formato personalizado",
      flowDescription: "A estrutura do torneio será exibida nas abas públicas quando estiver disponível.",
      features: ["Configuração do organizador", "Informações públicas do torneio"],
      specs: [
        { label: "Estrutura", value: "Definida pelo organizador" },
        { label: "Exibição", value: "As abas públicas aparecem conforme a configuração disponível" }
      ],
      capabilities: {}
    };
  }

  function sbwGetTournamentFormatStatusLabel(status) {
    const labels = {
      active: "Disponível",
      planned: "Planejado",
      custom: "Personalizado",
      draft: "Em preparação"
    };

    return labels[String(status || "").toLowerCase()] || "Formato";
  }

  function sbwGetTournamentFormatCategoryLabel(category) {
    const labels = {
      core: "Formato base",
      advanced: "Formato avançado",
      custom: "Formato personalizado"
    };

    return labels[String(category || "").toLowerCase()] || "Formato competitivo";
  }

  function sbwGetTournamentFormatTeamModeLabel(teamMode) {
    const labels = {
      solo: "Individual",
      team: "Equipes",
      team_4v4: "Equipes 4v4"
    };

    return labels[String(teamMode || "").toLowerCase()] || "Competitivo";
  }

  function sbwRenderTournamentFormatSpecs(format) {
    const specs = Array.isArray(format?.specs)
      ? format.specs
          .filter((item) => item && typeof item === "object")
          .map((item) => ({
            label: String(item.label || "").trim(),
            value: String(item.value || "").trim()
          }))
          .filter((item) => item.label && item.value)
      : [];

    if (!specs.length) return "";

    return `
      <div class="overview-format-guide-specs" aria-label="Matriz técnica do formato competitivo">
        ${specs.slice(0, 6).map((item) => `
          <span>
            <small>${escapeHTML(item.label)}</small>
            <strong>${escapeHTML(item.value)}</strong>
          </span>
        `).join("")}
      </div>
    `;
  }

  function sbwGetTeamBattlePublicPreviewModel(tournament, format) {
    const helper = window.SBWTeamBattleLeague;

    if (helper && typeof helper.buildTeamBattleLeaguePublicSectionModel === "function") {
      try {
        return helper.buildTeamBattleLeaguePublicSectionModel(tournament || {}, { leagueMode: "basic_single_division" });
      } catch (error) {
        console.warn("[SBW Torneios] Não foi possível montar prévia pública Team Battle League:", error);
      }
    }

    return {
      title: format?.label || "Team Battle League 4v4",
      subtitle: "Formato por equipes com confrontos estratégicos, escalações e partidas individuais.",
      badge: { label: "Em preparação" },
      leagueModeLabel: "Básica · divisão única",
      description: "Primeira versão planejada para operar com todas as equipes em uma divisão única, antes do modo avançado com várias divisões.",
      highlights: [
        "Equipes com 4 jogadores",
        "3 partidas principais por confronto",
        "Reserva para partida extra em caso de empate",
        "Pontuação 10 / 10 / 20 / +10"
      ],
      rulebook: {
        scoreModel: [
          { label: "Partida 1", points: 10 },
          { label: "Partida 2", points: 10 },
          { label: "Partida 3", points: 20 },
          { label: "Partida extra", points: 10, conditional: true }
        ]
      },
      publicOverview: {
        divisions: 1,
        teams: 0,
        rounds: 0,
        matches: 0
      },
      transparencyNotes: [
        "Formato ainda em preparação na plataforma -SBW-.",
        "A primeira versão funcional deve priorizar a liga básica com divisão única.",
        "O modo avançado com várias divisões fica reservado para etapa posterior."
      ]
    };
  }

  function sbwRenderTeamBattlePublicPreview(tournament, format) {
    const formatKey = String(format?.key || getTournamentFormat(tournament) || "").toLowerCase();
    if (formatKey !== "team-battle-league-4v4") return "";

    const model = sbwGetTeamBattlePublicPreviewModel(tournament, format);
    const scoreModel = Array.isArray(model?.rulebook?.scoreModel) ? model.rulebook.scoreModel : [];
    const notes = Array.isArray(model?.transparencyNotes) ? model.transparencyNotes.slice(0, 3) : [];
    const board = window.SBWTeamBattleLeague && typeof window.SBWTeamBattleLeague.buildTeamBattleLeagueVisualPreviewBoard === "function"
      ? window.SBWTeamBattleLeague.buildTeamBattleLeagueVisualPreviewBoard(tournament || {}, { leagueMode: "basic_single_division" })
      : null;
    const standings = Array.isArray(board?.standings) ? board.standings : [];
    const matches = Array.isArray(board?.matches) ? board.matches : [];
    const boardByes = Array.isArray(board?.byes) ? board.byes.slice(0, 4) : [];
    const playoffPreview = board?.playoffPreview || null;
    const playoffMatches = Array.isArray(playoffPreview?.matches) ? playoffPreview.matches.slice(0, 4) : [];
    const playoffTeams = Array.isArray(playoffPreview?.qualifiedTeams) ? playoffPreview.qualifiedTeams.slice(0, 4) : [];
    const playoffRules = Array.isArray(playoffPreview?.rules) ? playoffPreview.rules.slice(0, 4) : [];
    const scheduleSummary = board?.scheduleSummary || model?.scheduleSummary || (window.SBWTeamBattleLeague && typeof window.SBWTeamBattleLeague.buildTeamBattleScheduleAutonomySummary === "function"
      ? window.SBWTeamBattleLeague.buildTeamBattleScheduleAutonomySummary(tournament || {}, { leagueMode: "basic_single_division" })
      : null);
    const scheduleCards = Array.isArray(scheduleSummary?.cards) ? scheduleSummary.cards.slice(0, 4) : [];
    const scheduleRules = Array.isArray(scheduleSummary?.rules) ? scheduleSummary.rules.slice(0, 4) : [];
    const emptyState = board?.emptyState || {
      title: "Aguardando check-in das equipes",
      description: "As equipes reais confirmadas aparecerão nesta divisão após o encerramento do check-in.",
      tableHint: "A tabela não usa equipes demo ou placeholders como participantes."
    };
    const publicSteps = [
      { label: "1", title: "Criação do torneio", text: "O organizador escolhe o Team Battle League 4v4 básico e revisa as regras principais." },
      { label: "2", title: "Molde da Divisão Única", text: "Depois de criado, o torneio mostra a tabela vazia e a estrutura de pontuação." },
      { label: "3", title: "Check-in de equipes", text: "Somente equipes reais confirmadas entram no grupo e nos confrontos." },
      { label: "4", title: "Agenda livre", text: "O organizador define datas e horários por rodada/confronto, sem prender tudo ao mesmo dia." },
      { label: "5", title: "Rodadas e resultados", text: "Confrontos, pontos e classificação alimentam a fase final." },
      { label: "6", title: "Playoffs -SBW-", text: "Top 4 da Divisão Única entra na Escada -SBW-: 3º x 4º, vencedor contra 2º e Grande Final contra 1º." }
    ];

    return `
      <section class="overview-team-battle-public-preview overview-team-battle-public-preview--efficient" aria-label="Molde público Team Battle League 4v4">
        <div class="overview-team-battle-public-preview__head">
          <div>
            <span>Team Battle League 4v4</span>
            <h5>${escapeHTML(model?.title || "Team Battle League 4v4 básico")}</h5>
            <p>${escapeHTML(model?.description || "Formato por equipes em preparação na plataforma -SBW-.")}</p>
          </div>
          <em>${escapeHTML(model?.badge?.label || "Em preparação")}</em>
        </div>

        <div class="overview-team-battle-public-preview__mode">
          <strong>Básica · Divisão Única</strong>
          <span>Sem equipes demo. A tabela só será preenchida com equipes reais após check-in confirmado.</span>
        </div>

        ${scoreModel.length ? `
          <div class="overview-team-battle-public-preview__score" aria-label="Pontuação do confronto">
            ${scoreModel.map((slot) => `
              <span><strong>${escapeHTML(slot.points || 0)}</strong>${escapeHTML(slot.label || "Partida")}${slot.conditional ? " · se empate" : ""}</span>
            `).join("")}
          </div>
        ` : ""}

        <div class="overview-team-battle-empty-group" aria-label="Molde da Divisão Única">
          <div class="overview-team-battle-empty-group__head">
            <div>
              <strong>${escapeHTML(board?.divisionName || "Divisão Única")}</strong>
              <span>${escapeHTML(board?.summaryLabel || "Molde da liga básica aguardando equipes reais.")}</span>
            </div>
            <em>${escapeHTML(board?.leagueModeLabel || "Básica · divisão única")}</em>
          </div>

          <div class="overview-team-battle-empty-group__table" role="table" aria-label="Tabela da Divisão Única">
            <div role="row" class="is-head">
              <span>Pos.</span>
              <span>Equipe</span>
              <span>Pts</span>
              <span>V</span>
              <span>Saldo</span>
            </div>
            ${standings.length ? standings.map((row, index) => `
              <div role="row">
                <span>${escapeHTML(row.position || index + 1)}º</span>
                <span>${escapeHTML(row.teamName || row.name || "Equipe confirmada")}</span>
                <span>${escapeHTML(row.battlePoints || 0)}</span>
                <span>${escapeHTML(row.teamMatchWins || 0)}</span>
                <span>${escapeHTML(row.battlePointDiff || 0)}</span>
              </div>
            `).join("") : `
              <div role="row" class="is-empty">
                <span>—</span>
                <span>${escapeHTML(emptyState.description)}</span>
                <span>—</span>
                <span>—</span>
                <span>—</span>
              </div>
            `}
          </div>

          <p>${escapeHTML(emptyState.tableHint || "A tabela será preenchida apenas com equipes reais confirmadas.")}</p>
        </div>

        <div class="overview-team-battle-match-model" aria-label="Modelo de confronto sem equipes demo">
          <div>
            <strong>Modelo do confronto 4v4</strong>
            <span>O confronto usa 3 partidas principais e uma extra somente em caso de empate.</span>
          </div>
          <div class="overview-team-battle-match-model__grid">
            <article><small>Partida 1</small><strong>10 pts</strong><span>Titular confirmado vs titular confirmado</span></article>
            <article><small>Partida 2</small><strong>10 pts</strong><span>Titular confirmado vs titular confirmado</span></article>
            <article><small>Partida 3</small><strong>20 pts</strong><span>Titular confirmado vs titular confirmado</span></article>
            <article><small>Extra</small><strong>+10 pts</strong><span>Reserva confirmada somente se houver empate</span></article>
          </div>
        </div>

        ${scheduleSummary ? `
          <div class="overview-team-battle-schedule" aria-label="Agenda das partidas Team Battle League 4v4">
            <div class="overview-team-battle-schedule__head">
              <div>
                <small>${escapeHTML(scheduleSummary.badge || "Controle do organizador")}</small>
                <strong>${escapeHTML(scheduleSummary.title || "Agenda livre de partidas")}</strong>
                <p>${escapeHTML(scheduleSummary.description || "Datas e horários dos confrontos são definidos pelo organizador.")}</p>
              </div>
              <span>${escapeHTML(scheduleSummary.timezone || "America/Sao_Paulo")}</span>
            </div>
            <div class="overview-team-battle-schedule__grid">
              ${(scheduleCards.length ? scheduleCards : [
                { label: "Tipo", value: "Por confronto", detail: "Cada partida pode ter agenda própria." },
                { label: "Controle", value: "Organizador", detail: "Remarcações são gerenciadas pelo torneio." }
              ]).map((card) => `
                <article>
                  <small>${escapeHTML(card.label || "Item")}</small>
                  <strong>${escapeHTML(card.value || "—")}</strong>
                  <p>${escapeHTML(card.detail || "A definir pelo organizador.")}</p>
                </article>
              `).join("")}
            </div>
            <div class="overview-team-battle-schedule__rules">
              ${(scheduleRules.length ? scheduleRules : ["Datas por rodada/confronto", "Remarcação pelo organizador", "Data inicial é referência", "Resultados alimentam a tabela"]).map((rule) => `<span>${escapeHTML(rule)}</span>`).join("")}
            </div>
          </div>
        ` : ""}

        <div class="overview-team-battle-public-preview__steps" aria-label="Fluxo eficiente do Team Battle League 4v4">
          ${publicSteps.map((step) => `
            <article>
              <span>${escapeHTML(step.label)}</span>
              <strong>${escapeHTML(step.title)}</strong>
              <p>${escapeHTML(step.text)}</p>
            </article>
          `).join("")}
        </div>

        ${(matches.length || boardByes.length) ? `
          <div class="overview-team-battle-round-preview">
            <strong>Rodada gerada</strong>
            ${matches.map((match) => `
              <article>
                <small>${escapeHTML(match.label || "Confronto")}</small>
                <div><span>${escapeHTML(match.homeTeamName || "Equipe confirmada")}</span><em>vs</em><span>${escapeHTML(match.awayTeamName || "Equipe confirmada")}</span></div>
                <p>${escapeHTML(match.statusLabel || "Aguardando equipes")} · ${escapeHTML(match.scheduleLabel || match.scheduleStatusLabel || "data a definir pelo organizador")}</p>
                ${match.note ? `<p class="overview-team-battle-round-preview__note">${escapeHTML(match.note)}</p>` : ""}
                ${match.streamUrl ? `<a class="overview-team-battle-round-preview__stream" href="${escapeHTML(match.streamUrl)}" target="_blank" rel="noopener noreferrer">Transmissão</a>` : ""}
              </article>
            `).join("")}
            ${boardByes.map((bye) => `
              <article class="is-bye">
                <small>${escapeHTML(bye.label || "Folga da rodada")}</small>
                <div><span>${escapeHTML(bye.teamLabel || bye.teamName || "Equipe em folga")}</span><em>folga</em><span>sem adversário fake</span></div>
                <p>${escapeHTML(bye.description || "Folga técnica por quantidade ímpar de equipes; não soma pontos automaticamente.")}</p>
              </article>
            `).join("")}
          </div>
        ` : ""}

        ${playoffPreview ? `
          <div class="overview-team-battle-playoff-preview" aria-label="Playoffs Team Battle League 4v4 em escada -SBW-">
            <div class="overview-team-battle-playoff-preview__head">
              <div>
                <small>${escapeHTML(playoffPreview.rulesetLabel || "Modelo -SBW- em escada")}</small>
                <strong>${escapeHTML(playoffPreview.title || "Playoffs -SBW-")}</strong>
                <p>${escapeHTML(playoffPreview.description || "Fase final montada pela classificação real da liga.")}</p>
              </div>
              <span>${escapeHTML(playoffPreview.statusLabel || "Aguardando classificação")}</span>
            </div>

            <div class="overview-team-battle-playoff-preview__teams">
              ${playoffTeams.length ? playoffTeams.map((team) => `
                <span><small>${escapeHTML(team.label || `${team.seed || ""}º colocado`)}</small>${escapeHTML(team.name || "Equipe classificada")}</span>
              `).join("") : `
                <span><small>Top 4</small>${escapeHTML(playoffPreview.emptyState?.description || "Aguardando finalização da fase classificatória.")}</span>
              `}
            </div>

            <div class="overview-team-battle-playoff-preview__bracket">
              ${playoffMatches.length ? playoffMatches.map((match) => `
                <article>
                  <small>${escapeHTML(match.stageLabel || "Playoff")}</small>
                  <strong>${escapeHTML(match.firstToLabel || "FT")}</strong>
                  <div><span>${escapeHTML(match.homeTeamLabel || "Classificado")}</span><em>vs</em><span>${escapeHTML(match.awayTeamLabel || "Classificado")}</span></div>
                  <p>${escapeHTML(match.statusLabel || "Aguardando")} · ${escapeHTML(match.noExtraMatch ? "sem partida extra" : "partida extra se necessário")}</p>
                </article>
              `).join("") : `
                <article>
                  <small>${escapeHTML(playoffPreview.emptyState?.title || "Playoffs aguardando")}</small>
                  <strong>FT50 / FT70</strong>
                  <div><span>3º x 4º</span><em>→</em><span>2º → 1º</span></div>
                  <p>${escapeHTML(playoffPreview.emptyState?.hint || "A fase final não usa equipes demo/fake.")}</p>
                </article>
              `}
            </div>

            ${playoffRules.length ? `
              <div class="overview-team-battle-playoff-preview__rules">
                ${playoffRules.map((rule) => `<span>${escapeHTML(rule)}</span>`).join("")}
              </div>
            ` : ""}
          </div>
        ` : ""}

        ${notes.length ? `
          <div class="overview-team-battle-public-preview__notes">
            ${notes.map((note) => `<span>${escapeHTML(note)}</span>`).join("")}
          </div>
        ` : ""}
      </section>
    `;
  }

  function sbwRenderTournamentFormatGuide(tournament) {
    const formatKey = getTournamentFormat(tournament);
    const format = sbwGetTournamentFormatDefinition(formatKey);
    const features = Array.isArray(format.features) && format.features.length
      ? format.features.slice(0, 5)
      : [sbwGetTournamentFormatCategoryLabel(format.category), sbwGetTournamentFormatTeamModeLabel(format.teamMode)];
    const isPlanned = String(format.status || "").toLowerCase() === "planned";

    return `
      <article class="overview-format-guide-card ${isPlanned ? "is-planned" : ""}">
        <div class="overview-format-guide-head">
          <div>
            <span>Formato competitivo</span>
            <h4>${escapeHTML(format.label)}</h4>
            <p>${escapeHTML(format.description || format.publicNote || "Formato competitivo da plataforma -SBW-.")}</p>
          </div>
          <div class="overview-format-guide-badges">
            <em>${escapeHTML(sbwGetTournamentFormatStatusLabel(format.status))}</em>
            <em>${escapeHTML(sbwGetTournamentFormatCategoryLabel(format.category))}</em>
            <em>${escapeHTML(sbwGetTournamentFormatTeamModeLabel(format.teamMode))}</em>
          </div>
        </div>
        <div class="overview-format-guide-flow">
          <strong>${escapeHTML(format.flowTitle || "Fluxo competitivo")}</strong>
          <p>${escapeHTML(format.flowDescription || format.publicNote || "O fluxo do torneio aparece conforme a estrutura publicada pelo organizador.")}</p>
        </div>
        <div class="overview-format-guide-features" aria-label="Recursos do formato">
          ${features.map((feature) => `<span>${escapeHTML(feature)}</span>`).join("")}
        </div>
        ${sbwRenderTournamentFormatSpecs(format)}
        ${sbwRenderTeamBattlePublicPreview(tournament, format)}
      </article>
    `;
  }

  function getStatusInfo(status) {
    const normalized = String(status || "draft").toLowerCase();

    const statusMap = {
      draft: {
        label: "Rascunho",
        className: "draft"
      },
      open: {
        label: "Inscrições abertas",
        className: "open"
      },
      published: {
        label: "Publicado",
        className: "open"
      },
      "registration-open": {
        label: "Inscrições abertas",
        className: "open"
      },
      "structure-generated": {
        label: "Estrutura gerada",
        className: "running"
      },
      "in-progress": {
        label: "Em andamento",
        className: "running"
      },
      running: {
        label: "Em andamento",
        className: "running"
      },
      finished: {
        label: "Encerrado",
        className: "finished"
      },
      completed: {
        label: "Encerrado",
        className: "finished"
      }
    };

    return statusMap[normalized] || {
      label: normalized,
      className: "draft"
    };
  }

  function formatDate(value) {
    if (!value) {
      return "Data a definir";
    }

    const safeValue = String(value);

    if (safeValue.includes("/")) {
      return safeValue;
    }

    const date = new Date(`${safeValue}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return safeValue;
    }

    return date.toLocaleDateString("pt-BR");
  }

  function getParticipants(tournament) {
    return Array.isArray(tournament.participants)
      ? tournament.participants
      : [];
  }

  function getParticipantsCount(tournament) {
  const directCount =
    tournament?.currentParticipants ??
    tournament?.participantsCount ??
    tournament?.registeredParticipants ??
    tournament?.registrationsCount ??
    null;

  if (directCount !== null && directCount !== undefined && directCount !== "") {
    const numberValue = Number(directCount);

    if (Number.isFinite(numberValue)) {
      return numberValue;
    }
  }

  return getParticipants(tournament).length;
}

  function getMaxParticipants(tournament) {
    return tournament.maxParticipants ||
      tournament.participantLimit ||
      tournament.limitParticipants ||
      "∞";
  }

  function getDescription(tournament) {
    return tournament.description ||
      tournament.shortDescription ||
      "Torneio publicado na plataforma -SBW-.";
  }

  function getRules(tournament) {
    return tournament.rules ||
      tournament.ruleSet ||
      "Regras ainda não publicadas pelo organizador.";
  }

  function getPrize(tournament) {
    return tournament.prize ||
      tournament.prizePool ||
      "A definir";
  }

  function getOrganizer(tournament) {
    return tournament.organizer ||
      tournament.organizerName ||
      "SaberWolf";
  }

  function sbwNormalizeDetailAccessKey(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function sbwGetTournamentOrganizerData(tournament) {
    const metadata = tournament?.metadata && typeof tournament.metadata === "object" ? tournament.metadata : {};
    const settings = tournament?.settings && typeof tournament.settings === "object" ? tournament.settings : {};
    const organizer = tournament?.organizer && typeof tournament.organizer === "object" ? tournament.organizer : {};
    const organizerName = typeof tournament?.organizer === "string" ? tournament.organizer : "";

    const id =
      tournament?.organizerId ||
      tournament?.organizer_id ||
      tournament?.tournamentOrganizerId ||
      tournament?.tournament_organizer_id ||
      metadata.organizerId ||
      metadata.organizer_id ||
      settings.organizerId ||
      settings.organizer_id ||
      organizer.id ||
      "";

    const slug =
      tournament?.organizerSlug ||
      tournament?.organizer_slug ||
      tournament?.tournamentOrganizerSlug ||
      tournament?.tournament_organizer_slug ||
      metadata.organizerSlug ||
      metadata.organizer_slug ||
      settings.organizerSlug ||
      settings.organizer_slug ||
      organizer.slug ||
      "";

    const name =
      tournament?.organizerName ||
      tournament?.organizer_name ||
      metadata.organizerName ||
      metadata.organizer_name ||
      settings.organizerName ||
      settings.organizer_name ||
      organizer.name ||
      organizer.displayName ||
      organizer.display_name ||
      organizer.title ||
      organizerName ||
      "SaberWolf";

    return {
      id,
      slug,
      name,
      displayName: organizer.displayName || organizer.display_name || name,
      tag: organizer.tag || metadata.organizerTag || settings.organizerTag || ""
    };
  }

  function sbwGetDetailOrganizerMatchKeys(source) {
    if (!source) {
      return [];
    }

    const values = [
      source.id,
      source.slug,
      source.name,
      source.displayName,
      source.display_name,
      source.title,
      source.tag,
      source.organizerId,
      source.organizer_id,
      source.organizerSlug,
      source.organizer_slug
    ];

    if (source.access && typeof source.access === "object") {
      values.push(
        source.access.id,
        source.access.organizer_id,
        source.access.slug,
        source.access.organizer_slug,
        source.access.name,
        source.access.display_name
      );
    }

    return values
      .filter(Boolean)
      .map(sbwNormalizeDetailAccessKey)
      .filter(Boolean);
  }

  function sbwDetailOrganizerAccessMatchesTournament(access, tournament) {
    const organizerKeys = sbwGetDetailOrganizerMatchKeys(sbwGetTournamentOrganizerData(tournament));
    const accessKeys = sbwGetDetailOrganizerMatchKeys(access);

    if (organizerKeys.length === 0 || accessKeys.length === 0) {
      return false;
    }

    return accessKeys.some((key) => organizerKeys.includes(key));
  }

  function sbwDetailOrganizerAccessCanManage(access) {
    if (!access) {
      return false;
    }

    const role = String(access.memberRole || access.member_role || access.role || access.currentUserRole || "").toLowerCase();

    return Boolean(
      access.canCreateTournament === true ||
      access.canCreateTournaments === true ||
      access.can_create_tournaments === true ||
      access.canManageOrganization === true ||
      access.canManageOrganizer === true ||
      access.can_manage_organization === true ||
      access.can_manage_organizer === true ||
      ["owner", "admin", "manager", "organizer_admin", "tournament_admin", "admin_sbw"].includes(role)
    );
  }

  function sbwDetailProfileCanManageOrganizer(profile) {
    const permissions = profile?.permissions && typeof profile.permissions === "object" ? profile.permissions : {};
    const rawPermissions = profile?.rawPermissions || profile?.raw_permissions || {};
    const role = String(profile?.role || profile?.userRole || permissions.role || rawPermissions.role || "").toLowerCase();

    return Boolean(
      profile?.isAdmin === true ||
      profile?.is_admin === true ||
      permissions.isAdmin === true ||
      permissions.is_admin === true ||
      permissions.admin === true ||
      permissions.adminMaster === true ||
      permissions.admin_master === true ||
      permissions.can_manage_tournament_organizers === true ||
      permissions.canManageTournamentOrganizers === true ||
      rawPermissions.can_manage_tournament_organizers === true ||
      rawPermissions.canManageTournamentOrganizers === true ||
      ["admin", "admin_sbw", "admin_master", "owner"].includes(role)
    );
  }

  async function sbwHydrateDetailOrganizerAccess(tournament) {
    sbwCurrentDetailOrganizerAccess = null;

    if (!tournament || !sbwCurrentDetailAuthUser || typeof sbwGetMyTournamentOrganizerAccessAsync !== "function") {
      return null;
    }

    try {
      const accessList = await sbwGetMyTournamentOrganizerAccessAsync();
      const match = (Array.isArray(accessList) ? accessList : []).find((access) => {
        return sbwDetailOrganizerAccessMatchesTournament(access, tournament);
      });

      sbwCurrentDetailOrganizerAccess = match || null;
      return sbwCurrentDetailOrganizerAccess;
    } catch (error) {
      console.warn("[SaberWolf Torneios] Não foi possível validar acesso ao organizador do torneio:", error);
      sbwCurrentDetailOrganizerAccess = null;
      return null;
    }
  }

  function sbwCanManageCurrentTournamentOrganizer(tournament) {
    if (sbwDetailOrganizerAccessCanManage(sbwCurrentDetailOrganizerAccess)) {
      return true;
    }

    if (sbwDetailProfileCanManageOrganizer(sbwCurrentDetailProfile)) {
      return true;
    }

    return false;
  }

  function sbwBuildTournamentOrganizerPublicUrl(tournament) {
    const organizer = sbwGetTournamentOrganizerData(tournament);
    const organizerKey = organizer.slug || organizer.id || organizer.name || getOrganizer(tournament);

    if (window.SBWRoutes && typeof window.SBWRoutes.organizer === "function") {
      return window.SBWRoutes.organizer(organizerKey);
    }

    return `organizador.html?slug=${encodeURIComponent(organizerKey)}`;
  }

  function sbwBuildTournamentOrganizerManageUrl(tournament) {
    const organizer = sbwGetTournamentOrganizerData(tournament);
    const organizerKey = organizer.slug || organizer.id || organizer.name || getOrganizer(tournament);
    return `editar-organizador.html?slug=${encodeURIComponent(organizerKey)}`;
  }

  function sbwGetTournamentOrganizerAction(tournament) {
    const canManage = sbwCanManageCurrentTournamentOrganizer(tournament);

    return {
      label: canManage ? "Gerenciar organização" : "Ver organizador",
      icon: canManage ? "fa-sliders" : "fa-shield-halved",
      href: canManage ? sbwBuildTournamentOrganizerManageUrl(tournament) : sbwBuildTournamentOrganizerPublicUrl(tournament),
      className: canManage ? "manage" : "view"
    };
  }

  function renderTournamentOrganizerActionButton(tournament, extraClass = "") {
    const action = sbwGetTournamentOrganizerAction(tournament);

    return `
      <a class="detail-btn secondary tournament-organizer-action ${escapeHTML(action.className)} ${escapeHTML(extraClass)}" href="${escapeHTML(action.href)}">
        <i class="fa-solid ${escapeHTML(action.icon)}"></i>
        ${escapeHTML(action.label)}
      </a>
    `;
  }

  function getPlayerName(player) {
    if (!player) {
      return "A definir";
    }

    return player.nickname ||
      player.name ||
      player.playerName ||
      player.displayName ||
      "Jogador";
  }

  function getPlayerTeam(player) {
    if (!player) {
      return "Sem equipe";
    }

    const raw = player?.raw && typeof player.raw === "object" ? player.raw : {};
    const metadata = raw.metadata && typeof raw.metadata === "object" ? raw.metadata : {};
    const teamObject = player?.team && typeof player.team === "object" ? player.team : null;
    const rawTeamObject = raw.team && typeof raw.team === "object" ? raw.team : null;

    return teamObject?.name ||
      teamObject?.displayName ||
      rawTeamObject?.name ||
      rawTeamObject?.displayName ||
      player.teamName ||
      player.team_name ||
      metadata.teamName ||
      metadata.team_name ||
      (typeof player.team === "string" ? player.team : "") ||
      player.organization ||
      player.club ||
      "Sem equipe";
  }

  function sbwGetParticipantTeamTag(player) {
    if (!player) {
      return "";
    }

    const raw = player.raw && typeof player.raw === "object" ? player.raw : {};
    const metadata = raw.metadata && typeof raw.metadata === "object" ? raw.metadata : {};
    const teamObject = player.team && typeof player.team === "object" ? player.team : null;
    const rawTeamObject = raw.team && typeof raw.team === "object" ? raw.team : null;

    const tag =
      player.teamTag ||
      player.team_tag ||
      player.teamAcronym ||
      player.team_acronym ||
      player.teamPrefix ||
      player.team_prefix ||
      teamObject?.tag ||
      teamObject?.teamTag ||
      teamObject?.shortName ||
      teamObject?.abbr ||
      teamObject?.code ||
      rawTeamObject?.tag ||
      rawTeamObject?.teamTag ||
      rawTeamObject?.shortName ||
      rawTeamObject?.abbr ||
      rawTeamObject?.code ||
      raw.teamTag ||
      raw.team_tag ||
      raw.team_acronym ||
      metadata.teamTag ||
      metadata.team_tag ||
      metadata.teamAcronym ||
      metadata.team_acronym ||
      "";

    return String(tag || "").trim();
  }

  function sbwFormatPlayerDisplayName(player) {
    const name = getPlayerName(player);
    const tag = sbwGetParticipantTeamTag(player);

    if (!tag) {
      return name;
    }

    const normalizedName = String(name || "").trim();
    const normalizedTag = String(tag).trim();

    if (!normalizedName || normalizedName.toLowerCase().startsWith(normalizedTag.toLowerCase())) {
      return normalizedName || normalizedTag;
    }

    return `${normalizedTag} ${normalizedName}`;
  }

  function getMatchScore(match, field) {
    if (!match) {
      return "-";
    }

    const value = match[field];

    if (value === null || value === undefined || value === "") {
      return "-";
    }

    return value;
  }


  function hasMatchScore(match) {
    return Boolean(
      match &&
      match.scoreA !== null &&
      match.scoreA !== undefined &&
      match.scoreA !== "" &&
      match.scoreB !== null &&
      match.scoreB !== undefined &&
      match.scoreB !== ""
    );
  }

  function getMatchPlayer(match, side) {
    if (!match) {
      return null;
    }

    if (side === "A") {
      return match.playerA ||
        match.a ||
        match.home ||
        match.participantA ||
        match.player1 ||
        match.teamA ||
        match.players?.[0] ||
        match.participants?.[0] ||
        null;
    }

    return match.playerB ||
      match.b ||
      match.away ||
      match.participantB ||
      match.player2 ||
      match.teamB ||
      match.players?.[1] ||
      match.participants?.[1] ||
      null;
  }

  function getPlayerKey(player) {
    if (!player) {
      return "";
    }

    return String(
      player.id ||
      player.profileId ||
      player.profile_id ||
      player.playerSlug ||
      player.player_slug ||
      player.slug ||
      player.nickname ||
      player.name ||
      player.playerName ||
      ""
    );
  }

  function getMatchWinnerSide(match) {
    if (!match) {
      return "";
    }

    const playerA = getMatchPlayer(match, "A");
    const playerB = getMatchPlayer(match, "B");
    const winnerId = match.winnerId || match.winner_id || match.winner?.id || "";

    if (winnerId) {
      const safeWinnerId = String(winnerId);

      if (playerA && getPlayerKey(playerA) && safeWinnerId === getPlayerKey(playerA)) {
        return "A";
      }

      if (playerB && getPlayerKey(playerB) && safeWinnerId === getPlayerKey(playerB)) {
        return "B";
      }
    }

    if (!hasMatchScore(match)) {
      return "";
    }

    const scoreA = Number(match.scoreA);
    const scoreB = Number(match.scoreB);

    if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB) || scoreA === scoreB) {
      return "";
    }

    return scoreA > scoreB ? "A" : "B";
  }

  function getMatchWinnerName(match) {
    const winnerSide = getMatchWinnerSide(match);

    if (winnerSide === "A") {
      return getPlayerName(getMatchPlayer(match, "A"));
    }

    if (winnerSide === "B") {
      return getPlayerName(getMatchPlayer(match, "B"));
    }

    return "";
  }

  function getMatchPublicStatus(match) {
    const rawStatus = String(match?.status || "").toLowerCase();

    if (rawStatus === "bye" || rawStatus === "free-win") {
      return {
        className: "bye",
        label: "BYE"
      };
    }

    if (
      rawStatus === "completed" ||
      rawStatus === "finished" ||
      rawStatus === "done" ||
      hasMatchScore(match)
    ) {
      return {
        className: "completed",
        label: "Finalizada"
      };
    }

    if (rawStatus === "in-progress" || rawStatus === "live") {
      return {
        className: "live",
        label: "Em andamento"
      };
    }

    if (rawStatus.includes("waiting")) {
      return {
        className: "pending",
        label: "Aguardando resultado"
      };
    }

    return {
      className: "pending",
      label: "Pendente"
    };
  }

  function formatDateTimeLabel(value) {
    if (!value) {
      return "Ainda não atualizado";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleString("pt-BR");
  }

  function getResultsUpdatedAt(tournament) {
    return tournament?.settings?.resultsUpdatedAt ||
      tournament?.metadata?.resultsUpdatedAt ||
      tournament?.resultsUpdatedAt ||
      "";
  }

  function getFinalResults(tournament) {
    return tournament?.settings?.finalResults ||
      tournament?.metadata?.finalResults ||
      tournament?.finalResults ||
      null;
  }

  function renderFinalResultsSummary(tournament) {
    const finalResults = getFinalResults(tournament);

    if (!finalResults) {
      return "";
    }

    const champion = finalResults.champion || null;
    const placements = Array.isArray(finalResults.placements) ? finalResults.placements : [];
    const finalizedAt = finalResults.finalizedAt || finalResults.completedAt || tournament?.metadata?.completedAt || tournament?.settings?.completedAt || "";
    const finalizedDate = finalizedAt ? new Date(finalizedAt) : null;
    const finalizedLabel = finalizedDate && !Number.isNaN(finalizedDate.getTime())
      ? finalizedDate.toLocaleString("pt-BR")
      : (finalizedAt || "Data não registrada");

    return `
      <div class="detail-card final-results-card">
        <div>
          <strong>Resultado final oficial</strong>
          <p>
            Torneio encerrado pelo organizador. Campeão: <b>${escapeHTML(champion?.nickname || champion?.name || "A definir")}</b>.
          </p>
        </div>

        <div class="structure-meta-grid">
          <span><b>Status</b>Encerrado</span>
          <span><b>Finalizado em</b>${escapeHTML(finalizedLabel)}</span>
          <span><b>Partidas concluídas</b>${escapeHTML(finalResults.matchesSummary?.completedMatches || 0)} / ${escapeHTML(finalResults.matchesSummary?.totalPlayableMatches || 0)}</span>
          <span><b>Origem</b>${escapeHTML(finalResults.source || "Painel do organizador")}</span>
        </div>

        ${placements.length > 0 ? `
          <div class="public-final-placements">
            ${placements.slice(0, 8).map((player) => `
              <div class="public-final-placement-row">
                <strong>${escapeHTML(player.placementLabel || `${player.placement || "-"}º lugar`)}</strong>
                <span>${escapeHTML(player.nickname || player.name || "Jogador")}</span>
                ${player.team ? `<em>${escapeHTML(player.team)}</em>` : ""}
              </div>
            `).join("")}
          </div>
        ` : ""}
      </div>
    `;
  }

  function getResultCounts(tournament) {
    const matches = sbwGetPublicMatches(tournament);

    return matches.reduce((acc, match) => {
      const playerA = getMatchPlayer(match, "A");
      const playerB = getMatchPlayer(match, "B");

      if (!playerA || !playerB) {
        return acc;
      }

      acc.total += 1;

      if (getMatchPublicStatus(match).className === "completed") {
        acc.completed += 1;
      }

      return acc;
    }, {
      total: 0,
      completed: 0
    });
  }

  function sbwGetTournamentStatusKey(tournament) {
    return String(tournament?.status || "draft").trim().toLowerCase();
  }

  function sbwGetMaxParticipantsNumber(tournament) {
    const maxParticipants = Number(getMaxParticipants(tournament));
    return Number.isFinite(maxParticipants) && maxParticipants > 0 ? maxParticipants : null;
  }

  function sbwIsRegistrationStatusOpen(tournament) {
    const status = sbwGetTournamentStatusKey(tournament);

    return [
      "open",
      "published",
      "registration-open",
      "registrations-open",
      "inscricoes-abertas",
      "inscrições-abertas"
    ].includes(status);
  }

  function sbwGetRegistrationDateValue(tournament, type = "close") {
    const metadata = tournament?.metadata && typeof tournament.metadata === "object" ? tournament.metadata : {};
    const settings = tournament?.settings && typeof tournament.settings === "object" ? tournament.settings : {};
    const registrationMeta = metadata.registration && typeof metadata.registration === "object" ? metadata.registration : {};
    const keys = type === "open"
      ? ["registrationOpensAt", "registration_opens_at", "registrationStartAt", "registration_start_at", "opensAt"]
      : ["registrationClosesAt", "registration_closes_at", "registrationEndAt", "registration_end_at", "closesAt"];

    for (const key of keys) {
      const value = tournament?.[key] || metadata?.[key] || settings?.[key] || registrationMeta?.[key];

      if (value) {
        return value;
      }
    }

    return "";
  }

  function sbwGetRegistrationWindowState(tournament) {
    const opensAt = sbwGetRegistrationDateValue(tournament, "open");
    const closesAt = sbwGetRegistrationDateValue(tournament, "close");
    const openDate = opensAt ? new Date(opensAt) : null;
    const closeDate = closesAt ? new Date(closesAt) : null;
    const now = Date.now();

    if (openDate && !Number.isNaN(openDate.getTime()) && now < openDate.getTime()) {
      return { open: false, state: "waiting", reason: `Inscrições abrem em ${formatDateTimeLabel(opensAt)}.` };
    }

    if (closeDate && !Number.isNaN(closeDate.getTime()) && now > closeDate.getTime()) {
      return { open: false, state: "closed", reason: `Inscrições encerraram em ${formatDateTimeLabel(closesAt)}.` };
    }

    return { open: true, state: "open", reason: "Janela de inscrição ativa." };
  }

  function sbwGetRegistrationAvailability(tournament) {
    const participantsCount = getParticipantsCount(tournament);
    const maxParticipants = sbwGetMaxParticipantsNumber(tournament);
    const rawStatus = sbwGetTournamentStatusKey(tournament);
    const statusInfo = getStatusInfo(rawStatus);
    const isFull = Boolean(maxParticipants && participantsCount >= maxParticipants);
    const isOpenStatus = sbwIsRegistrationStatusOpen(tournament);
    const windowState = sbwGetRegistrationWindowState(tournament);
    const percent = maxParticipants
      ? Math.max(0, Math.min(100, Math.round((participantsCount / maxParticipants) * 100)))
      : 0;

    if (isOpenStatus && !windowState.open) {
      return {
        open: false,
        className: windowState.state === "waiting" ? "draft" : "closed",
        label: windowState.state === "waiting" ? "Inscrições em breve" : "Inscrições encerradas",
        shortLabel: windowState.state === "waiting" ? "Em breve" : "Encerrada",
        reason: windowState.reason,
        participantsCount,
        maxParticipants,
        percent
      };
    }

    if (isFull) {
      return {
        open: false,
        className: "full",
        label: "Vagas esgotadas",
        shortLabel: "Lotado",
        reason: "O limite de participantes foi atingido.",
        participantsCount,
        maxParticipants,
        percent
      };
    }

    if (isOpenStatus) {
      return {
        open: true,
        className: "open",
        label: "Inscrições abertas",
        shortLabel: "Aberta",
        reason: "Jogadores logados podem confirmar participação.",
        participantsCount,
        maxParticipants,
        percent
      };
    }

    if (["draft", "rascunho"].includes(rawStatus)) {
      return {
        open: false,
        className: "draft",
        label: "Inscrição em preparação",
        shortLabel: "Em breve",
        reason: "O organizador ainda está preparando a publicação do torneio.",
        participantsCount,
        maxParticipants,
        percent
      };
    }

    if (["completed", "finished", "finalizado", "encerrado", "cancelled", "canceled", "archived"].includes(rawStatus)) {
      return {
        open: false,
        className: "closed",
        label: "Inscrições encerradas",
        shortLabel: "Encerrada",
        reason: "Este torneio não recebe novas inscrições neste momento.",
        participantsCount,
        maxParticipants,
        percent
      };
    }

    return {
      open: false,
      className: statusInfo.className || "closed",
      label: "Inscrições indisponíveis",
      shortLabel: "Fechada",
      reason: "A inscrição será liberada pelo organizador quando o torneio estiver pronto.",
      participantsCount,
      maxParticipants,
      percent
    };
  }

  function isOpenForRegistration(tournament) {
    return sbwGetRegistrationAvailability(tournament).open;
  }

  function sbwGetParticipantStatusKey(participant) {
    return String(participant?.status || participant?.registrationStatus || participant?.registration_status || "registered")
      .trim()
      .toLowerCase()
      .replaceAll("-", "_");
  }

  function sbwIsParticipantRemoved(participant) {
    return [
      "removed",
      "cancelled",
      "canceled",
      "disqualified",
      "dq",
      "no_show_removed",
      "registration_cancelled"
    ].includes(sbwGetParticipantStatusKey(participant));
  }

  function sbwGetParticipantStatusInfo(participant) {
    const status = sbwGetParticipantStatusKey(participant);

    if (status === "waitlist" || status === "lista_espera") {
      return {
        className: "waitlist",
        label: "Lista de espera"
      };
    }

    if (status === "confirmed" || status === "approved") {
      return {
        className: "confirmed",
        label: "Confirmado"
      };
    }

    if (sbwIsParticipantRemoved(participant)) {
      return {
        className: "removed",
        label: "Removido"
      };
    }

    return {
      className: "registered",
      label: "Inscrito"
    };
  }

  function sbwGetCheckInStatusInfo(participant) {
    const raw = String(participant?.checkInStatus || participant?.check_in_status || "pending")
      .trim()
      .toLowerCase()
      .replaceAll("-", "_");

    if (participant?.checkedIn || raw === "checked_in" || raw === "confirmed") {
      return {
        className: "checked-in",
        label: "Check-in confirmado",
        icon: "fa-circle-check"
      };
    }

    if (raw === "missed" || raw === "no_show") {
      return {
        className: "missed",
        label: "Check-in perdido",
        icon: "fa-circle-xmark"
      };
    }

    if (raw === "waived") {
      return {
        className: "waived",
        label: "Check-in dispensado",
        icon: "fa-circle-minus"
      };
    }

    return {
      className: "pending",
      label: "Check-in pendente",
      icon: "fa-clock"
    };
  }

  function renderNotFound() {
    root.innerHTML = `
      <section class="not-found-state">
        <div class="not-found-card not-found-card--guided">
          <span class="not-found-eyebrow">Estado seguro</span>
          <h2>Torneio não encontrado</h2>

          <p>
            Não encontramos o torneio solicitado. O link pode estar incompleto,
            o torneio pode estar em rascunho ou a página pública ainda não foi publicada pelo organizador.
          </p>

          <ul class="not-found-checklist">
            <li>Confira se o link público foi copiado completo.</li>
            <li>Peça ao organizador para confirmar se o torneio está publicado ou com inscrições abertas.</li>
            <li>Se o teste estiver começando agora, tente recarregar a página após alguns segundos.</li>
          </ul>

          <div class="not-found-actions">
            <a class="detail-btn" href="torneios.html">Voltar para Torneios</a>
            <a class="detail-btn detail-btn--ghost" href="../index.html">Ir para a Home</a>
          </div>
        </div>
      </section>
    `;
  }

  function sbwGetParticipantMetaItems(participant) {
    const items = [];
    const raw = participant?.raw && typeof participant.raw === "object" ? participant.raw : {};
    const metadata = raw.metadata && typeof raw.metadata === "object" ? raw.metadata : {};

    const playerSlug = participant?.playerSlug || participant?.player_slug || raw.player_slug || "";
    const character = participant?.character || participant?.mainCharacter || metadata.character || metadata.mainCharacter || "";

    if (playerSlug) {
      items.push(`@${playerSlug}`);
    }

    if (character) {
      items.push(character);
    }

    return items;
  }

  function sbwIsParticipantCheckedIn(participant) {
    return sbwGetCheckInStatusInfo(participant).className === "checked-in";
  }

  function sbwGetPublicParticipants(tournament, options = {}) {
    const includeRemoved = Boolean(options.includeRemoved);

    return getParticipants(tournament)
      .filter((participant) => includeRemoved || !sbwIsParticipantRemoved(participant))
      .sort((a, b) => {
        const checkedA = sbwIsParticipantCheckedIn(a) ? 1 : 0;
        const checkedB = sbwIsParticipantCheckedIn(b) ? 1 : 0;

        if (checkedA !== checkedB && options.confirmedFirst) {
          return checkedB - checkedA;
        }

        const seedA = Number(a.seed || 999999);
        const seedB = Number(b.seed || 999999);

        if (seedA !== seedB) {
          return seedA - seedB;
        }

        return String(getPlayerName(a)).localeCompare(String(getPlayerName(b)), "pt-BR");
      });
  }

  function sbwGetParticipantsPublicStats(tournament, availability) {
    const all = getParticipants(tournament);
    const active = all.filter((participant) => !sbwIsParticipantRemoved(participant));
    const checkedIn = active.filter(sbwIsParticipantCheckedIn);
    const pendingCheckIn = active.filter((participant) => {
      const checkIn = sbwGetCheckInStatusInfo(participant).className;
      return checkIn !== "checked-in" && checkIn !== "waived";
    });
    const waitlist = active.filter((participant) => sbwGetParticipantStatusInfo(participant).className === "waitlist");
    const removed = all.filter(sbwIsParticipantRemoved);
    const checkInClosed = sbwIsCheckInClosed(tournament);
    const checkInOpen = sbwIsCheckInOpen(tournament) && !checkInClosed;

    return {
      all,
      active,
      checkedIn,
      pendingCheckIn,
      waitlist,
      removed,
      checkInClosed,
      checkInOpen,
      participantsCount: availability?.participantsCount ?? active.length,
      maxParticipants: availability?.maxParticipants || sbwGetMaxParticipantsNumber(tournament) || null
    };
  }

  function sbwGetParticipantsStageInfo(stats) {
    if (stats.checkInClosed) {
      return {
        className: "closed",
        label: "Check-in encerrado",
        title: "Confirmados em destaque",
        description: "A lista prioriza quem confirmou presença. Inscritos sem check-in aparecem separados para auditoria visual."
      };
    }

    if (stats.checkInOpen) {
      return {
        className: "open",
        label: "Check-in aberto",
        title: "Confirmação em andamento",
        description: "Todos os inscritos aparecem nesta área. Quem confirmar check-in passa a receber destaque visual."
      };
    }

    return {
      className: "waiting",
      label: "Pré check-in",
      title: "Lista de inscritos",
      description: "Antes do fechamento do check-in, a página mostra todos os inscritos reais publicados na plataforma -SBW-."
    };
  }

  function renderParticipantsOverview(tournament, availability) {
    const stats = sbwGetParticipantsPublicStats(tournament, availability);
    const maxLabel = stats.maxParticipants ? stats.maxParticipants : "∞";
    const confirmedLabel = stats.checkedIn.length === 1 ? "confirmado" : "confirmados";
    const pendingLabel = stats.pendingCheckIn.length === 1 ? "pendente" : "pendentes";

    return `
      <div class="participants-overview-grid participants-overview-grid--refined">
        <div class="participants-overview-card">
          <span>Inscritos ativos</span>
          <strong>${escapeHTML(stats.active.length)} / ${escapeHTML(maxLabel)}</strong>
          <small>Participantes válidos para o torneio</small>
        </div>

        <div class="participants-overview-card confirmed">
          <span>Check-in</span>
          <strong>${escapeHTML(stats.checkedIn.length)} ${escapeHTML(confirmedLabel)}</strong>
          <small>Presença confirmada</small>
        </div>

        <div class="participants-overview-card pending">
          <span>Pendências</span>
          <strong>${escapeHTML(stats.pendingCheckIn.length)} ${escapeHTML(pendingLabel)}</strong>
          <small>Aguardando check-in ou revisão</small>
        </div>

        <div class="participants-overview-card ${escapeHTML(availability.className)}">
          <span>Inscrição</span>
          <strong>${escapeHTML(availability.shortLabel)}</strong>
          <small>${escapeHTML(availability.reason || "Status atual da inscrição")}</small>
        </div>
      </div>
    `;
  }

  function renderParticipantsList(participants, options = {}) {
    const emptyTitle = options.emptyTitle || "Nenhum participante publicado ainda";
    const emptyText = options.emptyText || "Quando jogadores confirmarem inscrição pela plataforma -SBW-, eles aparecerão aqui com status, equipe e check-in.";
    const listClass = options.listClass || "";
    const emptyTips = Array.isArray(options.emptyTips) ? options.emptyTips.filter(Boolean) : [];
    const emptyActionHref = options.emptyActionHref || "";
    const emptyActionLabel = options.emptyActionLabel || "";

    if (!Array.isArray(participants) || participants.length === 0) {
      return `
        <div class="participant-empty-state participant-empty-state--guided">
          <div class="participant-empty-icon">
            <i class="fa-solid ${escapeHTML(options.emptyIcon || "fa-user-plus")}"></i>
          </div>
          <div>
            <strong>${escapeHTML(emptyTitle)}</strong>
            <p>${escapeHTML(emptyText)}</p>
            ${emptyTips.length ? `
              <ul>
                ${emptyTips.map((tip) => `<li>${escapeHTML(tip)}</li>`).join("")}
              </ul>
            ` : ""}
            ${emptyActionHref && emptyActionLabel ? `
              <a class="participant-empty-action" href="${escapeHTML(emptyActionHref)}">${escapeHTML(emptyActionLabel)}</a>
            ` : ""}
          </div>
        </div>
      `;
    }

    return `
      <div class="participants-list participants-list--public ${escapeHTML(listClass)}">
        ${participants.map((participant, index) => {
          const checkIn = sbwGetCheckInStatusInfo(participant);
          const participantStatus = sbwGetParticipantStatusInfo(participant);
          const seedLabel = Number(participant.seed) > 0 ? `#${participant.seed}` : `#${index + 1}`;
          const metaItems = sbwGetParticipantMetaItems(participant);
          const teamName = getPlayerTeam(participant);
          const hasTeamName = teamName && teamName !== "Sem equipe";
          const displayName = sbwFormatPlayerDisplayName(participant);

          return `
            <article class="participant-list-row ${escapeHTML(checkIn.className)} ${escapeHTML(participantStatus.className)}">
              <span class="participant-list-seed">${escapeHTML(seedLabel)}</span>

              <div class="participant-list-identity">
                <strong>${escapeHTML(displayName)}</strong>
                ${hasTeamName || metaItems.length > 0 ? `
                  <span>
                    ${hasTeamName ? escapeHTML(teamName) : ""}
                    ${hasTeamName && metaItems.length > 0 ? " · " : ""}
                    ${metaItems.map((item) => escapeHTML(item)).join(" · ")}
                  </span>
                ` : ""}
              </div>

              <span class="participant-list-status ${escapeHTML(checkIn.className)}">
                <i class="fa-solid ${escapeHTML(checkIn.icon)}"></i>
                ${escapeHTML(checkIn.label)}
              </span>

              ${participantStatus.className !== "registered" ? `
                <span class="participant-list-registration ${escapeHTML(participantStatus.className)}">
                  ${escapeHTML(participantStatus.label)}
                </span>
              ` : ""}
            </article>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderParticipants(tournament, options = {}) {
    const onlyCheckedIn = Boolean(options.onlyCheckedIn);
    const participants = sbwGetPublicParticipants(tournament, {
      confirmedFirst: Boolean(options.confirmedFirst || onlyCheckedIn)
    }).filter((participant) => {
      if (onlyCheckedIn) {
        return sbwIsParticipantCheckedIn(participant);
      }

      return true;
    });

    return renderParticipantsList(participants, {
      emptyTitle: onlyCheckedIn ? "Nenhum check-in confirmado ainda" : "Nenhum participante publicado ainda",
      emptyText: onlyCheckedIn
        ? "Depois do fechamento do check-in, esta lista destaca os participantes que confirmaram presença."
        : "Quando jogadores confirmarem inscrição pela plataforma -SBW-, eles aparecerão aqui com status, equipe e check-in.",
      emptyIcon: onlyCheckedIn ? "fa-circle-check" : "fa-user-plus",
      emptyTips: onlyCheckedIn
        ? ["Confirme se a janela de check-in já foi aberta pelo organizador.", "Somente inscritos reais conseguem confirmar presença."]
        : ["Faça login antes de tentar se inscrever.", "Depois da inscrição, acompanhe a janela de check-in."]
    });
  }

  function renderParticipantSection(title, description, participants, options = {}) {
    const count = Array.isArray(participants) ? participants.length : 0;

    return `
      <section class="participants-public-section participants-public-section--list ${escapeHTML(options.className || "")}">
        <div class="participants-public-section-header">
          <div>
            <span>${escapeHTML(options.eyebrow || "Participantes")}</span>
            <h4>${escapeHTML(title)}</h4>
            <p>${escapeHTML(description)}</p>
          </div>
          <strong>${escapeHTML(count)}</strong>
        </div>
        ${renderParticipantsList(participants, {
          emptyTitle: options.emptyTitle,
          emptyText: options.emptyText,
          emptyIcon: options.emptyIcon,
          listClass: options.listClass
        })}
      </section>
    `;
  }

  function renderParticipantsPublicPage(tournament, availability) {
    const stats = sbwGetParticipantsPublicStats(tournament, availability);
    const stage = sbwGetParticipantsStageInfo(stats);
    const sortedActive = sbwGetPublicParticipants(tournament, { confirmedFirst: stats.checkInClosed || stats.checkInOpen });
    const sortedPrimary = sortedActive.filter((participant) => sbwGetParticipantStatusInfo(participant).className !== "waitlist");
    const pendingAfterClose = stats.pendingCheckIn.filter((participant) => {
      return !sbwIsParticipantRemoved(participant) && sbwGetParticipantStatusInfo(participant).className !== "waitlist";
    });

    return `
      <div class="participants-public-panel">
        <div class="participants-stage-card ${escapeHTML(stage.className)}">
          <div>
            <span>${escapeHTML(stage.label)}</span>
            <h4>${escapeHTML(stage.title)}</h4>
            <p>${escapeHTML(stage.description)}</p>
          </div>
          <div class="participants-stage-metrics">
            <b>${escapeHTML(stats.checkedIn.length)}</b>
            <small>check-ins</small>
          </div>
        </div>

        ${renderParticipantsOverview(tournament, availability)}

        ${stats.checkInClosed ? `
          ${renderParticipantSection(
            "Confirmados para jogar",
            "Participantes com check-in confirmado, priorizados após o encerramento do check-in.",
            stats.checkedIn,
            {
              className: "confirmed",
              eyebrow: "Lista principal",
              emptyTitle: "Nenhum participante confirmou check-in",
              emptyText: "Quando houver check-ins confirmados, eles aparecerão como lista principal do torneio.",
              emptyIcon: "fa-circle-check"
            }
          )}

          ${pendingAfterClose.length > 0 ? renderParticipantSection(
            "Inscritos sem confirmação",
            "Lista auxiliar para consulta. Esses participantes não entram como confirmados após o fechamento do check-in.",
            pendingAfterClose,
            {
              className: "pending",
              eyebrow: "Auditoria visual",
              emptyIcon: "fa-clock"
            }
          ) : ""}
        ` : `
          ${renderParticipantSection(
            "Todos os inscritos",
            stats.checkInOpen
              ? "Check-in aberto: todos os inscritos aparecem aqui, com confirmados em destaque."
              : "Antes do fechamento do check-in, todos os inscritos reais aparecem nesta lista.",
            sortedPrimary,
            {
              className: "all",
              eyebrow: "Lista pública",
              emptyTitle: "Nenhum participante inscrito ainda",
              emptyText: "As inscrições reais feitas pela plataforma -SBW- aparecerão aqui.",
              emptyIcon: "fa-user-plus"
            }
          )}
        `}

        ${stats.waitlist.length > 0 ? renderParticipantSection(
          "Lista de espera",
          "Participantes aguardando vaga, quando o torneio usa lista de espera.",
          stats.waitlist,
          {
            className: "waitlist",
            eyebrow: "Fila",
            emptyIcon: "fa-hourglass-half"
          }
        ) : ""}

        ${stats.removed.length > 0 ? renderParticipantSection(
          "Removidos ou cancelados",
          "Registros mantidos apenas para transparência visual quando existirem no histórico carregado.",
          stats.removed,
          {
            className: "removed",
            eyebrow: "Histórico",
            emptyIcon: "fa-user-slash"
          }
        ) : ""}
      </div>
    `;
  }

  function renderLeagueTable(tournament) {
    const standings = getTournamentStandings(tournament);

    if (!Array.isArray(standings) || standings.length === 0) {
      const participants = getParticipants(tournament);

      if (participants.length === 0) {
        return `
          <div class="detail-card">
            <p>
              A tabela da liga será exibida quando o organizador gerar ou lançar os resultados.
            </p>
          </div>
        `;
      }

      return `
        <div class="detail-card">
          <p>
            Participantes inscritos. A classificação será exibida após o lançamento dos resultados.
          </p>
        </div>

        ${renderParticipants(tournament)}
      `;
    }

    return `
      <div class="public-table-wrap">
        <table class="public-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Jogador</th>
              <th>Vitórias</th>
              <th>Derrotas</th>
              <th>Saldo</th>
              <th>Pontos</th>
            </tr>
          </thead>

          <tbody>
            ${standings.map((row, index) => `
              <tr>
                <td><strong>${index + 1}</strong></td>
                <td><strong>${escapeHTML(getPlayerName(row))}</strong></td>
                <td>${escapeHTML(row.wins ?? row.victories ?? 0)}</td>
                <td>${escapeHTML(row.losses ?? row.defeats ?? 0)}</td>
                <td>${escapeHTML(row.scoreDiff ?? row.setDiff ?? row.balance ?? 0)}</td>
                <td><strong>${escapeHTML(row.points ?? 0)}</strong></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

    function getLeagueRounds(tournament) {
    const structure = getTournamentStructure(tournament);

    const rounds =
      structure?.league?.rounds ||
      structure?.rounds ||
      tournament.leagueRounds ||
      tournament.rounds ||
      [];

    if (Array.isArray(rounds) && rounds.length > 0) {
      return rounds;
    }

    const matches =
      structure?.league?.matches ||
      structure?.matches ||
      tournament.leagueMatches ||
      getTournamentMatches(tournament) ||
      [];

    if (Array.isArray(matches) && matches.length > 0) {
      const grouped = {};

      matches.forEach((match) => {
        const roundName =
          match.roundName ||
          match.roundLabel ||
          (match.round ? `Rodada ${match.round}` : "Histórico de partidas");

        if (!grouped[roundName]) {
          grouped[roundName] = [];
        }

        grouped[roundName].push(match);
      });

      return Object.entries(grouped).map(([name, roundMatches]) => ({
        name,
        matches: roundMatches
      }));
    }

    return [];
  }

  function getLeagueMatchPlayer(match, side) {
    if (!match) {
      return null;
    }

    if (side === "A") {
      return match.playerA ||
        match.a ||
        match.home ||
        match.participantA ||
        match.player1 ||
        null;
    }

    return match.playerB ||
      match.b ||
      match.away ||
      match.participantB ||
      match.player2 ||
      null;
  }

  function getLeagueMatchStatus(match) {
    const status = String(match?.status || "").toLowerCase();

    if (
      status === "completed" ||
      status === "finished" ||
      status === "done"
    ) {
      return "completed";
    }

    if (
      match?.scoreA !== null &&
      match?.scoreA !== undefined &&
      match?.scoreB !== null &&
      match?.scoreB !== undefined
    ) {
      return "completed";
    }

    return "pending";
  }

  function renderLeagueRounds(tournament) {
    const rounds = getLeagueRounds(tournament);

    if (!Array.isArray(rounds) || rounds.length === 0) {
      return `
        <div class="detail-card">
          <p>
            As rodadas e partidas da liga serão exibidas quando o organizador gerar a estrutura.
          </p>
        </div>
      `;
    }

    return `
      <div class="league-rounds-public">
        ${rounds.map((round, roundIndex) => {
          const matches = Array.isArray(round.matches)
            ? round.matches
            : [];
          const byes = Array.isArray(round.byes)
            ? round.byes
            : (Array.isArray(round.byeTeams) ? round.byeTeams : []);

          return `
            <div class="league-round-card">
              <h4>${escapeHTML(round.name || round.label || `Rodada ${roundIndex + 1}`)}</h4>

              <div class="league-match-list">
                ${
                  matches.length > 0
                    ? matches.map((match) => {
                      const playerA = getLeagueMatchPlayer(match, "A");
                      const playerB = getLeagueMatchPlayer(match, "B");
                      const status = getMatchPublicStatus(match);
                      const schedule = window.SBWTeamBattleLeague && typeof window.SBWTeamBattleLeague.normalizeMatchSchedule === "function"
                        ? window.SBWTeamBattleLeague.normalizeMatchSchedule(match, { leagueMode: "basic_single_division" })
                        : null;
                      const winnerSide = getMatchWinnerSide(match);
                      const scoreA = getMatchScore(match, "scoreA");
                      const scoreB = getMatchScore(match, "scoreB");

                      return `
                        <div class="league-match-row ${status.className}">
                          <strong class="${winnerSide === "A" ? "winner" : ""}">${escapeHTML(getPlayerName(playerA))}</strong>

                          <span class="league-match-score">
                            ${escapeHTML(scoreA)} x ${escapeHTML(scoreB)}
                          </span>

                          <strong class="player-b ${winnerSide === "B" ? "winner" : ""}">${escapeHTML(getPlayerName(playerB))}</strong>

                          <span class="league-match-status-pill ${status.className}">${escapeHTML(status.label)}</span>
                          ${schedule ? `<small class="league-match-schedule-pill">${escapeHTML(schedule.label || schedule.statusLabel || "Data a definir pelo organizador")}</small>` : ""}
                        </div>
                      `;
                    }).join("")
                    : `
                      <div class="league-match-row">
                        <strong>Partidas a definir</strong>
                        <span class="league-match-score">-</span>
                        <strong class="player-b">Aguardando</strong>
                      </div>
                    `
                }
                ${byes.length ? byes.map((bye) => `
                  <div class="league-match-row bye">
                    <strong>${escapeHTML(bye.teamLabel || bye.teamName || bye.name || "Equipe em folga")}</strong>
                    <span class="league-match-score">folga</span>
                    <strong class="player-b">Sem adversário fake</strong>
                    <span class="league-match-status-pill bye">Folga técnica</span>
                  </div>
                `).join("") : ""}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function getAdvancePerGroup(tournament, groupCount) {
    const directValue =
      tournament.advancePerGroup ||
      tournament.qualifiedPerGroup ||
      tournament.playoffAdvancePerGroup ||
      tournament.groupConfig?.advancePerGroup ||
      tournament.groupsConfig?.advancePerGroup ||
      tournament.structure?.advancePerGroup;

    if (Number(directValue) > 0) {
      return Number(directValue);
    }

    const totalQualified =
      tournament.playoffQualifiedTotal ||
      tournament.qualifiedTotal ||
      tournament.totalQualified ||
      tournament.structure?.playoffQualifiedTotal ||
      tournament.structure?.playoffs?.totalQualified;

    if (Number(totalQualified) > 0 && Number(groupCount) > 0) {
      return Math.floor(Number(totalQualified) / Number(groupCount));
    }

    return 0;
  }

  function renderGroups(tournament) {
    const structure = getTournamentStructure(tournament);

    const groups =
      structure?.groups ||
      tournament.groups ||
      [];

    if (!Array.isArray(groups) || groups.length === 0) {
      return `
        <div class="detail-card">
          <p>
            Os grupos serão exibidos quando a estrutura do torneio for gerada pelo organizador.
          </p>
        </div>
      `;
    }

    const advancePerGroup = getAdvancePerGroup(tournament, groups.length);

    return `
      <div class="groups-public-grid">
        ${groups.map((group, groupIndex) => {
          const rows = group.standings || group.players || group.participants || [];

          return `
            <div class="public-group-card">
              <h4>${escapeHTML(group.name || group.label || `Grupo ${String.fromCharCode(65 + groupIndex)}`)}</h4>

              ${
                rows.length > 0
                  ? rows.map((player, index) => `
                    <div class="public-group-player ${advancePerGroup > 0 && index < advancePerGroup ? "qualified" : ""}">
                      <strong>${index + 1}. ${escapeHTML(getPlayerName(player))}</strong>
                      <span>${player.points !== undefined ? `${escapeHTML(player.points)} pts` : ""}</span>
                    </div>
                  `).join("")
                  : `
                    <div class="public-group-player">
                      <strong>Participantes a definir</strong>
                      <span>-</span>
                    </div>
                  `
              }
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

    function getHistoryPlayer(match, side) {
    if (!match) {
      return null;
    }

    if (side === "A") {
      return match.playerA ||
        match.a ||
        match.home ||
        match.participantA ||
        match.player1 ||
        match.teamA ||
        match.players?.[0] ||
        match.participants?.[0] ||
        null;
    }

    return match.playerB ||
      match.b ||
      match.away ||
      match.participantB ||
      match.player2 ||
      match.teamB ||
      match.players?.[1] ||
      match.participants?.[1] ||
      null;
  }

  function getHistoryMatchStatus(match) {
    const status = String(match?.status || "").toLowerCase();

    if (
      status === "completed" ||
      status === "finished" ||
      status === "done"
    ) {
      return "completed";
    }

    if (
      match?.scoreA !== null &&
      match?.scoreA !== undefined &&
      match?.scoreB !== null &&
      match?.scoreB !== undefined
    ) {
      return "completed";
    }

    return "pending";
  }

  function getHistoryRoundsFromGroups(tournament) {
    const structure = getTournamentStructure(tournament);

    const groups =
      structure?.groups ||
      tournament.groups ||
      [];

    if (!Array.isArray(groups) || groups.length === 0) {
      return [];
    }

    const historyRounds = [];

    groups.forEach((group, groupIndex) => {
      const groupName =
        group.name ||
        group.label ||
        `Grupo ${String.fromCharCode(65 + groupIndex)}`;

      if (Array.isArray(group.rounds) && group.rounds.length > 0) {
        group.rounds.forEach((round, roundIndex) => {
          historyRounds.push({
            name: `${groupName} — ${round.name || round.label || `Rodada ${roundIndex + 1}`}`,
            matches: Array.isArray(round.matches) ? round.matches : []
          });
        });
      }

      if (Array.isArray(group.matches) && group.matches.length > 0) {
        historyRounds.push({
          name: `${groupName} — partidas`,
          matches: group.matches
        });
      }
    });

    return historyRounds.filter((round) => {
      return Array.isArray(round.matches) && round.matches.length > 0;
    });
  }

  function getHistoryRoundsFromLeague(tournament) {
    const structure = getTournamentStructure(tournament);

    const rounds =
      structure?.league?.rounds ||
      structure?.rounds ||
      tournament.leagueRounds ||
      tournament.rounds ||
      [];

    if (Array.isArray(rounds) && rounds.length > 0) {
      return rounds;
    }

    const matches =
      structure?.league?.matches ||
      structure?.matches ||
      tournament.leagueMatches ||
      getTournamentMatches(tournament) ||
      [];

    if (Array.isArray(matches) && matches.length > 0) {
      return [
        {
          name: "Histórico de partidas",
          matches
        }
      ];
    }

    return [];
  }

  function renderHistoryRounds(rounds) {
    return `
      <div class="league-rounds-public">
        ${rounds.map((round, roundIndex) => {
          const matches = Array.isArray(round.matches)
            ? round.matches
            : [];

          return `
            <div class="league-round-card">
              <h4>${escapeHTML(round.name || round.label || `Rodada ${roundIndex + 1}`)}</h4>

              <div class="league-match-list">
                ${matches.map((match) => {
                  const playerA = getHistoryPlayer(match, "A");
                  const playerB = getHistoryPlayer(match, "B");
                  const status = getMatchPublicStatus(match);
                  const winnerSide = getMatchWinnerSide(match);
                  const scoreA = getMatchScore(match, "scoreA");
                  const scoreB = getMatchScore(match, "scoreB");

                  return `
                    <div class="league-match-row ${status.className}">
                      <strong class="${winnerSide === "A" ? "winner" : ""}">${escapeHTML(getPlayerName(playerA))}</strong>

                      <span class="league-match-score">
                        ${escapeHTML(scoreA)} x ${escapeHTML(scoreB)}
                      </span>

                      <strong class="player-b ${winnerSide === "B" ? "winner" : ""}">${escapeHTML(getPlayerName(playerB))}</strong>

                      <span class="league-match-status-pill ${status.className}">${escapeHTML(status.label)}</span>
                    </div>
                  `;
                }).join("")}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderCollapsedMatchHistory(title, rounds) {
    if (!Array.isArray(rounds) || rounds.length === 0) {
      return "";
    }

    const totalMatches = rounds.reduce((total, round) => {
      return total + (Array.isArray(round.matches) ? round.matches.length : 0);
    }, 0);

    return `
      <details class="match-history-accordion">
        <summary>
          ${escapeHTML(title)} — ${totalMatches} partida${totalMatches === 1 ? "" : "s"}
        </summary>

        <div class="match-history-body">
          ${renderHistoryRounds(rounds)}
        </div>
      </details>
    `;
  }

  function renderGroupPhaseHistory(tournament) {
    return renderCollapsedMatchHistory(
      "Ver histórico da fase de grupos",
      getHistoryRoundsFromGroups(tournament)
    );
  }

  function renderLeagueHistory(tournament) {
    return renderCollapsedMatchHistory(
      "Ver histórico de partidas da liga",
      getHistoryRoundsFromLeague(tournament)
    );
  }

  function isMatchWinner(match, player) {
    if (!match || !player) {
      return false;
    }

    if (match.winnerId && player.id) {
      return String(match.winnerId) === String(player.id);
    }

    const scoreA = Number(match.scoreA);
    const scoreB = Number(match.scoreB);

    if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) {
      return false;
    }

    return false;
  }

  function sbwGetCurrentUserBracketKeys() {
    const keys = new Set();

    [
      sbwCurrentDetailAuthUser?.id,
      sbwCurrentDetailAuthUser?.email,
      sbwCurrentDetailProfile?.id,
      sbwCurrentDetailProfile?.auth_user_id,
      sbwCurrentDetailProfile?.authUserId,
      sbwCurrentDetailProfile?.slug,
      sbwCurrentDetailProfile?.username,
      sbwCurrentDetailProfile?.nickname,
      sbwCurrentDetailProfile?.display_name,
      sbwCurrentDetailProfile?.displayName
    ].forEach((value) => {
      if (value) {
        keys.add(String(value).trim().toLowerCase());
      }
    });

    return keys;
  }

  function sbwGetBracketEntityName(entity) {
    return getPlayerName(entity);
  }

  function sbwGetBracketEntityLogoLabel(entity) {
    const name = sbwGetBracketEntityName(entity);
    const words = String(name || "").trim().split(/\s+/).filter(Boolean);

    if (entity?.tag || entity?.shortName || entity?.abbr || entity?.code) {
      return String(entity.tag || entity.shortName || entity.abbr || entity.code).slice(0, 4).toUpperCase();
    }

    if (words.length >= 2) {
      return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
    }

    return String(name || "?").slice(0, 3).toUpperCase();
  }

  function sbwGetBracketEntityShortName(entity) {
    const name = sbwGetBracketEntityName(entity);

    if (entity?.tag || entity?.shortName || entity?.abbr || entity?.code) {
      return String(entity.tag || entity.shortName || entity.abbr || entity.code).slice(0, 5).toUpperCase();
    }

    return sbwGetBracketEntityLogoLabel(entity);
  }

  function sbwGetBracketEntitySearchText(entity) {
    if (!entity) {
      return "";
    }

    return [
      entity.id,
      entity.profileId,
      entity.profile_id,
      entity.playerSlug,
      entity.player_slug,
      entity.slug,
      entity.nickname,
      entity.name,
      entity.playerName,
      entity.displayName,
      entity.display_name,
      entity.team,
      entity.organization,
      entity.club,
      entity.tag,
      entity.shortName,
      entity.abbr,
      entity.code
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function sbwIsCurrentUserBracketEntity(entity) {
    if (!entity) {
      return false;
    }

    const keys = sbwGetCurrentUserBracketKeys();

    if (keys.size === 0) {
      return false;
    }

    const candidates = [
      entity.id,
      entity.profileId,
      entity.profile_id,
      entity.userId,
      entity.user_id,
      entity.authUserId,
      entity.auth_user_id,
      entity.playerSlug,
      entity.player_slug,
      entity.slug,
      entity.nickname,
      entity.name,
      entity.playerName,
      entity.displayName,
      entity.display_name,
      entity.email
    ].filter(Boolean).map((value) => String(value).trim().toLowerCase());

    return candidates.some((candidate) => keys.has(candidate));
  }

  function sbwGetRoundShortLabel(round, roundIndex, totalRounds, mode = "default") {
    const raw = String(round?.shortLabel || round?.abbr || round?.stage || round?.name || round?.label || "").toLowerCase();

    if (raw.includes("champ") || raw.includes("campe")) {
      return "🏆";
    }

    if (raw.includes("final")) {
      return "F";
    }

    if (raw.includes("semi") || raw.includes("sf")) {
      return "SF";
    }

    if (raw.includes("quarta") || raw.includes("quarter") || raw.includes("qf")) {
      return "QF";
    }

    const remaining = Math.max(totalRounds - roundIndex, 1);

    if (mode === "bottom-up") {
      if (roundIndex === totalRounds - 1) return "F";
      if (roundIndex === totalRounds - 2) return "SF";
      if (roundIndex === totalRounds - 3) return "QF";
    }

    const matchCount = Array.isArray(round?.matches) ? round.matches.length : 0;
    const slots = Math.max(matchCount * 2, Math.pow(2, remaining));

    if (slots >= 32) return "R32";
    if (slots >= 16) return "R16";
    if (slots >= 8) return "QF";
    if (slots >= 4) return "SF";

    return roundIndex === totalRounds - 1 ? "F" : `R${roundIndex + 1}`;
  }

  function sbwGetRoundName(round, roundIndex, totalRounds) {
    return round?.name || round?.label || round?.title || `Rodada ${roundIndex + 1} / ${totalRounds}`;
  }

  function sbwGetMatchSearchText(match) {
    return [
      sbwGetBracketEntitySearchText(getMatchPlayer(match, "A")),
      sbwGetBracketEntitySearchText(getMatchPlayer(match, "B")),
      match?.name,
      match?.label,
      match?.roundName,
      match?.status
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function renderBracketCompetitor(player, options = {}) {
    const winner = Boolean(options.winner);
    const score = options.score === null || options.score === undefined || options.score === "" ? "-" : options.score;
    const seed = options.seed;
    const empty = !player;
    const isCurrentUser = !empty && sbwIsCurrentUserBracketEntity(player);
    const name = empty ? "A definir" : sbwGetBracketEntityName(player);
    const logo = empty ? "—" : sbwGetBracketEntityLogoLabel(player);
    const searchText = empty ? "" : sbwGetBracketEntitySearchText(player);
    const seedLabel = seed ? String(seed) : "";

    return `
      <div
        class="sbw-bracket-team ${winner ? "is-winner" : ""} ${isCurrentUser ? "is-current-user" : ""} ${empty ? "is-empty" : ""}"
        data-bracket-search-text="${escapeHTML(searchText)}"
        title="${escapeHTML(name)}"
      >
        <span class="sbw-bracket-team-seed">${escapeHTML(seedLabel)}</span>
        <span class="sbw-bracket-team-logo">${escapeHTML(logo)}</span>
        <span class="sbw-bracket-team-name">${escapeHTML(name)}</span>
        ${isCurrentUser ? `<span class="sbw-bracket-you-badge">Você</span>` : ""}
        <strong class="sbw-bracket-score">${escapeHTML(score)}</strong>
      </div>
    `;
  }

  function renderMatch(match, options = {}) {
    const playerA = getMatchPlayer(match, "A");
    const playerB = getMatchPlayer(match, "B");
    const scoreA = getMatchScore(match, "scoreA");
    const scoreB = getMatchScore(match, "scoreB");
    const status = getMatchPublicStatus(match);
    const winnerSide = getMatchWinnerSide(match);
    const winnerName = getMatchWinnerName(match);
    const phaseLabel = options.phaseLabel || match?.roundName || match?.roundLabel || match?.name || "Partida";
    const searchText = sbwGetMatchSearchText(match);
    const seedA = match?.seedA || match?.seed_a || playerA?.seed || "";
    const seedB = match?.seedB || match?.seed_b || playerB?.seed || "";
    const laneKey = options.laneKey || "bracket";
    const roundIndex = Number.isFinite(Number(options.roundIndex)) ? Number(options.roundIndex) : 0;
    const matchIndex = Number.isFinite(Number(options.matchIndex)) ? Number(options.matchIndex) : 0;
    const showHeader = Boolean(options.showHeader);

    return `
      <article
        class="sbw-bracket-match ${status.className} ${winnerName ? "has-winner" : ""}"
        data-bracket-match
        data-bracket-lane-key="${escapeHTML(laneKey)}"
        data-bracket-round-index="${escapeHTML(roundIndex)}"
        data-bracket-match-index="${escapeHTML(matchIndex)}"
        data-bracket-search-text="${escapeHTML(searchText)}"
      >
        ${showHeader ? `
          <header class="sbw-bracket-match-head">
            <span>${escapeHTML(phaseLabel)}</span>
            <em>${escapeHTML(match?.bestOf || match?.format || match?.matchFormat || "BO3")}</em>
          </header>
        ` : ""}
        ${renderBracketCompetitor(playerA, { winner: winnerSide === "A", score: scoreA, seed: seedA })}
        ${renderBracketCompetitor(playerB, { winner: winnerSide === "B", score: scoreB, seed: seedB })}
        <footer class="sbw-bracket-match-foot">
          <span class="sbw-bracket-status ${status.className}">${escapeHTML(status.label)}</span>
          ${winnerName ? `<span>Vencedor: ${escapeHTML(winnerName)}</span>` : `<span>Aguardando</span>`}
        </footer>
      </article>
    `;
  }


  function sbwNormalizeParticipantForBracket(participant, index = 0) {
    if (!participant) {
      return null;
    }

    const raw = participant?.raw && typeof participant.raw === "object" ? participant.raw : {};
    const metadata = raw.metadata && typeof raw.metadata === "object" ? raw.metadata : {};
    const name = getPlayerName(participant);

    return {
      ...participant,
      id: participant.id || participant.profileId || participant.profile_id || raw.id || `participant-${index + 1}`,
      seed: Number(participant.seed || participant.position || index + 1),
      nickname: name,
      name,
      team: getPlayerTeam(participant),
      logoLabel: participant.logoLabel || participant.acronym || participant.tag || metadata.acronym || ""
    };
  }

  function sbwIsBracketParticipantActive(participant) {
    const status = String(participant?.status || "registered").trim().toLowerCase().replaceAll("-", "_");
    return !["removed", "cancelled", "canceled", "disqualified"].includes(status);
  }

  function sbwShouldRevealBracketParticipants(tournament) {
    return sbwIsCheckInClosed(tournament);
  }

  function sbwGetConfirmedParticipantsForBracket(tournament) {
    if (!sbwShouldRevealBracketParticipants(tournament)) {
      return [];
    }

    return getParticipants(tournament)
      .filter((participant) => sbwIsBracketParticipantActive(participant))
      .filter((participant) => sbwGetCheckInStatusInfo(participant).className === "checked-in")
      .map((participant, index) => sbwNormalizeParticipantForBracket(participant, index))
      .sort((a, b) => {
        const seedA = Number(a.seed || 999999);
        const seedB = Number(b.seed || 999999);

        if (seedA !== seedB) {
          return seedA - seedB;
        }

        return String(getPlayerName(a)).localeCompare(String(getPlayerName(b)), "pt-BR");
      });
  }

  function sbwGetBracketSizeForTournament(tournament, minimum = 16) {
    const participants = sbwGetConfirmedParticipantsForBracket(tournament);
    let size = minimum;

    while (participants.length > size) {
      size *= 2;
    }

    return size;
  }

  function sbwBuildBracketSeedOrder(size) {
    if (size <= 2) {
      return [1, 2];
    }

    const previous = sbwBuildBracketSeedOrder(size / 2);
    return previous.flatMap((seed) => [seed, size + 1 - seed]);
  }

  function sbwGetOpeningRoundLabelBySize(size) {
    if (size >= 64) return "R64";
    if (size >= 32) return "R32";
    if (size >= 16) return "R16";
    if (size >= 8) return "QF";
    if (size >= 4) return "SF";
    return "F";
  }

  function sbwGetGeneratedRoundLabels(size) {
    const labels = [];
    let current = size;

    while (current >= 2) {
      labels.push(sbwGetOpeningRoundLabelBySize(current));
      current = current / 2;
    }

    return labels;
  }

  function sbwBuildBracketSlotMap(tournament, size) {
    const participants = sbwGetConfirmedParticipantsForBracket(tournament);
    const map = new Map();

    participants.slice(0, size).forEach((participant, index) => {
      const seed = Number(participant.seed || index + 1);
      const safeSeed = Number.isFinite(seed) && seed >= 1 && seed <= size ? seed : index + 1;
      map.set(safeSeed, participant);
    });

    return map;
  }

  function sbwBuildPlaceholderOpeningMatches(tournament, options = {}) {
    const size = Number(options.size || sbwGetBracketSizeForTournament(tournament, 16));
    const branch = options.branch || "winners";
    const revealParticipants = Boolean(options.revealParticipants ?? true);
    const slotMap = revealParticipants ? sbwBuildBracketSlotMap(tournament, size) : new Map();
    const seedOrder = sbwBuildBracketSeedOrder(size);
    const roundLabel = options.roundLabel || sbwGetOpeningRoundLabelBySize(size);

    return Array.from({ length: size / 2 }, (_, index) => {
      const seedA = seedOrder[index * 2];
      const seedB = seedOrder[index * 2 + 1];

      return {
        id: `${branch}-${roundLabel}-${index + 1}`,
        name: `${roundLabel}-${index + 1}`,
        roundName: roundLabel,
        roundLabel,
        bestOf: options.bestOf || "BO3",
        status: "pending",
        playerA: slotMap.get(seedA) || null,
        playerB: slotMap.get(seedB) || null,
        seedA,
        seedB
      };
    });
  }

  function sbwBuildPlaceholderRounds(tournament, options = {}) {
    const size = Number(options.size || sbwGetBracketSizeForTournament(tournament, 16));
    const branch = options.branch || "winners";
    const labels = sbwGetGeneratedRoundLabels(size);

    return labels.map((label, roundIndex) => {
      const roundSize = Math.max(2, size / Math.pow(2, roundIndex));
      const matchesCount = Math.max(1, roundSize / 2);
      const isOpening = roundIndex === 0;

      return {
        name: label === "R16" ? "Oitavas" : label === "R32" ? "Fase inicial" : label === "QF" ? "Quartas" : label === "SF" ? "Semifinal" : "Final",
        label,
        matches: isOpening
          ? sbwBuildPlaceholderOpeningMatches(tournament, {
              size,
              branch,
              roundLabel: label,
              revealParticipants: options.revealParticipants !== false,
              bestOf: label === "F" ? "BO5" : "BO3"
            })
          : Array.from({ length: matchesCount }, (_, index) => ({
              id: `${branch}-${label}-${index + 1}`,
              name: `${label}-${index + 1}`,
              roundName: label,
              roundLabel: label,
              bestOf: label === "F" ? "BO5" : "BO3",
              status: "pending",
              playerA: null,
              playerB: null
            }))
      };
    });
  }

  function sbwBuildPlaceholderLowerRounds(tournament, options = {}) {
    const size = Number(options.size || sbwGetBracketSizeForTournament(tournament, 16));
    const roundsCount = Math.max(1, Math.ceil(Math.log2(Math.max(size, 2))) * 2 - 2);

    return Array.from({ length: roundsCount }, (_, roundIndex) => {
      const matchesCount = Math.max(1, Math.floor(size / (4 * Math.pow(2, Math.floor(roundIndex / 2)))));
      const isLast = roundIndex === roundsCount - 1;
      const isSemi = roundIndex === roundsCount - 2;
      const isQuarter = roundIndex === roundsCount - 3;
      const label = isLast ? "LF" : isSemi ? "LSF" : isQuarter ? "LQF" : `LR${roundIndex + 1}`;
      const name = isLast ? "Lower Final" : isSemi ? "Lower Semi-Final" : isQuarter ? "Lower Quarter" : `Lower Round ${roundIndex + 1}`;

      return {
        name,
        label,
        matches: Array.from({ length: matchesCount }, (_, index) => ({
          id: `lower-${label}-${index + 1}`,
          name: `${label}-${index + 1}`,
          roundName: label,
          roundLabel: label,
          bestOf: isLast || isSemi || isQuarter ? "BO3" : "BO1",
          status: "pending",
          playerA: null,
          playerB: null
        }))
      };
    });
  }

  function sbwRenderBracketNotice(tournament) {
    const reveal = sbwShouldRevealBracketParticipants(tournament);
    const confirmed = sbwGetConfirmedParticipantsForBracket(tournament).length;
    const active = getParticipants(tournament).filter((participant) => sbwIsBracketParticipantActive(participant)).length;

    return `
      <div class="sbw-bracket-readiness-note ${reveal ? "is-closed" : "is-open"}">
        <i class="fa-solid ${reveal ? "fa-circle-check" : "fa-clock"}"></i>
        <div>
          <strong>${reveal ? "Check-in fechado" : "Bracket em preparação"}</strong>
          <p>${reveal
            ? `A chave usa os ${confirmed} participante${confirmed === 1 ? "" : "s"} com check-in confirmado.`
            : `A chave já fica visível, mas os nomes entram após o fechamento do check-in. Inscritos atuais: ${active}.`
          }</p>
        </div>
      </div>
    `;
  }

  function sbwNormalizeBracketRounds(rounds) {
    if (!Array.isArray(rounds)) {
      return [];
    }

    return rounds.map((round, index) => ({
      ...round,
      name: round?.name || round?.label || round?.title || `Rodada ${index + 1}`,
      matches: Array.isArray(round?.matches) ? round.matches : []
    })).filter((round) => Array.isArray(round.matches));
  }

  function sbwGetPlayoffRounds(tournament) {
    const structure = getTournamentStructure(tournament);
    const playoffs = structure?.playoffs || tournament?.playoffs || structure?.bracket || tournament?.bracket || null;

    if (Array.isArray(playoffs?.rounds)) {
      return sbwNormalizeBracketRounds(playoffs.rounds);
    }

    if (Array.isArray(playoffs?.sides) && playoffs.sides.length > 0) {
      const firstSideRounds = playoffs.sides[0]?.rounds;

      if (Array.isArray(firstSideRounds)) {
        return sbwNormalizeBracketRounds(firstSideRounds);
      }
    }

    if (Array.isArray(structure?.rounds)) {
      return sbwNormalizeBracketRounds(structure.rounds);
    }

    return [];
  }

  function sbwGetAllBracketMatches(rounds = []) {
    return rounds.flatMap((round) => Array.isArray(round.matches) ? round.matches : []);
  }

  function renderBracketEmptyState(title, description) {
    return `
      <div class="sbw-bracket-empty-state">
        <div class="sbw-bracket-empty-icon">
          <i class="fa-solid fa-code-branch"></i>
        </div>
        <div>
          <strong>${escapeHTML(title)}</strong>
          <p>${escapeHTML(description)}</p>
        </div>
      </div>
    `;
  }

  function renderBracketControls() {
    return `
      <div class="sbw-bracket-controls" data-bracket-controls>
        <button type="button" data-bracket-control="reset" title="Voltar ao início da bracket"><i class="fa-solid fa-crosshairs"></i></button>
        <button type="button" data-bracket-control="zoom-out" title="Diminuir zoom">−</button>
        <span data-bracket-zoom-label>100%</span>
        <button type="button" data-bracket-control="zoom-in" title="Aumentar zoom">+</button>
        <em>Use a rolagem horizontal e vertical da área da chave</em>
      </div>
    `;
  }

  function renderBracketShell(options = {}) {
    const title = options.title || "Chave do torneio";
    const subtitle = options.subtitle || "Estrutura competitiva publicada pela plataforma -SBW-.";
    const rightRail = options.rightRail || "";
    const content = options.content || "";
    const chips = Array.isArray(options.chips) ? options.chips : [];

    const hasRightRail = Boolean(String(rightRail || "").trim());

    return `
      <div class="sbw-bracket-layout ${options.modeClass || ""} ${hasRightRail ? "has-side-panel" : "is-full-width"}" data-bracket-layout>
        <div class="sbw-bracket-main-panel">
          <div class="sbw-bracket-toolbar">
            <div>
              <span class="sbw-bracket-eyebrow">${escapeHTML(options.eyebrow || "Chaves")}</span>
              <h4>${escapeHTML(title)}</h4>
              <p>${escapeHTML(subtitle)}</p>
            </div>
            <label class="sbw-bracket-search">
              <i class="fa-solid fa-magnifying-glass"></i>
              <input type="search" placeholder="Buscar equipe ou jogador..." data-bracket-search>
            </label>
          </div>

          ${chips.length > 0 ? `
            <div class="sbw-bracket-focus-chips">
              ${chips.map((chip, index) => `
                <button type="button" data-bracket-focus="${escapeHTML(chip.value || "all")}" class="${index === 0 ? "active" : ""}">
                  ${escapeHTML(chip.label || chip.value || "Visão")}
                </button>
              `).join("")}
            </div>
          ` : ""}

          <div class="sbw-bracket-viewport" data-bracket-viewport>
            <div class="sbw-bracket-canvas" data-bracket-canvas>
              <svg class="sbw-bracket-connectors" data-bracket-connectors aria-hidden="true"></svg>
              ${content}
            </div>
          </div>

          ${renderBracketControls()}
        </div>

        ${hasRightRail ? `
          <aside class="sbw-bracket-side-panel">
            ${rightRail}
          </aside>
        ` : ""}
      </div>
    `;
  }

  function renderBracketSideRail(tournament, matches = [], options = {}) {
    const completedMatches = matches.filter((match) => getMatchPublicStatus(match).className === "completed").slice(-3).reverse();
    const pendingMatch = matches.find((match) => ["pending", "live"].includes(getMatchPublicStatus(match).className));
    const description = getDescription(tournament);

    return `
      <div class="sbw-bracket-info-card">
        <span>Sobre o torneio</span>
        <p>${escapeHTML(description || "A estrutura pública será atualizada conforme o organizador lançar resultados na plataforma -SBW-.")}</p>
        <a href="#regras">Ver regras completas <i class="fa-solid fa-arrow-right"></i></a>
      </div>

      <div class="sbw-bracket-info-card">
        <span>Legenda</span>
        <div class="sbw-bracket-legend">
          <b><i class="line win"></i> Vitória</b>
          <b><i class="line pending"></i> Pendente</b>
          <b><i class="badge-you">Você</i> usuário logado</b>
          <b><i class="bo">BO</i> Melhor de (n)</b>
        </div>
      </div>

      <div class="sbw-bracket-info-card">
        <span>${escapeHTML(options.nextTitle || "Próxima partida")}</span>
        ${pendingMatch ? `
          <strong>${escapeHTML(getPlayerName(getMatchPlayer(pendingMatch, "A")))} vs ${escapeHTML(getPlayerName(getMatchPlayer(pendingMatch, "B")))}</strong>
          <p>${escapeHTML(pendingMatch.roundName || pendingMatch.roundLabel || pendingMatch.name || "Fase atual")}</p>
        ` : `
          <strong>A definir</strong>
          <p>As próximas partidas aparecerão quando a estrutura avançar.</p>
        `}
      </div>

      <div class="sbw-bracket-info-card">
        <span>Últimos resultados</span>
        ${completedMatches.length > 0 ? `
          <div class="sbw-bracket-results-list">
            ${completedMatches.map((match) => `
              <div>
                <strong>${escapeHTML(getPlayerName(getMatchPlayer(match, "A")))}</strong>
                <b>${escapeHTML(getMatchScore(match, "scoreA"))} - ${escapeHTML(getMatchScore(match, "scoreB"))}</b>
                <strong>${escapeHTML(getPlayerName(getMatchPlayer(match, "B")))}</strong>
              </div>
            `).join("")}
          </div>
        ` : `<p>Nenhum resultado público registrado ainda.</p>`}
      </div>
    `;
  }

  function sbwGetStructureRoundList(structure, keys = []) {
    if (!structure || typeof structure !== "object") {
      return [];
    }

    for (const key of keys) {
      const value = key.split(".").reduce((current, part) => current && current[part], structure);

      if (Array.isArray(value) && value.length > 0) {
        return sbwNormalizeBracketRounds(value);
      }
    }

    return [];
  }

  function sbwGetWinnersRoundsFromStructure(structure) {
    return sbwGetStructureRoundList(structure, [
      "winnersBracket",
      "winners_bracket",
      "winnerBracket",
      "winner_bracket",
      "winners.rounds",
      "winner.rounds",
      "upperBracket",
      "upper_bracket",
      "upper.rounds"
    ]);
  }

  function sbwGetLowerRoundsFromStructure(structure) {
    return sbwGetStructureRoundList(structure, [
      "losersBracket",
      "losers_bracket",
      "lowerBracket",
      "lower_bracket",
      "losers.rounds",
      "lower.rounds",
      "lowerBracketRounds"
    ]);
  }

  function sbwGetGrandFinalRoundsFromStructure(structure) {
    const rounds = sbwGetStructureRoundList(structure, [
      "grandFinal.rounds",
      "grand_final.rounds",
      "finals.rounds",
      "grandFinalRounds"
    ]);

    if (rounds.length > 0) {
      return rounds;
    }

    const finalMatch = structure?.grandFinal?.match || structure?.grand_final?.match || structure?.grandFinal || structure?.final;

    if (finalMatch && !Array.isArray(finalMatch)) {
      return [{ name: "Grand Final", label: "GF", matches: [finalMatch] }];
    }

    return [];
  }

  function sbwGetSingleEliminationRounds(tournament) {
    const structure = getTournamentStructure(tournament);
    const directRounds = sbwGetPlayoffRounds(tournament);

    if (directRounds.length > 0) {
      return directRounds;
    }

    return sbwGetStructureRoundList(structure, [
      "bracket.rounds",
      "singleElimination.rounds",
      "single_elimination.rounds",
      "playoff.rounds",
      "rounds"
    ]);
  }

  function sbwGetBracketRoundFormat(round) {
    const direct = round?.bestOf || round?.format || round?.matchFormat || round?.match_format;

    if (direct) {
      return String(direct).toUpperCase();
    }

    const matches = Array.isArray(round?.matches) ? round.matches : [];
    const sample = matches.find((match) => match?.bestOf || match?.format || match?.matchFormat || match?.match_format);
    const value = sample?.bestOf || sample?.format || sample?.matchFormat || sample?.match_format;

    return String(value || "BO3").toUpperCase();
  }

  function sbwGetBracketRoundHeader(round, roundIndex, totalRounds, options = {}) {
    const format = sbwGetBracketRoundFormat(round);
    const laneKey = String(options.laneKey || "").toLowerCase();
    const raw = String(round?.name || round?.label || round?.title || "").trim();
    const rawUpper = raw.toUpperCase();
    const isLast = roundIndex === totalRounds - 1;
    const isSemi = roundIndex === totalRounds - 2;

    if (laneKey.includes("winners") && isLast) {
      return `WINNERS FINAL (${format})`;
    }

    if (laneKey.includes("winners") && isSemi) {
      return `WINNERS SEMI-FINAL (${format})`;
    }

    if (laneKey.includes("lower") && isLast) {
      return `LOWER FINAL (${format})`;
    }

    if (laneKey.includes("lower") && isSemi) {
      return `LOWER SEMI-FINAL (${format})`;
    }

    if (rawUpper.includes("GRAND")) {
      return `GRAND FINAL (${format})`;
    }

    return `ROUND ${roundIndex + 1} (${format})`;
  }

  function renderBracketLane(title, subtitle, rounds, options = {}) {
    const normalizedRounds = sbwNormalizeBracketRounds(rounds);
    const focus = options.focus || "all";
    const laneClass = options.className || "";
    const laneKey = options.laneKey || focus || "bracket";
    const fallback = options.fallback || "As partidas serão exibidas quando a estrutura avançar.";

    return `
      <section class="sbw-bracket-lane ${laneClass}" data-bracket-lane="${escapeHTML(laneKey)}" data-bracket-focus-target="${escapeHTML(focus)}">
        <div class="sbw-double-lane-head">
          <span>${escapeHTML(title)}</span>
          <strong>${escapeHTML(subtitle)}</strong>
        </div>
        ${normalizedRounds.length > 0 ? renderRounds(normalizedRounds, { laneKey }) : renderBracketEmptyState(title, fallback)}
      </section>
    `;
  }

  function renderRounds(rounds, options = {}) {
    const normalizedRounds = sbwNormalizeBracketRounds(rounds);
    const laneKey = options.laneKey || "bracket";

    if (normalizedRounds.length === 0) {
      return renderBracketEmptyState(
        "Chave ainda não gerada",
        "Quando o organizador gerar a estrutura, as partidas aparecerão aqui."
      );
    }

    return `
      <div class="sbw-horizontal-bracket" data-bracket-rounds data-bracket-lane-key="${escapeHTML(laneKey)}">
        ${normalizedRounds.map((round, roundIndex) => {
          const matches = Array.isArray(round.matches) ? round.matches : [];
          const shortLabel = sbwGetRoundShortLabel(round, roundIndex, normalizedRounds.length);
          const isFinalArea = roundIndex >= normalizedRounds.length - 2;
          const roundHeader = sbwGetBracketRoundHeader(round, roundIndex, normalizedRounds.length, { laneKey });

          return `
            <section
              class="sbw-horizontal-round"
              data-bracket-round
              data-bracket-round-index="${escapeHTML(roundIndex)}"
              data-bracket-focus-target="${isFinalArea ? "finals" : "all"}"
              data-bracket-stage="${escapeHTML(shortLabel.toLowerCase())}"
            >
              <header class="sbw-horizontal-round-head">
                <strong>${escapeHTML(roundHeader)}</strong>
              </header>
              <div class="sbw-horizontal-round-matches">
                ${matches.map((match, matchIndex) => renderMatch(match, {
                  phaseLabel: shortLabel,
                  laneKey,
                  roundIndex,
                  matchIndex
                })).join("")}
              </div>
            </section>
          `;
        }).join("")}
      </div>
    `;
  }


  function renderSingleEliminationPublic(tournament, options = {}) {
    const realRounds = options.rounds || sbwGetSingleEliminationRounds(tournament);
    const bracketSize = sbwGetBracketSizeForTournament(tournament, 16);
    const rounds = realRounds.length > 0
      ? realRounds
      : sbwBuildPlaceholderRounds(tournament, {
          branch: options.branch || "single",
          size: bracketSize,
          revealParticipants: true
        });
    const usingGeneratedSkeleton = realRounds.length === 0;

    const content = `
      ${sbwRenderBracketNotice(tournament)}
      <div class="sbw-single-bracket ${usingGeneratedSkeleton ? "is-skeleton" : ""}" data-bracket-size="${escapeHTML(bracketSize)}">
        ${renderBracketLane(
          options.laneTitle || "Bracket",
          options.laneSubtitle || "Eliminação simples",
          rounds,
          { focus: "all", className: "sbw-single-lane" }
        )}
      </div>
    `;

    return renderBracketShell({
      modeClass: "sbw-bracket-mode-single sbw-bracket-clean-mode sbw-bracket-reference-mode",
      eyebrow: options.eyebrow || "Bracket",
      title: options.title || "Chave do torneio",
      subtitle: usingGeneratedSkeleton
        ? "Chave pré-montada em visual compacto. Os nomes entram após o fechamento do check-in."
        : "Chave pública em visual compacto da plataforma -SBW-.",
      content,
      chips: options.chips || [
        { label: "Visão completa", value: "all" },
        { label: "Top 16", value: "r16" },
        { label: "Top 8", value: "qf" },
        { label: "Finais", value: "finals" }
      ]
    });
  }

  function renderPlayoffs(tournament) {
    const realRounds = sbwGetPlayoffRounds(tournament);

    return renderSingleEliminationPublic(tournament, {
      rounds: realRounds,
      branch: "playoffs",
      eyebrow: "Groups + Playoffs",
      title: "Bracket de Playoffs",
      laneTitle: "Playoffs",
      laneSubtitle: "Mata-mata",
      chips: [
        { label: "Visão completa", value: "all" },
        { label: "Top 16", value: "r16" },
        { label: "Top 8", value: "qf" },
        { label: "Finais", value: "finals" }
      ]
    });
  }

  function renderDoubleEliminationFinalsPublic(rounds) {
    const normalizedRounds = sbwNormalizeBracketRounds(rounds);

    if (normalizedRounds.length === 0) {
      return `
        <div class="sbw-double-finals-row" data-bracket-focus-target="grand-final finals">
          <section class="sbw-double-final-card is-grand-final-main" data-grand-final-card>
            ${renderMatch({
              id: "grand-final-placeholder",
              name: "Grand Final",
              roundName: "GF",
              roundLabel: "GF",
              bestOf: "BO5",
              status: "pending",
              playerA: null,
              playerB: null
            }, { phaseLabel: "GF", laneKey: "grand", roundIndex: 0, matchIndex: 0 })}
          </section>
        </div>
      `;
    }

    return `
      <div class="sbw-double-finals-row" data-bracket-focus-target="grand-final finals">
        ${normalizedRounds.map((round, roundIndex) => {
          const roundMatches = Array.isArray(round.matches) ? round.matches : [];
          const roundFormat = sbwGetBracketRoundFormat(round);
          const isReset = roundIndex > 0;

          return `
            <section class="sbw-double-final-card ${isReset ? "is-grand-final-reset" : "is-grand-final-main"}" data-grand-final-card>
              ${isReset ? `
                <div class="sbw-grand-final-reset-label">
                  <span>Reset se necessário</span>
                  <strong>${escapeHTML(roundFormat)}</strong>
                </div>
              ` : ""}
              ${roundMatches.map((match, matchIndex) => renderMatch(match, {
                phaseLabel: roundIndex === 0 ? "GF" : "Reset",
                laneKey: "grand",
                roundIndex,
                matchIndex
              })).join("") || `<p>Partida ainda não definida.</p>`}
            </section>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderDoubleEliminationPublic(tournament) {
    const structure = getTournamentStructure(tournament);
    const bracketSize = sbwGetBracketSizeForTournament(tournament, 16);
    const realWinnersRounds = sbwGetWinnersRoundsFromStructure(structure);
    const realLosersRounds = sbwGetLowerRoundsFromStructure(structure);
    const realGrandFinalRounds = sbwGetGrandFinalRoundsFromStructure(structure);
    const usingGeneratedSkeleton = realWinnersRounds.length === 0 && realLosersRounds.length === 0;

    const winnersRounds = realWinnersRounds.length > 0
      ? realWinnersRounds
      : sbwBuildPlaceholderRounds(tournament, {
          branch: "winners",
          size: bracketSize,
          revealParticipants: true
        });
    const losersRounds = realLosersRounds.length > 0
      ? realLosersRounds
      : sbwBuildPlaceholderLowerRounds(tournament, {
          size: bracketSize
        });
    const grandFinalRounds = realGrandFinalRounds.length > 0
      ? realGrandFinalRounds
      : [{
          name: "Grand Final",
          label: "GF",
          matches: [{
            id: "grand-final-placeholder",
            name: "Grand Final",
            roundName: "GF",
            roundLabel: "GF",
            bestOf: "BO5",
            status: "pending",
            playerA: null,
            playerB: null
          }]
        }];

    const content = `
      ${sbwRenderBracketNotice(tournament)}
      <div class="sbw-double-bracket ${usingGeneratedSkeleton ? "is-skeleton" : ""}" data-bracket-size="${escapeHTML(bracketSize)}">
        <div class="sbw-double-board">
          <div class="sbw-double-top-row">
            ${renderBracketLane("Winners Bracket", "Chave superior", winnersRounds, { focus: "winners", laneKey: "winners", className: "sbw-winners-lane" })}

            <section class="sbw-bracket-lane sbw-double-grand" data-bracket-lane="grand" data-bracket-focus-target="grand-final finals">
              <div class="sbw-double-lane-head">
                <span>Grand Final</span>
                <strong>Final</strong>
              </div>
              ${renderDoubleEliminationFinalsPublic(grandFinalRounds)}
            </section>
          </div>

          ${renderBracketLane("Lower Bracket", "Chave inferior", losersRounds, { focus: "lower", laneKey: "lower", className: "sbw-lower-lane" })}
        </div>
      </div>
    `;

    return renderBracketShell({
      modeClass: "sbw-bracket-mode-double sbw-bracket-clean-mode sbw-bracket-reference-mode",
      eyebrow: "Double Elimination",
      title: "Chave dupla eliminação",
      subtitle: usingGeneratedSkeleton
        ? "Winners, Lower e Grand Final ficam visíveis desde a preparação. Os nomes entram após o fechamento do check-in."
        : "Winners, Lower e Grand Final no visual compacto da plataforma -SBW-.",
      content,
      chips: [
        { label: "Visão completa", value: "all" },
        { label: "Top 16", value: "r16" },
        { label: "Top 8", value: "qf" },
        { label: "Winners", value: "winners" },
        { label: "Lower", value: "lower" },
        { label: "Grand Final", value: "grand-final" }
      ]
    });
  }


function renderStructureMeta(tournament) {
  const structure = getTournamentStructure(tournament);

  if (!structure) {
    return `
      <div class="detail-card structure-meta-card pending">
        <strong>Estrutura ainda não gerada</strong>
        <p>
          O organizador ainda não publicou a estrutura competitiva deste torneio.
        </p>
      </div>
    `;
  }

  const generatedAt = getStructureGeneratedAt(tournament);
  const generatedFrom = getStructureGeneratedFrom(tournament);
  const playersUsed = getStructurePlayersUsed(tournament);
  const totalSnapshot = Number(structure.totalParticipantsSnapshot || 0);
  const matchesCount = getTournamentMatches(tournament).length;
  const resultCounts = getResultCounts(tournament);
  const resultsUpdatedAt = getResultsUpdatedAt(tournament);
  const generatedDate = generatedAt ? new Date(generatedAt) : null;
  const generatedLabel = generatedDate && !Number.isNaN(generatedDate.getTime())
    ? generatedDate.toLocaleString("pt-BR")
    : (generatedAt || "Data não registrada");
  const sourceLabel = generatedFrom === "real-registrations" || generatedFrom === "supabase-real-registrations"
    ? "Inscritos reais do Supabase"
    : "Estrutura publicada";

  return `
    <div class="detail-card structure-meta-card">
      <div>
        <strong>Estrutura oficial publicada</strong>
        <p>
          Esta estrutura foi gerada pelo painel do organizador e está sendo lida do Supabase.
        </p>
      </div>

      <div class="structure-meta-grid">
        <span><b>Origem</b>${escapeHTML(sourceLabel)}</span>
        <span><b>Jogadores usados</b>${escapeHTML(playersUsed || "-")}${totalSnapshot ? ` / ${escapeHTML(totalSnapshot)}` : ""}</span>
        <span><b>Partidas</b>${escapeHTML(matchesCount || "A definir")}</span>
        <span><b>Resultados</b>${String(resultCounts.completed)} / ${escapeHTML(resultCounts.total || matchesCount || 0)}</span>
        <span><b>Gerada em</b>${escapeHTML(generatedLabel)}</span>
        <span><b>Último resultado</b>${escapeHTML(formatDateTimeLabel(resultsUpdatedAt))}</span>
      </div>
    </div>
  `;
}


  function getTripleBracketOfficializationSummaryPublic(tournament) {
    const structure = getTournamentStructure(tournament) || {};
    const groupStage = structure.groupStage || {};
    const placeholderSlots = Number(structure.placeholderSlots || groupStage.placeholderSlots || 0);
    const realPlayersUsed = Number(structure.realPlayersUsed || groupStage.realTeams || 0);
    const locked = Boolean(
      structure.templateMode ||
      groupStage.templateMode ||
      structure.resultLock?.locked ||
      groupStage.resultLock?.locked ||
      placeholderSlots > 0 ||
      (realPlayersUsed > 0 && realPlayersUsed < 8)
    );

    return {
      locked,
      title: locked ? "Modelo com vagas em aberto" : "Estrutura oficial",
      message: locked
        ? `Este torneio ainda exibe um modelo de estrutura com ${realPlayersUsed} inscrito(s) real(is) e ${placeholderSlots} vaga(s) em aberto. Resultados oficiais serão liberados quando o organizador regenerar com 8 equipes reais.`
        : "Estrutura gerada com 8 equipes reais. A fase todos contra todos pode receber resultados oficiais."
    };
  }

  function getTripleBracketGroupStage(tournament) {
    const structure = getTournamentStructure(tournament) || {};
    return structure.groupStage || {
      standings: structure.standings || [],
      rounds: structure.rounds || []
    };
  }

  function renderTripleBracketPublicPlayer(player, fallback = "A definir") {
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

  function getTripleBracketPublicAdvantageLabel(match) {
    if (!match || String(match.id || "") !== "GF1" || !match.advantage?.applied) return "";

    const scoreA = Number(match.advantage.scoreA || match.initialScoreA || match.advantageScoreA || 0);
    const scoreB = Number(match.advantage.scoreB || match.initialScoreB || match.advantageScoreB || 0);
    const label = match.advantage.label || "Chave Alta inicia com vantagem na Grande Final.";

    return `${label} Placar inicial: ${scoreA}–${scoreB}.`;
  }

  function renderTripleBracketPublicMatch(match) {
    const completed = String(match.status || "").toLowerCase() === "completed";
    const waiting = !match.playerA || !match.playerB || match.playerA?.waitingSlot || match.playerB?.waitingSlot || match.playerA?.placeholder || match.playerB?.placeholder;
    const statusLabel = waiting ? "Aguardando classificados" : (match.status === "pending" ? "Pendente" : (match.status || "aguardando"));
    const advantageLabel = getTripleBracketPublicAdvantageLabel(match);
    const scoreLabel = completed ? `${escapeHTML(match.scoreA)} x ${escapeHTML(match.scoreB)}` : escapeHTML(statusLabel);
    return `
      <div class="playoff-match triple-bracket-playoff-match">
        <div class="playoff-bracket-round-title">${escapeHTML(match.label || match.name || match.id || "Partida")}</div>
        ${renderTripleBracketPublicPlayer(match.playerA, match.slotA)}
        <div class="playoff-vs">vs</div>
        ${renderTripleBracketPublicPlayer(match.playerB, match.slotB)}
        ${advantageLabel ? `<div class="match-status">${escapeHTML(advantageLabel)}</div>` : ""}
        <div class="match-status">${scoreLabel}</div>
      </div>
    `;
  }

  function renderTripleBracketPublicBracket(title, bracket, description = "") {
    if (!bracket || bracket.status !== "generated") return "";

    return `
      <div class="detail-card structure-meta-card">
        <div>
          <strong>${escapeHTML(title || bracket.label || "Chave")}</strong>
          ${description ? `<p>${escapeHTML(description)}</p>` : ""}
        </div>
        <div class="match-list">
          ${(bracket.rounds || []).map((round) => `
            <div class="match-round-title">${escapeHTML(round.name || round.label || "Rodada")}</div>
            ${(round.matches || []).map(renderTripleBracketPublicMatch).join("")}
          `).join("")}
        </div>
      </div>
    `;
  }

  function renderTripleBracketPublicPlayoffs(structure) {
    const generated = structure?.highBracket?.status === "generated" ||
      structure?.middleBracket?.status === "generated" ||
      structure?.lowBracket?.status === "generated";

    if (!generated) return "";

    return `
      <div class="detail-section-header">
        <span>Playoffs</span>
        <h3>Chave Alta, Média e Baixa</h3>
        <p>Chaves geradas com base na classificação final. O avanço automático entre Chave Alta, Média, Baixa e finais está ativo no painel do organizador. A Grande Final aplica a vantagem automática da Chave Alta.</p>
      </div>
      ${renderTripleBracketPublicBracket("Chave Alta", structure.highBracket, "1º ao 4º geral. Perdeu, desce para a Chave Média.")}
      ${renderTripleBracketPublicBracket("Chave Média", structure.middleBracket, "5º ao 8º geral + quedas da Chave Alta.")}
      ${renderTripleBracketPublicBracket("Chave Baixa", structure.lowBracket, "Última chance antes da eliminação.")}
      ${renderTripleBracketPublicBracket("Final Intermediária", structure.intermediaryFinal, "Vencedor da Média contra vencedor da Baixa.")}
      ${renderTripleBracketPublicBracket("Grande Final", structure.grandFinal, "FT5 sem reset, com vantagem automática para a Chave Alta.")}
    `;
  }

  function renderTripleBracketPublic(tournament) {
    const structure = getTournamentStructure(tournament) || {};
    const groupStage = getTripleBracketGroupStage(tournament);
    const standings = Array.isArray(groupStage.standings) ? groupStage.standings : [];
    const rounds = Array.isArray(groupStage.rounds) ? groupStage.rounds : [];
    const playableMatches = rounds.flatMap((round) => round.matches || []).filter((match) => match.playerA && match.playerB);
    const completedMatches = playableMatches.filter((match) => String(match.status || "").toLowerCase() === "completed");
    const officialization = getTripleBracketOfficializationSummaryPublic(tournament);

    return `
      <div class="structure-block">
        ${renderStructureMeta(tournament)}
        ${renderFinalResultsSummary(tournament)}

        <div class="detail-section-header">
          <span>Sistema de 3 Chaves</span>
          <h3>Fase todos contra todos</h3>
          <p>
            Esta fase define a vantagem competitiva: 1º ao 4º entram na Chave Alta; 5º ao 8º entram na Chave Média.
          </p>
        </div>

        <div class="detail-card structure-meta-card">
          <div>
            <strong>${escapeHTML(officialization.title)}</strong>
            <p>${escapeHTML(officialization.message)}</p>
          </div>
        </div>

        <div class="detail-card structure-meta-card">
          <div>
            <strong>Progresso da fase inicial</strong>
            <p>${escapeHTML(completedMatches.length)} / ${escapeHTML(playableMatches.length || 28)} partida(s) concluída(s). As três chaves serão exibidas após a geração dos playoffs pelo organizador.</p>
          </div>
        </div>

        ${renderLeagueTable(tournament)}

        ${renderTripleBracketPublicPlayoffs(structure)}

        <details class="sbw-structure-secondary-groups" open>
          <summary>
            <span>Rodadas</span>
            Ver confrontos todos contra todos
          </summary>
          <div class="sbw-structure-secondary-body">
            ${renderLeagueRounds({
              ...tournament,
              structure: {
                ...(getTournamentStructure(tournament) || {}),
                rounds,
                standings
              },
              standings
            })}
          </div>
        </details>
      </div>
    `;
  }

  function renderStructure(tournament) {
        const format = getTournamentFormat(tournament);
        const metaHtml = renderStructureMeta(tournament);
        const finalResultsHtml = renderFinalResultsSummary(tournament);


    if (format === "triple-bracket") {
      return renderTripleBracketPublic(tournament);
    }

    if (format === "league") {
      return `
        <div class="structure-block">
          ${metaHtml}
          ${finalResultsHtml}

          <div class="detail-section-header">
            <span>Liga</span>
            <h3>Tabela de classificação</h3>
          </div>

          ${renderLeagueTable(tournament)}

          ${renderLeagueHistory(tournament)}
        </div>
      `;
    }

    if (format === "groups-playoffs") {
      return `
        <div class="structure-block structure-block--clean-bracket">
          ${renderPlayoffs(tournament)}

          <details class="sbw-structure-secondary-groups">
            <summary>
              <span>Groups</span>
              Ver fase de grupos e classificação
            </summary>
            <div class="sbw-structure-secondary-body">
              ${renderGroupPhaseHistory(tournament)}
              ${renderGroups(tournament)}
            </div>
          </details>
        </div>
      `;
    }

if (format === "double-elimination") {
  return `
    <div class="structure-block structure-block--clean-bracket">
      ${renderDoubleEliminationPublic(tournament)}
    </div>
  `;
}

    if (format === "single-elimination") {
      return `
        <div class="structure-block structure-block--clean-bracket">
          ${renderSingleEliminationPublic(tournament)}
        </div>
      `;
    }

    return `
      <div class="structure-block structure-block--clean-bracket">
        ${renderSingleEliminationPublic(tournament, {
          title: "Chave do torneio",
          laneTitle: "Bracket",
          laneSubtitle: getFormatLabel(format)
        })}
      </div>
    `;
  }

function hasDemoRegistration(tournamentId) {
  return sbwHasRegistration(tournamentId);
}

function isSupabaseRegistrationReady() {
  return Boolean(
    window.SBWSupabase &&
    typeof window.SBWSupabase.isEnabled === "function" &&
    window.SBWSupabase.isEnabled()
  );
}

function getLoginUrlForCurrentPage() {
  if (window.SBWAuth && typeof window.SBWAuth.getLoginUrl === "function") {
    return window.SBWAuth.getLoginUrl(window.location.href);
  }

  return "../auth/login.html";
}

async function hydrateDetailRegistrationState(tournament) {
  sbwCurrentDetailAuthUser = null;
  sbwCurrentDetailProfile = null;
  sbwCurrentDetailRegistration = null;
  sbwCurrentDetailParticipants = [];
  sbwCurrentDetailOrganizerAccess = null;
  sbwCurrentDetailRegistrationChecked = false;

  if (!tournament || !isSupabaseRegistrationReady()) {
    sbwCurrentDetailRegistrationChecked = true;
    return;
  }

  try {
    if (typeof sbwGetSupabaseTournamentParticipants === "function") {
      sbwCurrentDetailParticipants = await sbwGetSupabaseTournamentParticipants(tournament);

      if (sbwCurrentDetailParticipants.length > 0) {
        tournament.participants = sbwCurrentDetailParticipants;
        tournament.currentParticipants = sbwCurrentDetailParticipants.length;
        tournament.participantsCount = sbwCurrentDetailParticipants.length;
      }
    }
  } catch (error) {
    console.warn("[SaberWolf Torneios] Não foi possível carregar participantes reais:", error);
  }

  try {
    if (!window.SBWAuth || typeof window.SBWAuth.getUser !== "function") {
      sbwCurrentDetailRegistrationChecked = true;
      return;
    }

    sbwCurrentDetailAuthUser = await window.SBWAuth.getUser();

    if (!sbwCurrentDetailAuthUser) {
      sbwCurrentDetailRegistrationChecked = true;
      return;
    }

    if (typeof window.SBWAuth.ensureCurrentUserProfile === "function") {
      sbwCurrentDetailProfile = await window.SBWAuth.ensureCurrentUserProfile();
    }

    if (typeof sbwGetCurrentTournamentRegistrationAsync === "function") {
      sbwCurrentDetailRegistration = await sbwGetCurrentTournamentRegistrationAsync(
        tournament,
        sbwCurrentDetailAuthUser
      );
    }


    await sbwHydrateDetailOrganizerAccess(tournament);
  } catch (error) {
    console.warn("[SaberWolf Torneios] Não foi possível verificar login/inscrição:", error);
  } finally {
    sbwCurrentDetailRegistrationChecked = true;
  }
}

function sbwIsTeamBattleLeagueRegistrationTournament(tournament) {
  const format = String(getTournamentFormat(tournament) || tournament?.format || tournament?.formatKey || "").toLowerCase().trim();
  const settings = tournament?.settings && typeof tournament.settings === "object" ? tournament.settings : {};
  const metadata = tournament?.metadata && typeof tournament.metadata === "object" ? tournament.metadata : {};
  const formatFamily = String(
    metadata.formatFamily ||
    metadata.format_family ||
    settings.formatFamily ||
    settings.format_family ||
    ""
  ).toLowerCase();

  return Boolean(
    format === "team-battle-league-4v4" ||
    format.includes("team-battle") ||
    formatFamily === "team_battle" ||
    settings.teamBattleLeague ||
    settings.team_battle_league ||
    metadata.teamBattleLeague ||
    metadata.team_battle_league
  );
}

function sbwBuildRegistrationViewState(tournament, registrationOpen) {
  const availability = sbwGetRegistrationAvailability(tournament);
  const supabaseMode = isSupabaseRegistrationReady();
  const localAlreadyRegistered = hasDemoRegistration(tournament.id);
  const alreadyRegistered = supabaseMode
    ? Boolean(sbwCurrentDetailRegistration)
    : localAlreadyRegistered;

  if (sbwIsTeamBattleLeagueRegistrationTournament(tournament)) {
    return {
      availability,
      supabaseMode,
      alreadyRegistered: false,
      title: "Inscrição por equipe",
      description: "Este formato usa inscrição por equipe. O capitão ou gestor autorizado deve inscrever uma equipe real da plataforma -SBW- e selecionar 4 membros da própria equipe.",
      notice: "Team Battle League 4v4 não aceita inscrição individual nem mistura jogadores de equipes diferentes. A etapa própria de inscrição por equipe será usada para este formato.",
      buttonLabel: "Inscrição por equipe",
      disabled: true
    };
  }

  if (!registrationOpen) {
    return {
      availability,
      supabaseMode,
      alreadyRegistered,
      title: availability.label,
      description: availability.reason,
      notice: availability.maxParticipants && availability.className === "full"
        ? "O torneio atingiu o limite de vagas configurado pelo organizador."
        : "Quando o organizador abrir inscrições, jogadores logados poderão se registrar com a conta -SBW-.",
      buttonLabel: availability.className === "full" ? "Torneio lotado" : "Inscrição fechada",
      disabled: true
    };
  }

  if (alreadyRegistered) {
    return {
      availability,
      supabaseMode,
      alreadyRegistered: true,
      title: supabaseMode ? "Você já está inscrito" : "Inscrição simulada neste navegador",
      description: supabaseMode
        ? "Sua inscrição oficial foi encontrada. A próxima etapa será acompanhar check-in, cronograma e orientações do organizador."
        : "Esta inscrição foi registrada apenas no modo local-demo deste navegador.",
      notice: supabaseMode
        ? "Inscrição real vinculada à sua conta -SBW-."
        : "Modo demo: esta inscrição não vale como inscrição oficial em produção.",
      buttonLabel: supabaseMode ? "Inscrição confirmada" : "Inscrição já simulada",
      disabled: true
    };
  }

  if (supabaseMode && !sbwCurrentDetailAuthUser) {
    return {
      availability,
      supabaseMode,
      alreadyRegistered: false,
      requiresLogin: true,
      title: "Entre para se inscrever",
      description: "Para participar oficialmente, você precisa entrar com sua conta -SBW-. O sistema usará seu perfil público como dados de jogador.",
      notice: "Conta obrigatória: login por e-mail/senha ou provedor configurado no Supabase Auth.",
      buttonLabel: "Entrar para se inscrever",
      disabled: false
    };
  }

  if (supabaseMode) {
    return {
      availability,
      supabaseMode,
      alreadyRegistered: false,
      title: "Inscrições abertas",
      description: "Você está logado. Ao confirmar, sua inscrição será salva como inscrição real do torneio.",
      notice: "A inscrição fica vinculada à sua conta -SBW- e ao seu perfil público de jogador.",
      buttonLabel: "Confirmar inscrição",
      disabled: false
    };
  }

  return {
    availability,
    supabaseMode,
    alreadyRegistered: false,
    title: "Inscrições abertas em modo demonstração",
    description: "Supabase/Auth não está ativo nesta execução. A ação abaixo apenas simula o interesse de inscrição neste navegador.",
    notice: "Modo local-demo: para inscrição real, ative Supabase e crie a tabela tournament_participants.",
    buttonLabel: "Simular inscrição",
    disabled: false
  };
}

function renderRegistrationNotice(registrationState) {
  if (!registrationState?.notice) {
    return "";
  }

  return `
    <div class="registration-notice-card ${registrationState.supabaseMode ? "real" : "demo"}">
      <i class="fa-solid ${registrationState.supabaseMode ? "fa-shield-halved" : "fa-triangle-exclamation"}"></i>
      <p>
        <strong>${registrationState.supabaseMode ? "Sistema de inscrição" : "Aviso"}</strong>
        ${escapeHTML(registrationState.notice)}
      </p>
    </div>
  `;
}


function sbwGetCheckInPublicState(tournament, registrationState) {
  const startValue = sbwGetCheckInDateValue(tournament, "start") || tournament?.checkInTime || tournament?.checkin || "";
  const endValue = sbwGetCheckInDateValue(tournament, "end") || "";
  const startDate = sbwParseFlexibleDate(startValue, tournament);
  const endDate = sbwParseFlexibleDate(endValue, tournament);
  const now = Date.now();

  if (!registrationState?.alreadyRegistered) {
    return {
      className: "waiting",
      icon: "fa-user-plus",
      label: "Disponível após inscrição",
      description: "O check-in aparece para jogadores inscritos quando a janela configurada pelo organizador estiver aberta.",
      meta: startValue || "Horário a definir"
    };
  }

  if (endDate && now > endDate.getTime()) {
    return {
      className: "closed",
      icon: "fa-lock",
      label: "Check-in encerrado",
      description: "A janela de confirmação foi encerrada. A lista pública prioriza participantes confirmados.",
      meta: endValue || "Encerrado"
    };
  }

  if (startDate && now < startDate.getTime()) {
    return {
      className: "waiting",
      icon: "fa-clock",
      label: "Check-in aguardando abertura",
      description: "Sua inscrição está registrada. Volte no horário indicado para confirmar presença.",
      meta: startValue || "A definir"
    };
  }

  if (sbwIsCheckInOpen(tournament)) {
    return {
      className: "open",
      icon: "fa-clipboard-check",
      label: "Check-in aberto",
      description: "Confirme sua presença para entrar na lista final usada na geração da estrutura.",
      meta: endValue ? `Até ${endValue}` : (startValue || "Janela aberta")
    };
  }

  return {
    className: "draft",
    icon: "fa-calendar-check",
    label: "Check-in a definir",
    description: "O organizador ainda pode publicar ou ajustar a janela de confirmação.",
    meta: startValue || "A definir"
  };
}

function sbwRenderRegistrationJourney(tournament, registrationState) {
  const checkInState = sbwGetCheckInPublicState(tournament, registrationState);
  const steps = [
    {
      key: "account",
      icon: "fa-user-shield",
      title: "Conta -SBW-",
      description: registrationState.supabaseMode
        ? (registrationState.requiresLogin ? "Entre para validar sua inscrição." : "Conta conectada.")
        : "Modo demonstração local.",
      state: registrationState.supabaseMode && !registrationState.requiresLogin ? "done" : (registrationState.requiresLogin ? "current" : "demo")
    },
    {
      key: "registration",
      icon: "fa-ticket",
      title: "Inscrição",
      description: registrationState.alreadyRegistered ? "Sua inscrição foi encontrada." : registrationState.availability.shortLabel,
      state: registrationState.alreadyRegistered ? "done" : (registrationState.availability.open ? "current" : "locked")
    },
    {
      key: "checkin",
      icon: checkInState.icon,
      title: "Check-in",
      description: checkInState.label,
      state: checkInState.className === "open" ? "current" : (checkInState.className === "closed" ? "done" : "locked")
    },
    {
      key: "play",
      icon: "fa-sitemap",
      title: "Chaves e partidas",
      description: "Acompanhe a estrutura e os resultados públicos.",
      state: sbwIsCheckInClosed(tournament) ? "current" : "locked"
    }
  ];

  return `
    <div class="registration-journey-card">
      <div class="registration-journey-head">
        <span>Fluxo do participante</span>
        <strong>Da inscrição até as partidas</strong>
      </div>
      <div class="registration-journey-steps">
        ${steps.map((step, index) => `
          <div class="registration-journey-step ${escapeHTML(step.state)}">
            <span class="registration-journey-index">${index + 1}</span>
            <i class="fa-solid ${escapeHTML(step.icon)}"></i>
            <div>
              <strong>${escapeHTML(step.title)}</strong>
              <p>${escapeHTML(step.description)}</p>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function sbwRenderCheckInStatusCard(tournament, registrationState) {
  const checkInState = sbwGetCheckInPublicState(tournament, registrationState);

  return `
    <div class="registration-checkin-status-card ${escapeHTML(checkInState.className)}">
      <div class="registration-checkin-status-icon">
        <i class="fa-solid ${escapeHTML(checkInState.icon)}"></i>
      </div>
      <div>
        <span>Check-in público</span>
        <strong>${escapeHTML(checkInState.label)}</strong>
        <p>${escapeHTML(checkInState.description)}</p>
      </div>
      <em>${escapeHTML(checkInState.meta)}</em>
    </div>
  `;
}

function sbwBuildPlayerOrientationItems(tournament, registrationState) {
  const availability = registrationState?.availability || sbwGetRegistrationAvailability(tournament);
  const checkInState = sbwGetCheckInPublicState(tournament, registrationState);
  const isTeamBattle = sbwIsTeamBattleLeagueRegistrationTournament(tournament);
  const items = [];

  if (isTeamBattle) {
    items.push({
      icon: "fa-people-group",
      title: "Inscrição por equipe",
      text: "Este formato não aceita inscrição individual. O responsável da equipe deve inscrever 4 membros da mesma equipe real da plataforma -SBW-."
    });
  } else if (registrationState?.requiresLogin) {
    items.push({
      icon: "fa-right-to-bracket",
      title: "Entre antes de participar",
      text: "Use a conta -SBW- que representa seu perfil de jogador. A inscrição real fica vinculada ao seu login."
    });
  } else if (registrationState?.alreadyRegistered) {
    items.push({
      icon: "fa-circle-check",
      title: "Inscrição encontrada",
      text: "Sua inscrição já está salva. Agora acompanhe a janela de check-in e as orientações do organizador."
    });
  } else if (availability?.open) {
    items.push({
      icon: "fa-ticket",
      title: "Inscrição disponível",
      text: "Confirme participação somente se puder cumprir horário, regras, check-in e comunicação do torneio."
    });
  } else {
    items.push({
      icon: "fa-clock",
      title: "Aguardando abertura",
      text: availability?.reason || "As inscrições serão liberadas quando o organizador publicar o torneio para jogadores."
    });
  }

  if (checkInState.className === "open") {
    items.push({
      icon: "fa-clipboard-check",
      title: "Check-in obrigatório",
      text: "Confirme presença dentro da janela aberta. A estrutura final deve priorizar quem fez check-in."
    });
  } else if (registrationState?.alreadyRegistered) {
    items.push({
      icon: "fa-bell",
      title: "Volte no horário do check-in",
      text: checkInState.description || "A inscrição sozinha não garante presença na chave quando o torneio exige confirmação."
    });
  } else {
    items.push({
      icon: "fa-calendar-check",
      title: "Atenção ao check-in",
      text: "Depois de inscrito, acompanhe a janela de check-in publicada nesta página para não perder a vaga."
    });
  }

  items.push({
    icon: "fa-file-lines",
    title: "Leia regras e formato",
    text: "Antes das partidas, confira regulamento, formato competitivo, horários e canais de comunicação informados pelo organizador."
  });

  return items.slice(0, 4);
}

function sbwRenderPlayerOrientationPanel(tournament, registrationState) {
  const items = sbwBuildPlayerOrientationItems(tournament, registrationState);

  return `
    <div class="registration-player-orientation-card">
      <div class="registration-player-orientation-head">
        <span>Orientação para jogadores</span>
        <strong>Antes de chamar a organização no privado, confira estes pontos</strong>
      </div>
      <div class="registration-player-orientation-grid">
        ${items.map((item) => `
          <div class="registration-player-orientation-item">
            <i class="fa-solid ${escapeHTML(item.icon)}"></i>
            <div>
              <strong>${escapeHTML(item.title)}</strong>
              <p>${escapeHTML(item.text)}</p>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function sbwRenderRegistrationGuidance(tournament, registrationState) {
  const alreadyRegistered = registrationState.alreadyRegistered;
  const requiresLogin = registrationState.requiresLogin;
  const checkInOpen = alreadyRegistered && sbwIsCheckInOpen(tournament);

  let title = "Antes de se inscrever";
  let description = "Confira o regulamento, formato, plataforma e horários publicados pelo organizador antes de confirmar participação.";
  let icon = "fa-circle-info";

  if (requiresLogin) {
    title = "Login necessário";
    description = "Entre com sua conta da plataforma -SBW- para salvar uma inscrição oficial vinculada ao seu perfil público.";
    icon = "fa-right-to-bracket";
  } else if (checkInOpen) {
    title = "Confirme presença";
    description = "A janela de check-in está aberta. Confirme presença para aparecer na lista final usada na estrutura do torneio.";
    icon = "fa-clipboard-check";
  } else if (alreadyRegistered) {
    title = "Inscrição localizada";
    description = "Acompanhe a janela de check-in, o cronograma, as chaves e os resultados públicos nesta página.";
    icon = "fa-circle-check";
  }

  return `
    <div class="registration-guidance-card">
      <i class="fa-solid ${escapeHTML(icon)}"></i>
      <div>
        <strong>${escapeHTML(title)}</strong>
        <p>${escapeHTML(description)}</p>
      </div>
    </div>
  `;
}

function sbwGetTournamentRulesText(tournament) {
  const metadata = tournament?.metadata && typeof tournament.metadata === "object" ? tournament.metadata : {};
  const settings = tournament?.settings && typeof tournament.settings === "object" ? tournament.settings : {};
  const candidates = [
    tournament?.rules,
    tournament?.ruleSet,
    tournament?.rulesText,
    tournament?.regulation,
    tournament?.regulamento,
    metadata.rules,
    metadata.ruleSet,
    metadata.rulesText,
    metadata.regulation,
    metadata.regulamento,
    settings.rules,
    settings.ruleSet,
    settings.rulesText,
    settings.regulation,
    settings.regulamento
  ];

  return String(candidates.find((value) => value !== null && value !== undefined && String(value).trim()) || "").trim();
}

function sbwRenderRulesTextBlock(text) {
  const lines = String(text || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim());

  const blocks = [];
  let bulletBuffer = [];
  let paragraphBuffer = [];

  function flushParagraph() {
    if (!paragraphBuffer.length) {
      return;
    }

    blocks.push(`<p>${paragraphBuffer.map(escapeHTML).join("<br>")}</p>`);
    paragraphBuffer = [];
  }

  function flushBullets() {
    if (!bulletBuffer.length) {
      return;
    }

    blocks.push(`<ul>${bulletBuffer.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>`);
    bulletBuffer = [];
  }

  lines.forEach((line) => {
    if (!line) {
      flushParagraph();
      flushBullets();
      return;
    }

    const bulletMatch = line.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/);

    if (bulletMatch) {
      flushParagraph();
      bulletBuffer.push(bulletMatch[1]);
      return;
    }

    flushBullets();
    paragraphBuffer.push(line);
  });

  flushParagraph();
  flushBullets();

  return blocks.join("") || `<p>${escapeHTML("Regras ainda não publicadas pelo organizador.")}</p>`;
}

function sbwRenderRulesPublicPanel(tournament) {
  const rulesText = sbwGetTournamentRulesText(tournament);
  const hasRules = Boolean(rulesText);
  const formatLabel = getFormatLabel(getTournamentFormat(tournament));
  const organizerName = sbwGetTournamentOrganizerData(tournament).displayName || getOrganizer(tournament);

  return `
    <div class="rules-public-layout ${hasRules ? "has-rules" : "is-empty"}">
      <article class="rules-public-main-card">
        <div class="rules-public-card-head">
          <span>${hasRules ? "Regulamento publicado" : "Regulamento pendente"}</span>
          <strong>${hasRules ? "Regras do torneio" : "Regras ainda não publicadas"}</strong>
          <p>${hasRules
            ? "Leia as orientações oficiais antes de se inscrever ou disputar partidas."
            : "Quando o organizador publicar o regulamento, ele aparecerá aqui em formato limpo para jogadores e visitantes."}</p>
        </div>
        <div class="rules-public-content">
          ${hasRules ? sbwRenderRulesTextBlock(rulesText) : `
            <div class="rules-empty-state">
              <i class="fa-regular fa-file-lines"></i>
              <strong>Sem regulamento público por enquanto</strong>
              <p>Use as informações gerais do torneio como referência até o organizador publicar as regras completas.</p>
            </div>
          `}
        </div>
      </article>

      <aside class="rules-public-side-card">
        <span>Resumo competitivo</span>
        <div class="rules-summary-list">
          <div><small>Formato</small><strong>${escapeHTML(formatLabel)}</strong></div>
          <div><small>Organizador</small><strong>${escapeHTML(organizerName)}</strong></div>
          <div><small>Check-in</small><strong>${escapeHTML(tournament.checkInTime || tournament.checkinStartsAt || tournament.checkin || "A definir")}</strong></div>
          <div><small>Premiação</small><strong>${escapeHTML(getPrize(tournament))}</strong></div>
        </div>
        ${renderTournamentOrganizerActionButton(tournament, "rules-organizer-button")}
      </aside>
    </div>
  `;
}

function renderRegistrationPanel(tournament, registrationState, availability) {
  const maxLabel = availability.maxParticipants ? availability.maxParticipants : "∞";
  const checkInLabel = tournament.checkInTime || tournament.checkinStartsAt || tournament.checkin || "A definir";
  const checkInAlreadyConfirmed = sbwCurrentDetailRegistration
    ? sbwGetCheckInStatusInfo(sbwCurrentDetailRegistration).className === "checked-in"
    : false;
  const checkInOpen = registrationState.alreadyRegistered && sbwIsCheckInOpen(tournament) && !checkInAlreadyConfirmed;
  const accountLabel = registrationState.supabaseMode
    ? (registrationState.requiresLogin ? "Login obrigatório" : "Conta conectada")
    : "Modo demonstração";
  const progressStyle = availability.maxParticipants ? ` style="--registration-progress: ${availability.percent}%;"` : "";

  return `
    <div class="registration-panel">
      <div class="registration-panel-intro">
        <span>Participar do torneio</span>
        <strong>${escapeHTML(registrationState.title)}</strong>
        <p>${escapeHTML(registrationState.description)}</p>
      </div>

      ${sbwRenderRegistrationJourney(tournament, registrationState)}
      ${sbwRenderRegistrationGuidance(tournament, registrationState)}
      ${sbwRenderPlayerOrientationPanel(tournament, registrationState)}
      ${sbwRenderCheckInStatusCard(tournament, registrationState)}

      <div class="registration-status-card ${escapeHTML(availability.className)}">
        <div>
          <span>Status da inscrição</span>
          <strong>${escapeHTML(registrationState.title)}</strong>
          <p>${escapeHTML(registrationState.description)}</p>
        </div>

        <span class="registration-status-badge ${escapeHTML(availability.className)}">
          ${escapeHTML(availability.shortLabel)}
        </span>
      </div>

      <div class="registration-progress-card"${progressStyle}>
        <div class="registration-progress-head">
          <span>Vagas preenchidas</span>
          <strong>${escapeHTML(availability.participantsCount)} / ${escapeHTML(maxLabel)}</strong>
        </div>
        <div class="registration-progress-track"><span></span></div>
      </div>

      <div class="registration-flow-grid">
        <div class="registration-flow-card ${registrationState.requiresLogin ? "attention" : ""}">
          <i class="fa-solid fa-user-shield"></i>
          <span>Conta</span>
          <strong>${escapeHTML(accountLabel)}</strong>
        </div>

        <div class="registration-flow-card">
          <i class="fa-solid fa-clipboard-check"></i>
          <span>Check-in</span>
          <strong>${escapeHTML(checkInLabel)}</strong>
        </div>

        <div class="registration-flow-card">
          <i class="fa-solid fa-people-group"></i>
          <span>Participantes</span>
          <strong>${escapeHTML(availability.participantsCount)} inscritos</strong>
        </div>
      </div>

      ${renderRegistrationNotice(registrationState)}

      <div class="registration-action-row">
        <button
          type="button"
          class="detail-btn registration-main-button ${checkInOpen ? "checkin-open" : ""}"
          data-action="${checkInOpen ? "tournament-checkin" : "tournament-registration"}"
          data-tournament-id="${escapeHTML(tournament.id)}"
          ${registrationState.disabled && !checkInOpen ? "disabled" : ""}
        >
          <i class="fa-solid ${checkInOpen ? "fa-clipboard-check" : registrationState.requiresLogin ? "fa-right-to-bracket" : registrationState.alreadyRegistered ? "fa-circle-check" : "fa-ticket"}"></i>
          ${escapeHTML(checkInOpen ? "Fazer check-in" : registrationState.buttonLabel)}
        </button>

        ${renderTournamentOrganizerActionButton(tournament, "registration-organizer-button")}
      </div>

      ${registrationState.alreadyRegistered && !checkInOpen ? `
        <div class="registration-checkin-hint">
          <i class="fa-regular fa-clock"></i>
          O botão de check-in aparecerá aqui quando a janela de confirmação estiver aberta.
        </div>
      ` : ""}
    </div>
  `;
}

function saveDetailRegistration(tournament, registrationData = {}) {
  if (!tournament) {
    return {
      success: false,
      message: "Torneio não encontrado."
    };
  }

  const tournamentId = tournament.id;
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
    note: "Inscrição simulada. Na versão final, o usuário precisará estar logado na plataforma -SBW-.",
    source: tournament.source || "local",
    ...registrationData
  };

  sbwSaveRegistrations(registrations);

  return {
    success: true,
    message: "Inscrição simulada registrada.",
    registration: registrations[tournamentId]
  };
}

async function handleTournamentRegistration(tournamentId) {
  if (sbwCurrentDetailRegistrationBusy) {
    return;
  }

  const tournament =
    findTournamentById(tournamentId) ||
    (
      sbwCurrentDetailTournament &&
      String(sbwCurrentDetailTournament.id) === String(tournamentId)
        ? sbwCurrentDetailTournament
        : null
    );

  if (!tournament) {
    alert("Torneio não encontrado.");
    return;
  }

  if (sbwIsTeamBattleLeagueRegistrationTournament(tournament)) {
    alert("Team Battle League 4v4 usa inscrição por equipe. O capitão ou gestor autorizado deve inscrever uma equipe real com 4 membros da própria equipe.");
    return;
  }

  if (!isOpenForRegistration(tournament)) {
    alert("As inscrições deste torneio não estão abertas neste momento.");
    return;
  }

  if (isSupabaseRegistrationReady()) {
    if (!window.SBWAuth || typeof window.SBWAuth.getUser !== "function") {
      window.location.href = getLoginUrlForCurrentPage();
      return;
    }

    sbwCurrentDetailRegistrationBusy = true;

    try {
      sbwCurrentDetailAuthUser = await window.SBWAuth.getUser();

      if (!sbwCurrentDetailAuthUser) {
        window.location.href = getLoginUrlForCurrentPage();
        return;
      }

      if (typeof window.SBWAuth.ensureCurrentUserProfile === "function") {
        sbwCurrentDetailProfile = await window.SBWAuth.ensureCurrentUserProfile();
      }

      if (typeof sbwCreateTournamentRegistrationAsync !== "function") {
        alert("Função de inscrição Supabase não encontrada.");
        return;
      }

      const result = await sbwCreateTournamentRegistrationAsync(tournament, {
        authUser: sbwCurrentDetailAuthUser,
        profile: sbwCurrentDetailProfile
      });

      if (!result.success) {
        if (result.requiresLogin) {
          window.location.href = getLoginUrlForCurrentPage();
          return;
        }

        if (result.alreadyRegistered && result.registration) {
          sbwCurrentDetailRegistration = result.registration;
          renderTournament(tournament);
        }

        alert(result.message || "Não foi possível registrar a inscrição.");
        return;
      }

      sbwCurrentDetailRegistration = result.registration;

      if (result.registration) {
        const participants = Array.isArray(tournament.participants)
          ? [...tournament.participants]
          : [];

        participants.push(result.registration);
        tournament.participants = participants;
        tournament.currentParticipants = participants.length;
        tournament.participantsCount = participants.length;
      }

      alert("Inscrição confirmada com sucesso na sua conta -SBW-.");
      renderTournament(tournament);
    } finally {
      sbwCurrentDetailRegistrationBusy = false;
    }

    return;
  }

  const result = saveDetailRegistration(tournament);

  if (!result.success) {
    alert(result.message || "Não foi possível registrar a inscrição.");
    return;
  }

  alert("Inscrição simulada registrada. Ative Supabase/Auth para inscrição real.");

  renderTournament(tournament);
}

async function handleTournamentCheckIn(tournamentId) {
  if (sbwCurrentDetailRegistrationBusy) {
    return;
  }

  const tournament =
    findTournamentById(tournamentId) ||
    (
      sbwCurrentDetailTournament &&
      String(sbwCurrentDetailTournament.id) === String(tournamentId)
        ? sbwCurrentDetailTournament
        : null
    );

  if (!tournament) {
    alert("Torneio não encontrado.");
    return;
  }

  if (!sbwIsCheckInOpen(tournament)) {
    alert("O check-in deste torneio não está aberto neste momento.");
    return;
  }

  if (!isSupabaseRegistrationReady()) {
    alert("Check-in real exige Supabase/Auth ativo.");
    return;
  }

  if (!window.SBWAuth || typeof window.SBWAuth.getUser !== "function") {
    window.location.href = getLoginUrlForCurrentPage();
    return;
  }

  sbwCurrentDetailRegistrationBusy = true;

  try {
    sbwCurrentDetailAuthUser = await window.SBWAuth.getUser();

    if (!sbwCurrentDetailAuthUser) {
      window.location.href = getLoginUrlForCurrentPage();
      return;
    }

    if (typeof sbwCheckInTournamentParticipantAsync !== "function") {
      alert("Função de check-in Supabase não encontrada. Rode o SQL da v1.6.76.14 e atualize os arquivos do patch.");
      return;
    }

    const result = await sbwCheckInTournamentParticipantAsync(tournament, {
      authUser: sbwCurrentDetailAuthUser
    });

    if (!result.success) {
      if (result.requiresLogin) {
        window.location.href = getLoginUrlForCurrentPage();
        return;
      }

      alert(result.message || "Não foi possível confirmar o check-in.");
      return;
    }

    const registration = result.registration || result.participant || null;

    if (registration) {
      sbwCurrentDetailRegistration = registration;
      const participants = Array.isArray(tournament.participants) ? [...tournament.participants] : [];
      const registrationKey = String(registration.participantId || registration.id || registration.authUserId || "");
      const nextParticipants = participants.map((participant) => {
        const key = String(participant.participantId || participant.id || participant.authUserId || "");
        return key && key === registrationKey ? registration : participant;
      });

      if (!nextParticipants.some((participant) => String(participant.participantId || participant.id || participant.authUserId || "") === registrationKey)) {
        nextParticipants.push(registration);
      }

      tournament.participants = nextParticipants;
    }

    alert(result.message || "Check-in confirmado com sucesso.");
    renderTournament(tournament);
  } finally {
    sbwCurrentDetailRegistrationBusy = false;
  }
}

function sbwGetTournamentDetailView() {
  const rawView = String(getQueryParam("view") || "").trim().toLowerCase();
  const rawHash = String(window.location.hash || "").replace("#", "").trim().toLowerCase();
  const source = rawView || rawHash || "visao-geral";

  const viewMap = {
    overview: "visao-geral",
    "visao-geral": "visao-geral",
    geral: "visao-geral",
    cronograma: "cronograma",
    schedule: "cronograma",
    participantes: "participantes",
    participants: "participantes",
    estrutura: "chaves",
    bracket: "chaves",
    brackets: "chaves",
    chaves: "chaves",
    playoffs: "chaves",
    resultados: "resultados",
    results: "resultados",
    partidas: "resultados",
    matches: "resultados",
    regras: "regras",
    rules: "regras",
    inscricao: "inscricao",
    inscrição: "inscricao",
    registration: "inscricao"
  };

  return viewMap[source] || "visao-geral";
}

function sbwGetTournamentUrlKey(tournament) {
  return getQueryParam("id") || tournament?.slug || tournament?.id || "";
}

function sbwBuildTournamentViewUrl(tournament, view) {
  const urlKey = sbwGetTournamentUrlKey(tournament);
  const params = new URLSearchParams();
  params.set("id", urlKey);
  params.set("view", view || "visao-geral");
  return `detalhe-torneio.html?${params.toString()}`;
}

function sbwGetTournamentViewLabel(view) {
  const labels = {
    "visao-geral": "Visão geral",
    cronograma: "Cronograma",
    participantes: "Participantes",
    chaves: "Chaves",
    resultados: "Resultados",
    regras: "Regras",
    inscricao: "Inscrição"
  };

  return labels[view] || labels["visao-geral"];
}

function renderDetailNav(tournament, activeView) {
  const views = [
    ["visao-geral", "Visão geral"],
    ["cronograma", "Cronograma"],
    ["participantes", "Participantes"],
    ["chaves", "Chaves"],
    ["resultados", "Resultados"],
    ["regras", "Regras"],
    ["inscricao", "Inscrição"]
  ];

  return `
    <section class="detail-nav-section">
      <nav class="detail-nav" aria-label="Áreas do torneio">
        ${views.map(([view, label]) => `
          <a class="${activeView === view ? "is-active" : ""}" href="${escapeHTML(sbwBuildTournamentViewUrl(tournament, view))}">
            ${escapeHTML(label)}
          </a>
        `).join("")}
      </nav>
    </section>
  `;
}

function sbwGetCheckInDateValue(tournament, type = "end") {
  const metadata = tournament?.metadata && typeof tournament.metadata === "object" ? tournament.metadata : {};
  const settings = tournament?.settings && typeof tournament.settings === "object" ? tournament.settings : {};
  const keys = type === "start"
    ? ["checkInStartsAt", "checkinStartsAt", "check_in_starts_at", "checkInStart", "checkinStart", "checkInTime", "checkin"]
    : ["checkInEndsAt", "checkinEndsAt", "check_in_ends_at", "checkInEnd", "checkinEnd", "checkInDeadline"];

  for (const key of keys) {
    const value = tournament?.[key] || metadata?.[key] || settings?.[key];

    if (value) {
      return value;
    }
  }

  return "";
}

function sbwParseFlexibleDate(value, tournament) {
  if (!value) {
    return null;
  }

  const raw = String(value).trim();

  if (!raw) {
    return null;
  }

  const direct = new Date(raw);

  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  if (/^\d{1,2}:\d{2}$/.test(raw) && tournament?.startDate) {
    const composed = new Date(`${tournament.startDate}T${raw}:00`);
    return Number.isNaN(composed.getTime()) ? null : composed;
  }

  return null;
}

function sbwIsCheckInClosed(tournament) {
  const endValue = sbwGetCheckInDateValue(tournament, "end");
  const endDate = sbwParseFlexibleDate(endValue, tournament);

  if (endDate) {
    return Date.now() > endDate.getTime();
  }

  const status = String(tournament?.status || "").toLowerCase().replaceAll("-", "_");
  return ["structure_generated", "in_progress", "running", "finished", "completed"].includes(status);
}

function sbwIsCheckInOpen(tournament) {
  const startDate = sbwParseFlexibleDate(sbwGetCheckInDateValue(tournament, "start"), tournament);
  const endDate = sbwParseFlexibleDate(sbwGetCheckInDateValue(tournament, "end"), tournament);
  const now = Date.now();

  if (startDate && now < startDate.getTime()) {
    return false;
  }

  if (endDate && now > endDate.getTime()) {
    return false;
  }

  return Boolean(startDate || endDate || tournament?.checkInTime || tournament?.checkin);
}

function sbwGetPublicMatchTimeLabel(match) {
  const value = match?.scheduledAt || match?.scheduled_at || match?.date || match?.datetime || match?.startsAt || match?.starts_at || "";

  if (!value) {
    return "Horário a definir";
  }

  return formatDateTimeLabel(value);
}

function sbwIsPublicMatchPlayable(match) {
  return Boolean(getMatchPlayer(match, "A") && getMatchPlayer(match, "B"));
}

function sbwSortPublicMatchesForResults(matches) {
  return [...matches].sort((a, b) => {
    const statusWeight = {
      live: 0,
      pending: 1,
      bye: 2,
      completed: 3
    };
    const statusA = getMatchPublicStatus(a).className;
    const statusB = getMatchPublicStatus(b).className;
    const weightA = statusWeight[statusA] ?? 4;
    const weightB = statusWeight[statusB] ?? 4;

    if (weightA !== weightB) {
      return weightA - weightB;
    }

    const roundA = Number(a?.round || a?.roundNumber || a?.round_number || 0);
    const roundB = Number(b?.round || b?.roundNumber || b?.round_number || 0);

    if (Number.isFinite(roundA) && Number.isFinite(roundB) && roundA !== roundB) {
      return roundA - roundB;
    }

    const orderA = Number(a?.order || a?.matchOrder || a?.match_order || 0);
    const orderB = Number(b?.order || b?.matchOrder || b?.match_order || 0);

    if (Number.isFinite(orderA) && Number.isFinite(orderB) && orderA !== orderB) {
      return orderA - orderB;
    }

    return String(a?.id || "").localeCompare(String(b?.id || ""));
  });
}

function sbwRenderPublicMatchCard(match, options = {}) {
  const playerA = getMatchPlayer(match, "A");
  const playerB = getMatchPlayer(match, "B");
  const status = getMatchPublicStatus(match);
  const winnerSide = getMatchWinnerSide(match);
  const scoreA = getMatchScore(match, "scoreA");
  const scoreB = getMatchScore(match, "scoreB");
  const compact = options.compact ? " is-compact" : "";

  return `
    <article class="sbw-result-match-card ${escapeHTML(status.className)}${compact}">
      <header>
        <span>${escapeHTML(sbwGetPublicMatchBracketLabel(match))}</span>
        <strong>${escapeHTML(sbwGetPublicMatchRoundLabel(match))}</strong>
        <em class="league-match-status-pill ${escapeHTML(status.className)}">${escapeHTML(status.label)}</em>
      </header>

      <div class="sbw-result-match-row ${winnerSide === "A" ? "is-winner" : ""}">
        <b>${escapeHTML(getPlayerName(playerA))}</b>
        <span>${escapeHTML(scoreA)}</span>
      </div>

      <div class="sbw-result-match-row ${winnerSide === "B" ? "is-winner" : ""}">
        <b>${escapeHTML(getPlayerName(playerB))}</b>
        <span>${escapeHTML(scoreB)}</span>
      </div>

      <footer>
        <small>${escapeHTML(sbwGetPublicMatchTimeLabel(match))}</small>
        ${getMatchWinnerName(match) ? `<strong>Vencedor: ${escapeHTML(getMatchWinnerName(match))}</strong>` : `<strong>${sbwIsPublicMatchPlayable(match) ? "Aguardando resultado" : "Jogadores a definir"}</strong>`}
      </footer>
    </article>
  `;
}

function sbwRenderPublicMatchList(matches, emptyText, options = {}) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return `
      <div class="detail-card sbw-results-empty-card">
        <p>${escapeHTML(emptyText)}</p>
      </div>
    `;
  }

  return `
    <div class="sbw-results-match-list">
      ${matches.map((match) => sbwRenderPublicMatchCard(match, options)).join("")}
    </div>
  `;
}

function sbwRenderResultsDashboard(tournament) {
  const matches = sbwSortPublicMatchesForResults(sbwGetPublicMatches(tournament));
  const completedMatches = matches.filter((match) => getMatchPublicStatus(match).className === "completed").reverse();
  const liveMatches = matches.filter((match) => getMatchPublicStatus(match).className === "live");
  const pendingMatches = matches.filter((match) => ["pending", "bye"].includes(getMatchPublicStatus(match).className));
  const nextMatches = pendingMatches.filter((match) => sbwIsPublicMatchPlayable(match)).slice(0, 6);
  const featuredMatch = liveMatches[0] || nextMatches[0] || pendingMatches[0] || completedMatches[0] || null;
  const resultCounts = getResultCounts(tournament);
  const updatedAt = getResultsUpdatedAt(tournament);

  return `
    <div class="sbw-results-page">
      <div class="sbw-results-summary-grid">
        <article class="detail-card sbw-results-feature-card">
          <span>${liveMatches.length > 0 ? "Partida em andamento" : "Próxima partida"}</span>
          ${featuredMatch ? `
            <h4>${escapeHTML(getPlayerName(getMatchPlayer(featuredMatch, "A")))} <small>vs</small> ${escapeHTML(getPlayerName(getMatchPlayer(featuredMatch, "B")))}</h4>
            <p>${escapeHTML(sbwGetPublicMatchBracketLabel(featuredMatch))} • ${escapeHTML(sbwGetPublicMatchRoundLabel(featuredMatch))}</p>
            <div class="sbw-results-feature-score">
              <strong>${escapeHTML(getMatchScore(featuredMatch, "scoreA"))}</strong>
              <b>x</b>
              <strong>${escapeHTML(getMatchScore(featuredMatch, "scoreB"))}</strong>
            </div>
          ` : `
            <h4>Partidas a definir</h4>
            <p>As partidas aparecerão aqui quando a estrutura for gerada pelo organizador.</p>
          `}
        </article>

        <div class="sbw-results-stat-grid">
          <div class="info-mini-card"><span>Total de partidas</span><strong>${String(resultCounts.total)}</strong></div>
          <div class="info-mini-card"><span>Finalizadas</span><strong>${String(resultCounts.completed)}</strong></div>
          <div class="info-mini-card"><span>Em andamento</span><strong>${String(liveMatches.length)}</strong></div>
          <div class="info-mini-card"><span>Atualização</span><strong>${escapeHTML(formatDateTimeLabel(updatedAt))}</strong></div>
        </div>
      </div>

      ${renderFinalResultsSummary(tournament)}

      <div class="sbw-results-columns">
        <article class="detail-card sbw-results-block">
          <header>
            <span>Próximas partidas</span>
            <strong>${String(nextMatches.length)} listada${nextMatches.length === 1 ? "" : "s"}</strong>
          </header>
          ${sbwRenderPublicMatchList(nextMatches, "Nenhuma próxima partida jogável definida ainda.", { compact: true })}
        </article>

        <article class="detail-card sbw-results-block">
          <header>
            <span>Últimos resultados</span>
            <strong>${String(completedMatches.length)} resultado${completedMatches.length === 1 ? "" : "s"}</strong>
          </header>
          ${sbwRenderPublicMatchList(completedMatches.slice(0, 8), "Nenhum resultado público registrado ainda.", { compact: true })}
        </article>
      </div>

      <article class="detail-card sbw-results-block sbw-results-all-block">
        <header>
          <span>Todas as partidas</span>
          <strong>${String(matches.length)} partida${matches.length === 1 ? "" : "s"}</strong>
        </header>
        ${sbwRenderPublicMatchList(matches, "As partidas aparecerão aqui quando a estrutura do torneio for gerada.")}
      </article>
    </div>
  `;
}


function sbwGetTournamentFieldValue(tournament, keys) {
  const metadata = tournament?.metadata && typeof tournament.metadata === "object" ? tournament.metadata : {};
  const settings = tournament?.settings && typeof tournament.settings === "object" ? tournament.settings : {};
  const structure = getTournamentStructure(tournament) || {};
  const sources = [tournament || {}, settings, metadata, structure];

  for (const source of sources) {
    for (const key of keys) {
      const value = source?.[key];

      if (value !== null && value !== undefined && String(value).trim()) {
        return value;
      }
    }
  }

  return "";
}

function sbwComposeScheduleDateTime(dateValue, timeValue) {
  const dateText = String(dateValue || "").trim();
  const timeText = String(timeValue || "").trim();

  if (!dateText) {
    return timeText;
  }

  if (!timeText || dateText.includes("T") || dateText.includes(" ")) {
    return dateText;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateText) && /^\d{1,2}:\d{2}/.test(timeText)) {
    return `${dateText}T${timeText.length === 5 ? `${timeText}:00` : timeText}`;
  }

  return `${dateText} ${timeText}`;
}

function sbwGetScheduleDateLabel(value, fallback = "A definir") {
  if (!value) {
    return fallback;
  }

  const text = String(value).trim();

  if (!text) {
    return fallback;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return formatDate(text);
  }

  if (/^\d{1,2}:\d{2}/.test(text)) {
    return text;
  }

  return formatDateTimeLabel(text);
}

function sbwGetScheduleRangeLabel(item) {
  const startLabel = sbwGetScheduleDateLabel(item.startValue, "");
  const endLabel = sbwGetScheduleDateLabel(item.endValue, "");
  const dateLabel = sbwGetScheduleDateLabel(item.dateValue, "");

  if (startLabel && endLabel) {
    return `${startLabel} até ${endLabel}`;
  }

  if (startLabel) {
    return startLabel;
  }

  if (endLabel) {
    return `Até ${endLabel}`;
  }

  if (dateLabel) {
    return dateLabel;
  }

  return item.fallbackLabel || "A definir";
}

function sbwGetScheduleItemState(item) {
  const now = Date.now();
  const startDate = sbwParseFlexibleDate(item.startValue || item.dateValue, item.tournament);
  const endDate = sbwParseFlexibleDate(item.endValue, item.tournament);

  if (startDate && endDate) {
    if (now < startDate.getTime()) {
      return "upcoming";
    }

    if (now <= endDate.getTime()) {
      return "current";
    }

    return "completed";
  }

  if (item.mode === "period" && endDate) {
    return now <= endDate.getTime() ? "current" : "completed";
  }

  if (item.mode === "period" && startDate) {
    return now < startDate.getTime() ? "upcoming" : "current";
  }

  if (startDate) {
    return now < startDate.getTime() ? "upcoming" : "completed";
  }

  if (endDate) {
    return now <= endDate.getTime() ? "current" : "completed";
  }

  return item.fallbackState || "unknown";
}

function sbwGetScheduleStateMeta(state) {
  const states = {
    completed: {
      label: "Concluído",
      icon: "fa-circle-check"
    },
    current: {
      label: "Em andamento",
      icon: "fa-bolt"
    },
    upcoming: {
      label: "Próximo",
      icon: "fa-clock"
    },
    unknown: {
      label: "A definir",
      icon: "fa-circle-dot"
    }
  };

  return states[state] || states.unknown;
}

function sbwBuildTournamentScheduleItems(tournament, availability) {
  const matches = sbwSortPublicMatchesForResults(sbwGetPublicMatches(tournament));
  const playableMatches = matches.filter((match) => sbwIsPublicMatchPlayable(match));
  const firstMatchWithDate = playableMatches.find((match) => match?.scheduledAt || match?.scheduled_at || match?.date || match?.datetime || match?.startsAt || match?.starts_at);
  const completedMatches = matches.filter((match) => getMatchPublicStatus(match).className === "completed");
  const registrationStart = sbwGetTournamentFieldValue(tournament, [
    "registrationStartsAt",
    "registrationStartAt",
    "registrationStart",
    "registration_start_at",
    "registration_start",
    "registrationsOpenAt",
    "registrations_open_at",
    "inscriptionsOpenAt",
    "inscricoesAbertasEm"
  ]);
  const registrationEnd = sbwGetTournamentFieldValue(tournament, [
    "registrationEndsAt",
    "registrationEndAt",
    "registrationDeadline",
    "registration_end_at",
    "registration_deadline",
    "registrationsCloseAt",
    "registrations_close_at",
    "inscriptionsCloseAt",
    "inscricoesEncerramEm"
  ]);
  const checkInStart = sbwGetCheckInDateValue(tournament, "start");
  const checkInEnd = sbwGetCheckInDateValue(tournament, "end");
  const tournamentStart = sbwComposeScheduleDateTime(
    tournament?.startDate || tournament?.start_date || sbwGetTournamentFieldValue(tournament, ["startsAt", "starts_at", "startAt"]),
    tournament?.startTime || tournament?.start_time || ""
  );
  const tournamentEnd = sbwGetTournamentFieldValue(tournament, [
    "endDate",
    "end_date",
    "endsAt",
    "ends_at",
    "finishedAt",
    "finished_at",
    "completedAt",
    "completed_at"
  ]);
  const structureGeneratedAt = getStructureGeneratedAt(tournament);
  const firstMatchDate = firstMatchWithDate
    ? (firstMatchWithDate.scheduledAt || firstMatchWithDate.scheduled_at || firstMatchWithDate.date || firstMatchWithDate.datetime || firstMatchWithDate.startsAt || firstMatchWithDate.starts_at)
    : "";
  const resultsUpdatedAt = getResultsUpdatedAt(tournament);
  const rawStatus = sbwGetTournamentStatusKey(tournament);
  const registrationFallbackState = availability.open
    ? "current"
    : (["finished", "completed", "running", "in-progress", "structure-generated"].includes(rawStatus) ? "completed" : "upcoming");
  const checkInFallbackState = sbwIsCheckInClosed(tournament)
    ? "completed"
    : (sbwIsCheckInOpen(tournament) ? "current" : "upcoming");

  return [
    {
      key: "registration",
      tournament,
      mode: "period",
      icon: "fa-ticket",
      eyebrow: "Inscrições",
      title: "Janela de inscrição",
      description: availability.open
        ? "As inscrições estão abertas para jogadores cadastrados na plataforma -SBW-."
        : "Acompanhe o status público da inscrição e o limite de vagas definido pelo organizador.",
      startValue: registrationStart,
      endValue: registrationEnd,
      fallbackLabel: availability.shortLabel || availability.label,
      fallbackState: registrationFallbackState,
      href: sbwBuildTournamentViewUrl(tournament, "inscricao"),
      actionLabel: "Ver inscrição"
    },
    {
      key: "checkin",
      tournament,
      mode: "period",
      icon: "fa-clipboard-check",
      eyebrow: "Check-in",
      title: "Confirmação de presença",
      description: "Quem estiver inscrito deve confirmar presença quando a janela de check-in estiver aberta.",
      startValue: checkInStart,
      endValue: checkInEnd,
      fallbackLabel: tournament.checkInTime || tournament.checkinStartsAt || tournament.checkin || "A definir",
      fallbackState: checkInFallbackState,
      href: sbwBuildTournamentViewUrl(tournament, "inscricao"),
      actionLabel: "Ver check-in"
    },
    {
      key: "start",
      tournament,
      icon: "fa-flag-checkered",
      eyebrow: "Início",
      title: "Início do torneio",
      description: "Data principal definida pelo organizador para início das atividades competitivas.",
      dateValue: tournamentStart,
      fallbackLabel: "Data a definir",
      fallbackState: rawStatus === "draft" ? "upcoming" : "unknown"
    },
    {
      key: "structure",
      tournament,
      icon: "fa-code-branch",
      eyebrow: "Chaves",
      title: "Estrutura competitiva",
      description: hasGeneratedStructure(tournament)
        ? "A estrutura pública já foi gerada e pode ser acompanhada na aba Chaves."
        : "A estrutura será gerada pelo organizador após a etapa de inscrições/check-in.",
      dateValue: structureGeneratedAt,
      fallbackLabel: hasGeneratedStructure(tournament) ? "Estrutura publicada" : "Aguardando geração",
      fallbackState: hasGeneratedStructure(tournament) ? "completed" : "upcoming",
      href: sbwBuildTournamentViewUrl(tournament, "chaves"),
      actionLabel: "Ver chaves"
    },
    {
      key: "matches",
      tournament,
      icon: "fa-gamepad",
      eyebrow: "Partidas",
      title: "Primeiras partidas",
      description: firstMatchWithDate
        ? "Primeira partida pública encontrada na estrutura do torneio."
        : "As partidas aparecerão quando a estrutura for gerada e os confrontos forem definidos.",
      dateValue: firstMatchDate,
      fallbackLabel: playableMatches.length > 0 ? `${playableMatches.length} partida${playableMatches.length === 1 ? "" : "s"} definida${playableMatches.length === 1 ? "" : "s"}` : "A definir",
      fallbackState: playableMatches.length > 0 ? "current" : "upcoming",
      href: sbwBuildTournamentViewUrl(tournament, "resultados"),
      actionLabel: "Ver partidas"
    },
    {
      key: "results",
      tournament,
      icon: "fa-trophy",
      eyebrow: "Resultados",
      title: "Resultados e encerramento",
      description: completedMatches.length > 0
        ? "Resultados públicos já foram encontrados na estrutura do torneio."
        : "Os resultados finais serão exibidos quando o organizador lançar e finalizar as partidas.",
      dateValue: tournamentEnd || resultsUpdatedAt,
      fallbackLabel: completedMatches.length > 0 ? `${completedMatches.length} resultado${completedMatches.length === 1 ? "" : "s"}` : "Aguardando resultados",
      fallbackState: ["finished", "completed"].includes(rawStatus) ? "completed" : (completedMatches.length > 0 ? "current" : "upcoming"),
      href: sbwBuildTournamentViewUrl(tournament, "resultados"),
      actionLabel: "Ver resultados"
    }
  ];
}

function sbwRenderScheduleItem(item, index) {
  const state = sbwGetScheduleItemState(item);
  const stateMeta = sbwGetScheduleStateMeta(state);
  const rangeLabel = sbwGetScheduleRangeLabel(item);

  return `
    <article class="schedule-step-card ${escapeHTML(state)}">
      <div class="schedule-step-marker">
        <i class="fa-solid ${escapeHTML(item.icon)}"></i>
        <span>${String(index + 1).padStart(2, "0")}</span>
      </div>
      <div class="schedule-step-content">
        <header>
          <span>${escapeHTML(item.eyebrow)}</span>
          <em class="schedule-state-pill ${escapeHTML(state)}"><i class="fa-solid ${escapeHTML(stateMeta.icon)}"></i>${escapeHTML(stateMeta.label)}</em>
        </header>
        <h4>${escapeHTML(item.title)}</h4>
        <strong>${escapeHTML(rangeLabel)}</strong>
        <p>${escapeHTML(item.description)}</p>
        ${item.href ? `<a href="${escapeHTML(item.href)}">${escapeHTML(item.actionLabel || "Abrir")} <i class="fa-solid fa-arrow-right"></i></a>` : ""}
      </div>
    </article>
  `;
}

function sbwRenderSchedulePublicPanel(tournament, availability) {
  const items = sbwBuildTournamentScheduleItems(tournament, availability);
  const status = getStatusInfo(tournament.status);
  const currentItem = items.find((item) => sbwGetScheduleItemState(item) === "current");
  const nextItem = items.find((item) => sbwGetScheduleItemState(item) === "upcoming") || currentItem || items[items.length - 1];
  const completedCount = items.filter((item) => sbwGetScheduleItemState(item) === "completed").length;
  const definedCount = items.filter((item) => sbwGetScheduleItemState(item) !== "unknown").length;

  return `
    <div class="schedule-public-page">
      <article class="schedule-public-hero-card">
        <div>
          <span>Agenda pública</span>
          <h4>${escapeHTML(currentItem ? currentItem.title : "Cronograma do torneio")}</h4>
          <p>${escapeHTML(currentItem ? currentItem.description : "Acompanhe as etapas principais do torneio na plataforma -SBW-.")}</p>
        </div>
        <div class="schedule-public-status ${escapeHTML(status.className)}">
          <small>Status atual</small>
          <strong>${escapeHTML(status.label)}</strong>
        </div>
      </article>

      <div class="schedule-public-metrics">
        <div class="info-mini-card"><span>Etapas concluídas</span><strong>${String(completedCount)} / ${String(items.length)}</strong></div>
        <div class="info-mini-card"><span>Etapas definidas</span><strong>${String(definedCount)} / ${String(items.length)}</strong></div>
        <div class="info-mini-card"><span>Próxima etapa</span><strong>${escapeHTML(nextItem?.title || "A definir")}</strong></div>
        <div class="info-mini-card"><span>Inscrição</span><strong>${escapeHTML(availability.shortLabel)}</strong></div>
      </div>

      <div class="schedule-public-layout">
        <article class="schedule-public-main-card">
          <div class="schedule-public-card-head">
            <span>Linha do tempo</span>
            <strong>Etapas do torneio</strong>
            <p>As datas aparecem conforme forem configuradas pelo organizador. Etapas sem horário definido continuam visíveis como pendentes.</p>
          </div>
          <div class="schedule-track">
            ${items.map((item, index) => sbwRenderScheduleItem(item, index)).join("")}
          </div>
        </article>

        <aside class="schedule-public-side-card">
          <span>Resumo rápido</span>
          <div class="rules-summary-list schedule-summary-list">
            <div><small>Organizador</small><strong>${escapeHTML(sbwGetTournamentOrganizerData(tournament).displayName || getOrganizer(tournament))}</strong></div>
            <div><small>Formato</small><strong>${escapeHTML(getFormatLabel(getTournamentFormat(tournament)))}</strong></div>
            <div><small>Início</small><strong>${escapeHTML(sbwGetScheduleDateLabel(sbwComposeScheduleDateTime(tournament.startDate || tournament.start_date, tournament.startTime || tournament.start_time || ""), "A definir"))}</strong></div>
            <div><small>Check-in</small><strong>${escapeHTML(sbwGetScheduleRangeLabel({ startValue: sbwGetCheckInDateValue(tournament, "start"), endValue: sbwGetCheckInDateValue(tournament, "end"), fallbackLabel: tournament.checkInTime || tournament.checkin || "A definir" }))}</strong></div>
          </div>
          <div class="schedule-side-actions">
            <a class="detail-btn secondary" href="${escapeHTML(sbwBuildTournamentViewUrl(tournament, "inscricao"))}"><i class="fa-solid fa-ticket"></i> Inscrição</a>
            <a class="detail-btn secondary" href="${escapeHTML(sbwBuildTournamentViewUrl(tournament, "participantes"))}"><i class="fa-solid fa-users"></i> Participantes</a>
            ${renderTournamentOrganizerActionButton(tournament, "schedule-organizer-button")}
          </div>
        </aside>
      </div>
    </div>
  `;
}

function sbwRenderOverviewQuickActions(tournament) {
  return `
    <div class="overview-action-grid">
      <a class="detail-btn" href="${escapeHTML(sbwBuildTournamentViewUrl(tournament, "inscricao"))}">
        <i class="fa-solid fa-ticket"></i>
        Inscrição / check-in
      </a>
      <a class="detail-btn secondary" href="${escapeHTML(sbwBuildTournamentViewUrl(tournament, "participantes"))}">
        <i class="fa-solid fa-users"></i>
        Participantes
      </a>
      <a class="detail-btn secondary" href="${escapeHTML(sbwBuildTournamentViewUrl(tournament, "chaves"))}">
        <i class="fa-solid fa-code-branch"></i>
        Chaves
      </a>
      <a class="detail-btn secondary" href="${escapeHTML(sbwBuildTournamentViewUrl(tournament, "resultados"))}">
        <i class="fa-solid fa-chart-line"></i>
        Resultados
      </a>
      ${renderTournamentOrganizerActionButton(tournament, "overview-organizer-button")}
    </div>
  `;
}

function sbwRenderOverviewMatchPreview(match) {
  if (!match) {
    return `
      <article class="overview-match-preview is-empty">
        <span>Próxima partida</span>
        <strong>Partidas a definir</strong>
        <p>Quando o organizador gerar a estrutura, a próxima partida aparecerá neste resumo.</p>
        <a href="#" aria-disabled="true">Aguardando estrutura</a>
      </article>
    `;
  }

  const status = getMatchPublicStatus(match);
  const playerA = getMatchPlayer(match, "A");
  const playerB = getMatchPlayer(match, "B");
  const winnerSide = getMatchWinnerSide(match);

  return `
    <article class="overview-match-preview ${escapeHTML(status.className)}">
      <span>${status.className === "live" ? "Partida em andamento" : "Próxima partida"}</span>
      <header>
        <strong>${escapeHTML(sbwGetPublicMatchBracketLabel(match))}</strong>
        <em class="league-match-status-pill ${escapeHTML(status.className)}">${escapeHTML(status.label)}</em>
      </header>
      <div class="overview-match-lines">
        <div class="${winnerSide === "A" ? "is-winner" : ""}">
          <b>${escapeHTML(getPlayerName(playerA))}</b>
          <small>${escapeHTML(getPlayerTeam(playerA))}</small>
          <strong>${escapeHTML(getMatchScore(match, "scoreA"))}</strong>
        </div>
        <div class="${winnerSide === "B" ? "is-winner" : ""}">
          <b>${escapeHTML(getPlayerName(playerB))}</b>
          <small>${escapeHTML(getPlayerTeam(playerB))}</small>
          <strong>${escapeHTML(getMatchScore(match, "scoreB"))}</strong>
        </div>
      </div>
      <footer>
        <small>${escapeHTML(sbwGetPublicMatchRoundLabel(match))} • ${escapeHTML(sbwGetPublicMatchTimeLabel(match))}</small>
        <a href="${escapeHTML(sbwBuildTournamentViewUrl(match.tournament || {}, "resultados"))}" data-overview-results-link>Ver resultados</a>
      </footer>
    </article>
  `;
}

function sbwRenderOverviewLatestResults(tournament, completedMatches) {
  if (!Array.isArray(completedMatches) || completedMatches.length === 0) {
    return `
      <article class="overview-result-card is-empty">
        <span>Últimos resultados</span>
        <strong>Nenhum resultado público ainda</strong>
        <p>Os resultados aparecerão aqui conforme o organizador lançar as partidas.</p>
      </article>
    `;
  }

  return `
    <article class="overview-result-card">
      <span>Últimos resultados</span>
      <div class="overview-result-list">
        ${completedMatches.map((match) => `
          <a href="${escapeHTML(sbwBuildTournamentViewUrl(tournament, "resultados"))}">
            <small>${escapeHTML(sbwGetPublicMatchRoundLabel(match))}</small>
            <div>
              <b>${escapeHTML(getPlayerName(getMatchPlayer(match, "A")))}</b>
              <strong>${escapeHTML(getMatchScore(match, "scoreA"))} - ${escapeHTML(getMatchScore(match, "scoreB"))}</strong>
              <b>${escapeHTML(getPlayerName(getMatchPlayer(match, "B")))}</b>
            </div>
          </a>
        `).join("")}
      </div>
    </article>
  `;
}

function sbwRenderOverviewTimelineMini(tournament, availability) {
  const items = sbwBuildTournamentScheduleItems(tournament, availability);

  return `
    <article class="overview-timeline-card">
      <header>
        <span>Datas principais</span>
        <a href="${escapeHTML(sbwBuildTournamentViewUrl(tournament, "cronograma"))}">Ver cronograma <i class="fa-solid fa-arrow-right"></i></a>
      </header>
      <div class="overview-timeline-list">
        ${items.slice(0, 6).map((item) => {
          const state = sbwGetScheduleItemState(item);
          const stateMeta = sbwGetScheduleStateMeta(state);
          return `
            <div class="overview-timeline-item ${escapeHTML(state)}">
              <i class="fa-solid ${escapeHTML(item.icon)}"></i>
              <div>
                <small>${escapeHTML(item.eyebrow)}</small>
                <strong>${escapeHTML(item.title)}</strong>
                <span>${escapeHTML(sbwGetScheduleRangeLabel(item))}</span>
              </div>
              <em>${escapeHTML(stateMeta.label)}</em>
            </div>
          `;
        }).join("")}
      </div>
    </article>
  `;
}

function sbwRenderOverviewLegendCard(tournament) {
  const format = getTournamentFormat(tournament);
  const isDouble = format === "double-elimination";

  return `
    <article class="overview-side-card">
      <span>Legenda rápida</span>
      <div class="overview-legend-list">
        <b><i class="line win"></i> Vencedor / confirmado</b>
        <b><i class="line pending"></i> Pendente</b>
        <b><i class="badge-you">Você</i> usuário logado</b>
        <b><i class="bo">BO</i> Melhor de (n)</b>
        ${isDouble ? `<b><i class="fa-solid fa-code-branch"></i> Winners, Lower e Grand Final</b>` : ""}
      </div>
    </article>
  `;
}


function sbwBuildPublicOperationalStatus(tournament, availability) {
  const statusKey = sbwGetTournamentStatusKey(tournament).replaceAll("-", "_");
  const status = getStatusInfo(tournament.status);
  const structureReady = hasGeneratedStructure(tournament);
  const resultCounts = getResultCounts(tournament);
  const checkInOpen = sbwIsCheckInOpen(tournament);
  const checkInClosed = sbwIsCheckInClosed(tournament);
  const registrationWindow = sbwGetRegistrationWindowState(tournament);
  const finished = ["finished", "completed", "finalizado", "encerrado"].includes(statusKey) || Boolean(getFinalResults(tournament));
  const running = ["structure_generated", "in_progress", "running", "em_andamento"].includes(statusKey) || resultCounts.completed > 0;
  const participantsStats = sbwGetParticipantsPublicStats(tournament, availability);
  const checkedInCount = participantsStats.checkedIn.length;
  const activeCount = participantsStats.active.length;

  if (finished) {
    return {
      className: "finished",
      icon: "fa-trophy",
      eyebrow: "Torneio encerrado",
      title: "Resultados finais publicados",
      message: "O torneio já foi concluído. Consulte resultados, pódio e histórico público nas abas do torneio.",
      actionView: "resultados",
      actionLabel: "Ver resultados",
      facts: [
        { label: "Status", value: status.label || "Encerrado" },
        { label: "Resultados", value: `${resultCounts.completed} / ${resultCounts.total || resultCounts.completed}` },
        { label: "Inscrição", value: availability.shortLabel || "Encerrada" }
      ]
    };
  }

  if (running) {
    return {
      className: structureReady ? "running" : "open",
      icon: structureReady ? "fa-code-branch" : "fa-play",
      eyebrow: "Torneio em andamento",
      title: structureReady ? "Estrutura competitiva publicada" : "Torneio iniciado",
      message: structureReady
        ? "Acompanhe chaves, partidas em andamento e resultados conforme o organizador atualizar a competição."
        : "O torneio já saiu da etapa de inscrição. A estrutura pública será exibida quando o organizador publicar.",
      actionView: structureReady ? "chaves" : "resultados",
      actionLabel: structureReady ? "Ver chaves" : "Ver partidas",
      facts: [
        { label: "Status", value: status.label || "Em andamento" },
        { label: "Check-in", value: checkInClosed ? `${checkedInCount} confirmado${checkedInCount === 1 ? "" : "s"}` : "Encerrando" },
        { label: "Resultados", value: `${resultCounts.completed} / ${resultCounts.total || 0}` }
      ]
    };
  }

  if (checkInOpen && activeCount > 0) {
    return {
      className: "checkin",
      icon: "fa-clipboard-check",
      eyebrow: "Check-in aberto",
      title: "Jogadores inscritos devem confirmar presença",
      message: "Quem já se inscreveu precisa fazer check-in dentro da janela definida para entrar na lista final usada pelo organizador.",
      actionView: "inscricao",
      actionLabel: "Fazer check-in",
      facts: [
        { label: "Inscritos", value: String(activeCount) },
        { label: "Confirmados", value: String(checkedInCount) },
        { label: "Janela", value: sbwGetScheduleRangeLabel({ startValue: sbwGetCheckInDateValue(tournament, "start"), endValue: sbwGetCheckInDateValue(tournament, "end"), fallbackLabel: "Aberta" }) }
      ]
    };
  }

  if (availability.open) {
    return {
      className: "open",
      icon: "fa-ticket",
      eyebrow: "Inscrições abertas",
      title: "Torneio recebendo participantes",
      message: "Jogadores logados podem se inscrever. A inscrição não substitui o check-in, que será usado para confirmar presença antes do início.",
      actionView: "inscricao",
      actionLabel: "Inscrever-se",
      facts: [
        { label: "Vagas", value: `${availability.participantsCount} / ${availability.maxParticipants || "∞"}` },
        { label: "Inscrição", value: availability.shortLabel || "Aberta" },
        { label: "Check-in", value: sbwGetScheduleRangeLabel({ startValue: sbwGetCheckInDateValue(tournament, "start"), endValue: sbwGetCheckInDateValue(tournament, "end"), fallbackLabel: "A definir" }) }
      ]
    };
  }

  if (registrationWindow.state === "waiting") {
    return {
      className: "draft",
      icon: "fa-hourglass-half",
      eyebrow: "Inscrições programadas",
      title: "Aguardando abertura das inscrições",
      message: registrationWindow.reason || "A janela de inscrição ainda não começou. Volte no horário indicado pelo organizador.",
      actionView: "cronograma",
      actionLabel: "Ver cronograma",
      facts: [
        { label: "Status", value: status.label || "Publicado" },
        { label: "Inscrição", value: availability.shortLabel || "Em breve" },
        { label: "Participantes", value: String(activeCount) }
      ]
    };
  }

  return {
    className: availability.className || status.className || "draft",
    icon: availability.className === "closed" ? "fa-lock" : "fa-circle-info",
    eyebrow: availability.label || status.label || "Status do torneio",
    title: availability.open ? "Torneio disponível" : "Aguardando próxima etapa",
    message: availability.reason || "Acompanhe esta página para novas informações do organizador.",
    actionView: availability.className === "closed" ? "cronograma" : "inscricao",
    actionLabel: availability.className === "closed" ? "Ver cronograma" : "Ver inscrição",
    facts: [
      { label: "Status", value: status.label || "A definir" },
      { label: "Inscrição", value: availability.shortLabel || "Fechada" },
      { label: "Participantes", value: String(activeCount) }
    ]
  };
}

function sbwRenderPublicOperationalStatus(tournament, availability) {
  const state = sbwBuildPublicOperationalStatus(tournament, availability);

  return `
    <article class="overview-operational-status-card ${escapeHTML(state.className)}">
      <div class="overview-operational-status-icon">
        <i class="fa-solid ${escapeHTML(state.icon)}"></i>
      </div>
      <div class="overview-operational-status-copy">
        <span>${escapeHTML(state.eyebrow)}</span>
        <strong>${escapeHTML(state.title)}</strong>
        <p>${escapeHTML(state.message)}</p>
      </div>
      <div class="overview-operational-status-facts">
        ${(state.facts || []).map((fact) => `
          <div>
            <small>${escapeHTML(fact.label)}</small>
            <b>${escapeHTML(fact.value)}</b>
          </div>
        `).join("")}
      </div>
      <a class="detail-btn secondary overview-operational-status-action" href="${escapeHTML(sbwBuildTournamentViewUrl(tournament, state.actionView || "cronograma"))}">
        ${escapeHTML(state.actionLabel || "Abrir etapa")}
        <i class="fa-solid fa-arrow-right"></i>
      </a>
    </article>
  `;
}

function renderTournamentOverviewCards(tournament, availability) {
  const status = getStatusInfo(tournament.status);
  const matches = sbwSortPublicMatchesForResults(sbwGetPublicMatches(tournament));
  const completedMatches = matches.filter((match) => getMatchPublicStatus(match).className === "completed").slice(-3).reverse();
  const liveMatches = matches.filter((match) => getMatchPublicStatus(match).className === "live");
  const pendingMatches = matches.filter((match) => ["pending", "bye"].includes(getMatchPublicStatus(match).className));
  const nextPlayableMatch = pendingMatches.find(sbwIsPublicMatchPlayable) || pendingMatches[0] || null;
  const featuredMatch = liveMatches[0] || nextPlayableMatch || completedMatches[0] || null;
  const description = getDescription(tournament);
  const resultCounts = getResultCounts(tournament);
  const participantsStats = sbwGetParticipantsPublicStats(tournament, availability);
  const maxParticipantsLabel = participantsStats.maxParticipants || getMaxParticipants(tournament);
  const structureReady = hasGeneratedStructure(tournament);
  const generatedAt = getStructureGeneratedAt(tournament);
  const checkInLabel = sbwGetScheduleRangeLabel({
    startValue: sbwGetCheckInDateValue(tournament, "start"),
    endValue: sbwGetCheckInDateValue(tournament, "end"),
    fallbackLabel: tournament.checkInTime || tournament.checkinStartsAt || tournament.checkin || "A definir"
  });
  const currentScheduleItem = sbwBuildTournamentScheduleItems(tournament, availability).find((item) => sbwGetScheduleItemState(item) === "current");
  const organizerName = sbwGetTournamentOrganizerData(tournament).displayName || getOrganizer(tournament);
  const rankingState = sbwGetTournamentDetailRankingState(tournament);

  return `
    <div class="overview-final-page">
      <section class="overview-hero-summary">
        <div class="overview-hero-copy">
          <span>Resumo competitivo</span>
          <h4>${escapeHTML(tournament.name || tournament.title || "Torneio")}</h4>
          <p>${escapeHTML(description)}</p>
        </div>
        <div class="overview-status-panel ${escapeHTML(status.className)}">
          <small>Status atual</small>
          <strong>${escapeHTML(status.label)}</strong>
          <em>${escapeHTML(currentScheduleItem ? `Etapa: ${currentScheduleItem.title}` : availability.label)}</em>
        </div>
      </section>

      ${sbwRenderPublicOperationalStatus(tournament, availability)}

      <section class="overview-metric-grid">
        <article class="overview-metric-card ${escapeHTML(availability.className)}">
          <span>Inscrição</span>
          <strong>${escapeHTML(availability.shortLabel)}</strong>
          <small>${escapeHTML(availability.reason || availability.label)}</small>
        </article>
        <article class="overview-metric-card">
          <span>Participantes</span>
          <strong>${escapeHTML(participantsStats.active.length)} / ${escapeHTML(maxParticipantsLabel)}</strong>
          <small>${participantsStats.checkInClosed ? `${escapeHTML(participantsStats.checkedIn.length)} confirmados` : "Inscritos reais carregados"}</small>
        </article>
        <article class="overview-metric-card ${structureReady ? "running" : "draft"}">
          <span>Chaves</span>
          <strong>${structureReady ? "Publicada" : "Aguardando"}</strong>
          <small>${structureReady ? `Gerada em ${escapeHTML(formatDateTimeLabel(generatedAt))}` : "A estrutura será exibida na aba Chaves"}</small>
        </article>
        <article class="overview-metric-card ${resultCounts.completed > 0 ? "open" : "draft"}">
          <span>Resultados</span>
          <strong>${escapeHTML(resultCounts.completed)} / ${escapeHTML(resultCounts.total)}</strong>
          <small>${resultCounts.total > 0 ? "Partidas públicas encontradas" : "Aguardando partidas"}</small>
        </article>
        <article class="overview-metric-card ${escapeHTML(rankingState.className)}">
          <span>Ranking</span>
          <strong>${escapeHTML(rankingState.shortLabel)}</strong>
          <small>${escapeHTML(rankingState.description)}</small>
        </article>
      </section>

      <section class="overview-content-grid">
        <div class="overview-main-stack">
          ${renderFinalResultsSummary(tournament)}

          <article class="overview-about-card">
            <div>
              <span>Sobre o torneio</span>
              <h4>Informações principais</h4>
              <p>${escapeHTML(description)}</p>
            </div>
            <div class="overview-about-facts">
              <div><small>Organizador</small><strong>${escapeHTML(organizerName)}</strong></div>
              <div><small>Formato</small><strong>${escapeHTML(getFormatLabel(getTournamentFormat(tournament)))}</strong></div>
              <div><small>Jogo</small><strong>${escapeHTML(tournament.game || "A definir")}</strong></div>
              <div><small>Plataforma</small><strong>${escapeHTML(tournament.platform || "A definir")}</strong></div>
              <div><small>Ranking</small><strong>${escapeHTML(rankingState.summaryLabel)}</strong></div>
            </div>
            ${sbwRenderOverviewQuickActions(tournament)}
          </article>

          ${sbwRenderTournamentFormatGuide(tournament)}

          <div class="overview-match-grid">
            ${sbwRenderOverviewMatchPreview(featuredMatch ? { ...featuredMatch, tournament } : null)}
            ${sbwRenderOverviewLatestResults(tournament, completedMatches)}
          </div>

          ${sbwRenderOverviewTimelineMini(tournament, availability)}
        </div>

        <aside class="overview-side-stack">
          <article class="overview-side-card overview-side-card--highlight">
            <span>Próxima etapa</span>
            <strong>${escapeHTML(currentScheduleItem ? currentScheduleItem.title : "Acompanhar inscrição")}</strong>
            <p>${escapeHTML(currentScheduleItem ? currentScheduleItem.description : availability.reason)}</p>
            <a class="detail-btn secondary" href="${escapeHTML(sbwBuildTournamentViewUrl(tournament, currentScheduleItem?.key === "registration" ? "inscricao" : "cronograma"))}">
              <i class="fa-solid fa-arrow-right"></i>
              Abrir etapa
            </a>
          </article>

          <article class="overview-side-card">
            <span>Datas</span>
            <div class="rules-summary-list overview-summary-list">
              <div><small>Início</small><strong>${escapeHTML(sbwGetScheduleDateLabel(sbwComposeScheduleDateTime(tournament.startDate || tournament.start_date, tournament.startTime || tournament.start_time || ""), "A definir"))}</strong></div>
              <div><small>Check-in</small><strong>${escapeHTML(checkInLabel)}</strong></div>
              <div><small>Premiação</small><strong>${escapeHTML(getPrize(tournament))}</strong></div>
              <div><small>Organizador</small><strong>${escapeHTML(organizerName)}</strong></div>
            </div>
          </article>

          ${sbwRenderOverviewLegendCard(tournament)}

          <article class="overview-side-card">
            <span>Acesso rápido</span>
            <div class="overview-side-actions">
              <a class="detail-btn secondary" href="${escapeHTML(sbwBuildTournamentViewUrl(tournament, "regras"))}"><i class="fa-solid fa-scroll"></i> Regras</a>
              <a class="detail-btn secondary" href="${escapeHTML(sbwBuildTournamentViewUrl(tournament, "cronograma"))}"><i class="fa-solid fa-calendar-days"></i> Cronograma</a>
              ${renderTournamentOrganizerActionButton(tournament, "overview-side-organizer-button")}
            </div>
          </article>
        </aside>
      </section>
    </div>
  `;
}

function renderTournamentViewContent(tournament, activeView, registrationState, registrationAvailability) {
  if (activeView === "cronograma") {
    return `
      <section class="detail-section detail-section-page" id="cronograma">
        <div class="detail-section-header">
          <span>Cronograma</span>
          <h3>Agenda pública do torneio</h3>
          <p>Linha do tempo com inscrições, check-in, início, chaves, partidas e resultados do torneio.</p>
        </div>
        ${sbwRenderSchedulePublicPanel(tournament, registrationAvailability)}
      </section>
    `;
  }

  if (activeView === "participantes") {
    const stats = sbwGetParticipantsPublicStats(tournament, registrationAvailability);

    return `
      <section class="detail-section detail-section-page" id="participantes">
        <div class="detail-section-header">
          <span>Participantes</span>
          <h3>${stats.checkInClosed ? "Participantes confirmados e auditoria" : "Inscritos do torneio"}</h3>
          <p>${stats.checkInClosed
            ? "Depois do fechamento do check-in, os confirmados ficam em destaque e os demais registros aparecem separados quando existirem."
            : "Antes do fechamento do check-in, a página mostra todos os jogadores inscritos no torneio pela plataforma -SBW-."
          }</p>
        </div>
        ${renderParticipantsPublicPage(tournament, registrationAvailability)}
      </section>
    `;
  }

  if (activeView === "chaves") {
    return `
      <section class="detail-section detail-section-page detail-section-bracket-page" id="estrutura">
        <div class="detail-section-header">
          <span>Competição</span>
          <h3>Chaves e estrutura pública</h3>
          <p>A bracket aparece somente nesta área, preservando a Visão geral limpa.</p>
        </div>
        ${renderStructure(tournament)}
      </section>
    `;
  }

  if (activeView === "resultados") {
    return `
      <section class="detail-section detail-section-page" id="resultados">
        <div class="detail-section-header">
          <span>Partidas</span>
          <h3>Resultados e partidas públicas</h3>
          <p>Área pública para acompanhar próximas partidas, partidas em andamento e últimos resultados do torneio.</p>
        </div>
        ${sbwRenderResultsDashboard(tournament)}
      </section>
    `;
  }

  if (activeView === "regras") {
    return `
      <section class="detail-section detail-section-page" id="regras">
        <div class="detail-section-header">
          <span>Regras</span>
          <h3>Regulamento público do torneio</h3>
          <p>Área dedicada às regras publicadas pelo organizador, com resumo competitivo e acesso rápido ao organizador.</p>
        </div>
        ${sbwRenderRulesPublicPanel(tournament)}
      </section>
    `;
  }

  if (activeView === "inscricao") {
    return `
      <section class="detail-section detail-section-page" id="inscricao">
        <div class="detail-section-header">
          <span>Inscrição</span>
          <h3>Participar do torneio</h3>
          <p>Jogadores cadastrados na plataforma -SBW- podem se inscrever quando as inscrições estiverem abertas.</p>
        </div>
        ${renderRegistrationPanel(tournament, registrationState, registrationAvailability)}
      </section>
    `;
  }

  return `
    <section class="detail-section detail-section-page" id="visao-geral">
      <div class="detail-section-header">
        <span>Visão geral</span>
        <h3>Informações do torneio</h3>
        <p>Resumo principal, datas, legenda, próximos jogos e resultados ficam concentrados nesta área.</p>
      </div>
      ${renderTournamentOverviewCards(tournament, registrationAvailability)}
    </section>
  `;
}

function renderTournament(tournament) {
  const status = getStatusInfo(tournament.status);
  const participantsCount = getParticipantsCount(tournament);
  const maxParticipants = getMaxParticipants(tournament);
  const activeView = sbwGetTournamentDetailView();
  const registrationAvailability = sbwGetRegistrationAvailability(tournament);
  const registrationOpen = registrationAvailability.open;
  const registrationState = sbwBuildRegistrationViewState(tournament, registrationOpen);
  const rankingState = sbwGetTournamentDetailRankingState(tournament);
  const alreadyRegistered = registrationState.alreadyRegistered;
  const registrationButtonLabel = registrationState.buttonLabel;
  const registrationButtonDisabled = registrationState.disabled ? "disabled" : "";

  document.title = `${tournament.name || "Torneio"} — ${sbwGetTournamentViewLabel(activeView)} | -SBW-`;

  root.innerHTML = `
    <div class="tournament-detail-page detail-view-${escapeHTML(activeView)}">
      <section class="detail-topbar" aria-label="Navegação do torneio">
        <a href="torneios.html" class="detail-back-link">
          <i class="fa-solid fa-arrow-left"></i>
          Torneios
        </a>
      </section>

      <section class="detail-hero"${sbwBuildTournamentHeroStyle(tournament)}>
        <div class="detail-hero-content">
          <div class="detail-hero-grid">
            <div class="detail-hero-main">
              <span class="status-pill ${escapeHTML(status.className)}">
                ${escapeHTML(status.label)}
              </span>
              <h2>${escapeHTML(tournament.name || tournament.title || "Torneio sem nome")}</h2>
              <p>${escapeHTML(getDescription(tournament))}</p>
              <div class="detail-hero-tags">
                <span><i class="fa-solid fa-gamepad"></i> ${escapeHTML(tournament.game || "Jogo a definir")}</span>
                <span><i class="fa-solid fa-sitemap"></i> ${escapeHTML(getFormatLabel(getTournamentFormat(tournament)))}</span>
                <span><i class="fa-solid fa-tv"></i> ${escapeHTML(tournament.platform || "Plataforma a definir")}</span>
                <span><i class="fa-solid fa-shield-halved"></i> ${escapeHTML(getOrganizer(tournament))}</span>
                <span class="detail-registration-tag ${escapeHTML(registrationAvailability.className)}"><i class="fa-solid fa-ticket"></i> ${escapeHTML(registrationAvailability.label)}</span>
                <span class="detail-ranking-tag ${escapeHTML(rankingState.className)}" title="${escapeHTML(rankingState.description)}"><i class="fa-solid ${escapeHTML(rankingState.icon)}"></i> ${escapeHTML(rankingState.label)}</span>
              </div>
            </div>

            <aside class="detail-summary-card">
              <span class="status-pill ${escapeHTML(status.className)}">
                ${escapeHTML(status.label)}
              </span>
              <div class="detail-summary-grid">
                <div class="detail-summary-item"><span>Participantes</span><strong>${participantsCount} / ${escapeHTML(maxParticipants)}</strong></div>
                <div class="detail-summary-item"><span>Inscrição</span><strong>${escapeHTML(registrationAvailability.shortLabel)}</strong></div>
                <div class="detail-summary-item"><span>Início</span><strong>${escapeHTML(formatDate(tournament.startDate))}</strong></div>
                <div class="detail-summary-item"><span>Horário</span><strong>${escapeHTML(tournament.startTime || "A definir")}</strong></div>
                <div class="detail-summary-item"><span>Check-in</span><strong>${escapeHTML(tournament.checkInTime || "A definir")}</strong></div>
                <div class="detail-summary-item"><span>Premiação</span><strong>${escapeHTML(getPrize(tournament))}</strong></div>
                <div class="detail-summary-item"><span>Ranking</span><strong>${escapeHTML(rankingState.summaryLabel)}</strong></div>
              </div>
              <div class="detail-actions">
                <button type="button" class="detail-btn" data-action="tournament-registration" data-tournament-id="${escapeHTML(tournament.id)}" ${registrationButtonDisabled}>
                  <i class="fa-solid ${alreadyRegistered ? "fa-circle-check" : registrationState.requiresLogin ? "fa-right-to-bracket" : "fa-ticket"}"></i>
                  ${escapeHTML(registrationButtonLabel)}
                </button>
                ${renderTournamentOrganizerActionButton(tournament, "hero-organizer-button")}
                <a class="detail-btn secondary" href="${escapeHTML(sbwBuildTournamentViewUrl(tournament, "chaves"))}">
                  Ver chaves
                </a>
              </div>
            </aside>
          </div>
        </div>
      </section>

      ${renderDetailNav(tournament, activeView)}

      <section class="detail-content detail-content--single-view">
        ${renderTournamentViewContent(tournament, activeView, registrationState, registrationAvailability)}
      </section>
    </div>
  `;
}


  function sbwGetElementBoxRelativeTo(element, parent) {
    let x = 0;
    let y = 0;
    let node = element;

    while (node && node !== parent) {
      x += node.offsetLeft || 0;
      y += node.offsetTop || 0;
      node = node.offsetParent;
    }

    return {
      x,
      y,
      width: element.offsetWidth || 0,
      height: element.offsetHeight || 0
    };
  }

  function sbwCreateConnectorPath(svg, d, className = "") {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("class", `sbw-bracket-connector-path ${className}`.trim());
    svg.appendChild(path);
  }

  function sbwBuildConnectorPath(from, to, options = {}) {
    const rawDistance = to.x - from.x;
    const isReturnPath = rawDistance < 0;
    const distance = Math.max(30, Math.abs(rawDistance));
    const elbow = options.elbow || Math.min(70, Math.max(34, distance * 0.52));
    const midX = isReturnPath ? from.x + elbow : from.x + elbow;

    return `M ${from.x} ${from.y} H ${midX} V ${to.y} H ${to.x}`;
  }

  function sbwGetBracketConnectorTargetIndex(laneKey, sourceIndex, sourceCount, targetCount) {
    const safeTargetCount = Number(targetCount || 0);

    if (safeTargetCount <= 0) {
      return -1;
    }

    if (sourceCount === safeTargetCount) {
      return Math.min(sourceIndex, safeTargetCount - 1);
    }

    const ratio = Math.max(1, sourceCount / safeTargetCount);
    return Math.min(Math.floor(sourceIndex / ratio), safeTargetCount - 1);
  }

  function sbwAlignGrandFinalWithWinners(layout) {
    const canvas = layout.querySelector("[data-bracket-canvas]");
    const grandLane = canvas?.querySelector(".sbw-double-grand");
    const winnersFinalMatch = canvas?.querySelector(".sbw-winners-lane [data-bracket-round]:last-child [data-bracket-match]");
    const grandFinalMatch = canvas?.querySelector(".sbw-double-grand [data-bracket-match]");

    if (!canvas || !grandLane || !winnersFinalMatch || !grandFinalMatch) {
      return false;
    }

    const winnersBox = sbwGetElementBoxRelativeTo(winnersFinalMatch, canvas);
    const grandBox = sbwGetElementBoxRelativeTo(grandFinalMatch, canvas);
    const currentPadding = parseFloat(window.getComputedStyle(grandLane).paddingTop || "0") || 0;
    const winnersCenterY = winnersBox.y + winnersBox.height / 2;
    const grandCenterY = grandBox.y + grandBox.height / 2;
    const nextPadding = Math.max(0, Math.min(620, currentPadding + (winnersCenterY - grandCenterY)));
    const previousValue = parseFloat(grandLane.dataset.sbwGrandAlign || "-1");

    if (Math.abs(nextPadding - previousValue) < 1) {
      return false;
    }

    grandLane.dataset.sbwGrandAlign = String(nextPadding);
    grandLane.style.setProperty("--sbw-grand-align-offset", `${nextPadding}px`);
    grandLane.style.setProperty("padding-top", `${nextPadding}px`, "important");
    return true;
  }

  function sbwDrawBracketConnectors(layout) {
    const canvas = layout.querySelector("[data-bracket-canvas]");
    const svg = layout.querySelector("[data-bracket-connectors]");

    if (!canvas || !svg) {
      return;
    }

    svg.innerHTML = "";
    sbwAlignGrandFinalWithWinners(layout);
    const width = Math.max(canvas.scrollWidth, canvas.offsetWidth, 1);
    const height = Math.max(canvas.scrollHeight, canvas.offsetHeight, 1);
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    canvas.querySelectorAll("[data-bracket-rounds]").forEach((bracket) => {
      const rounds = Array.from(bracket.querySelectorAll(":scope > [data-bracket-round]"));
      const laneKey = String(bracket.dataset.bracketLaneKey || "");

      rounds.forEach((round, roundIndex) => {
        const nextRound = rounds[roundIndex + 1];

        if (!nextRound) {
          return;
        }

        const sourceMatches = Array.from(round.querySelectorAll(":scope [data-bracket-match]"));
        const targetMatches = Array.from(nextRound.querySelectorAll(":scope [data-bracket-match]"));

        sourceMatches.forEach((sourceMatch, sourceIndex) => {
          const targetIndex = sbwGetBracketConnectorTargetIndex(
            laneKey,
            sourceIndex,
            sourceMatches.length,
            targetMatches.length
          );
          const targetMatch = targetMatches[targetIndex];

          if (!targetMatch) {
            return;
          }

          const sourceBox = sbwGetElementBoxRelativeTo(sourceMatch, canvas);
          const targetBox = sbwGetElementBoxRelativeTo(targetMatch, canvas);
          const from = {
            x: sourceBox.x + sourceBox.width,
            y: sourceBox.y + sourceBox.height / 2
          };
          const to = {
            x: targetBox.x,
            y: targetBox.y + targetBox.height / 2
          };

          sbwCreateConnectorPath(
            svg,
            sbwBuildConnectorPath(from, to),
            laneKey.includes("lower") ? "is-lower" : "is-winners"
          );
        });
      });
    });

    const grandFinalMatch = canvas.querySelector(".sbw-double-grand [data-bracket-match]");

    if (grandFinalMatch) {
      const grandBox = sbwGetElementBoxRelativeTo(grandFinalMatch, canvas);
      const grandTarget = {
        x: grandBox.x,
        y: grandBox.y + grandBox.height / 2
      };

      [
        { selector: ".sbw-winners-lane [data-bracket-round]:last-child [data-bracket-match]", className: "is-grand" },
        { selector: ".sbw-lower-lane [data-bracket-round]:last-child [data-bracket-match]", className: "is-lower is-grand is-dashed" }
      ].forEach((item) => {
        const sourceMatch = canvas.querySelector(item.selector);

        if (!sourceMatch) {
          return;
        }

        const sourceBox = sbwGetElementBoxRelativeTo(sourceMatch, canvas);
        const from = {
          x: sourceBox.x + sourceBox.width,
          y: sourceBox.y + sourceBox.height / 2
        };

        sbwCreateConnectorPath(svg, sbwBuildConnectorPath(from, grandTarget, { elbow: 62 }), item.className);
      });
    }
  }

  function sbwBindTournamentBracketInteractions() {
    const layouts = root.querySelectorAll("[data-bracket-layout]");

    layouts.forEach((layout) => {
      const viewport = layout.querySelector("[data-bracket-viewport]");
      const canvas = layout.querySelector("[data-bracket-canvas]");
      const zoomLabel = layout.querySelector("[data-bracket-zoom-label]");
      const searchInput = layout.querySelector("[data-bracket-search]");

      if (!viewport || !canvas) {
        return;
      }

      const defaultZoom = layout.classList.contains("sbw-bracket-reference-mode") ? 1 : 0.9;
      const state = { zoom: defaultZoom };

      const redraw = () => {
        window.requestAnimationFrame(() => sbwDrawBracketConnectors(layout));
      };

      const applyZoom = () => {
        canvas.style.transform = "none";
        canvas.style.zoom = String(state.zoom);
        if (zoomLabel) {
          zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
        }
        redraw();
      };

      const reset = () => {
        state.zoom = defaultZoom;
        viewport.scrollTo({ top: 0, left: 0, behavior: "smooth" });
        applyZoom();
      };

      layout.querySelectorAll("[data-bracket-control]").forEach((button) => {
        button.addEventListener("click", () => {
          const action = button.dataset.bracketControl;

          if (action === "zoom-in") {
            state.zoom = Math.min(1.3, state.zoom + 0.08);
          } else if (action === "zoom-out") {
            state.zoom = Math.max(0.58, state.zoom - 0.08);
          } else if (action === "reset") {
            reset();
            return;
          }

          applyZoom();
        });
      });

      layout.querySelectorAll("[data-bracket-focus]").forEach((button) => {
        button.addEventListener("click", () => {
          layout.querySelectorAll("[data-bracket-focus]").forEach((item) => item.classList.remove("active"));
          button.classList.add("active");

          const focus = button.dataset.bracketFocus;
          const target = focus && focus !== "all"
            ? canvas.querySelector(`[data-bracket-focus-target~="${CSS.escape(focus)}"], [data-bracket-stage="${CSS.escape(focus)}"]`)
            : null;

          if (target) {
            target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
          } else {
            reset();
          }
        });
      });

      if (searchInput) {
        searchInput.addEventListener("input", () => {
          const query = searchInput.value.trim().toLowerCase();
          const matches = canvas.querySelectorAll("[data-bracket-search-text]");
          let firstMatch = null;

          matches.forEach((item) => {
            const haystack = String(item.dataset.bracketSearchText || "").toLowerCase();
            const active = query && haystack.includes(query);
            item.classList.toggle("is-search-hit", Boolean(active));

            if (active && !firstMatch && item.hasAttribute("data-bracket-match")) {
              firstMatch = item;
            }
          });

          if (firstMatch) {
            firstMatch.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
          }
        });
      }

      if (window.ResizeObserver) {
        const observer = new ResizeObserver(redraw);
        observer.observe(canvas);
        observer.observe(viewport);
      }

      window.addEventListener("resize", redraw);
      applyZoom();
      setTimeout(redraw, 120);
      setTimeout(redraw, 420);
    });
  }


  root.addEventListener("click", function(event) {
    const button = event.target.closest("[data-action]");

    if (!button) {
      return;
    }

    const action = button.dataset.action;

    if (action === "tournament-registration") {
      event.preventDefault();
      handleTournamentRegistration(button.dataset.tournamentId);
    }

    if (action === "tournament-checkin") {
      event.preventDefault();
      handleTournamentCheckIn(button.dataset.tournamentId);
    }
  });

function sbwWithTimeout(promise, timeoutMs = 8000) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => {
        resolve(null);
      }, timeoutMs);
    })
  ]);
}

async function initTournamentDetailPage() {
  const tournamentId = getQueryParam("id");

  if (!tournamentId) {
    renderNotFound();
    return;
  }

  renderLoading();

  let tournament = null;

  try {
    tournament = await sbwWithTimeout(
      findTournamentByIdAsync(tournamentId),
      8000
    );
  } catch (error) {
    console.error("Erro ao inicializar detalhe do torneio:", error);
  }

  if (!tournament) {
    renderNotFound();
    return;
  }

  sbwCurrentDetailTournament = tournament;
  await hydrateDetailRegistrationState(tournament);
  renderTournament(tournament);
  sbwBindTournamentBracketInteractions();

  if (window.location.hash) {
    const target = document.querySelector(window.location.hash);

    if (target) {
      setTimeout(() => {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }, 80);
    }
  }
}

initTournamentDetailPage();
