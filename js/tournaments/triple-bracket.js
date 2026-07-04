// v1.6.86 — Vantagem automática da Grande Final do Sistema de 3 Chaves da plataforma -SBW-
(function () {
  "use strict";

  const FORMAT_KEY = "triple-bracket";
  const SCHEMA_VERSION = "triplebracket.v1";

  const DEFAULT_CONFIG = Object.freeze({
    formatKey: FORMAT_KEY,
    schemaVersion: SCHEMA_VERSION,
    requiredTeams: 8,
    groupStageType: "round_robin",
    groupStageLabel: "Todos contra todos",
    groupStageMatches: 28,
    highBracketQualifiers: 4,
    middleBracketQualifiers: 4,
    brackets: ["high", "middle", "low"],
    bracketLabels: {
      high: "Chave Alta",
      middle: "Chave Média",
      low: "Chave Baixa"
    },
    finalSeries: {
      type: "single_series_with_advantage",
      matchFormat: "FT5",
      noReset: true,
      highAdvantageVsMiddle: 1,
      highAdvantageVsLow: 2,
      advantageUnit: "games"
    },
    mvpScope: "8_equipes",
    automationStage: "round_robin_officialization_ready"
  });

  const PLAYOFF_BLUEPRINT = Object.freeze([
    { id: "HA1", stage: "high_bracket", label: "Chave Alta 1", slotA: "1º geral", slotB: "4º geral", loserTo: "HM4" },
    { id: "HA2", stage: "high_bracket", label: "Chave Alta 2", slotA: "2º geral", slotB: "3º geral", loserTo: "HM3" },
    { id: "HA3", stage: "high_bracket", label: "Final da Chave Alta", slotA: "Vencedor HA1", slotB: "Vencedor HA2", winnerTo: "Grande Final", loserTo: "HM6" },

    { id: "HM1", stage: "middle_bracket", label: "Chave Média 1", slotA: "5º geral", slotB: "8º geral", loserTo: "HB1" },
    { id: "HM2", stage: "middle_bracket", label: "Chave Média 2", slotA: "6º geral", slotB: "7º geral", loserTo: "HB1" },
    { id: "HM3", stage: "middle_bracket", label: "Chave Média 3", slotA: "Vencedor HM1", slotB: "Perdedor HA2", loserTo: "HB2" },
    { id: "HM4", stage: "middle_bracket", label: "Chave Média 4", slotA: "Vencedor HM2", slotB: "Perdedor HA1", loserTo: "HB2" },
    { id: "HM5", stage: "middle_bracket", label: "Final parcial da Chave Média", slotA: "Vencedor HM3", slotB: "Vencedor HM4", loserTo: "HB4" },
    { id: "HM6", stage: "middle_bracket", label: "Final da Chave Média", slotA: "Vencedor HM5", slotB: "Perdedor HA3", winnerTo: "Final Intermediária", loserTo: "HB5" },

    { id: "HB1", stage: "low_bracket", label: "Chave Baixa 1", slotA: "Perdedor HM1", slotB: "Perdedor HM2", loserTo: "Eliminado" },
    { id: "HB2", stage: "low_bracket", label: "Chave Baixa 2", slotA: "Perdedor HM3", slotB: "Perdedor HM4", loserTo: "Eliminado" },
    { id: "HB3", stage: "low_bracket", label: "Chave Baixa 3", slotA: "Vencedor HB1", slotB: "Vencedor HB2", loserTo: "Eliminado" },
    { id: "HB4", stage: "low_bracket", label: "Chave Baixa 4", slotA: "Vencedor HB3", slotB: "Perdedor HM5", loserTo: "Eliminado" },
    { id: "HB5", stage: "low_bracket", label: "Final da Chave Baixa", slotA: "Vencedor HB4", slotB: "Perdedor HM6", winnerTo: "Final Intermediária", loserTo: "Eliminado" },

    { id: "FI1", stage: "intermediary_final", label: "Final Intermediária", slotA: "Vencedor Chave Média", slotB: "Vencedor Chave Baixa", winnerTo: "Grande Final" },
    { id: "GF1", stage: "grand_final", label: "Grande Final", slotA: "Vencedor Chave Alta", slotB: "Vencedor Final Intermediária", noReset: true }
  ]);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function isTripleBracketFormat(value) {
    return [FORMAT_KEY, "triple_bracket", "sistema-3-chaves", "sistema-de-3-chaves", "triple-bracket-8"].includes(normalize(value));
  }

  function buildConfig(overrides = {}) {
    const config = {
      ...clone(DEFAULT_CONFIG),
      ...(overrides && typeof overrides === "object" ? overrides : {})
    };

    config.formatKey = FORMAT_KEY;
    config.schemaVersion = SCHEMA_VERSION;
    config.requiredTeams = 8;
    config.groupStageMatches = 28;
    config.highBracketQualifiers = 4;
    config.middleBracketQualifiers = 4;
    config.brackets = ["high", "middle", "low"];
    config.playoffBlueprint = clone(PLAYOFF_BLUEPRINT);

    return config;
  }

  function buildCreationDraft(context = {}, overrides = {}) {
    const config = buildConfig(overrides);

    return {
      formatKey: FORMAT_KEY,
      schemaVersion: SCHEMA_VERSION,
      title: context.title || "Sistema de 3 Chaves",
      game: context.game || "",
      status: "base_config",
      config,
      groupStage: {
        type: "round_robin",
        teams: 8,
        matches: 28,
        description: "8 equipes jogam todos contra todos para formar a classificação geral."
      },
      bracketSplit: {
        high: "1º ao 4º geral",
        middle: "5º ao 8º geral",
        low: "última chance após queda da Chave Média"
      },
      finals: config.finalSeries,
      playoffBlueprint: clone(PLAYOFF_BLUEPRINT),
      previewNote: "Base estrutural do formato. Geração/avanço automático das partidas entra nas próximas versões."
    };
  }



  function normalizePlayerKey(value, fallback = "") {
    return String(value || fallback || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\-_]+/g, "-")
      .replace(/(^-|-$)/g, "") || String(fallback || "player");
  }

  function normalizeMatchPlayer(participant, index = 0) {
    if (!participant) return null;

    const isPlaceholder = Boolean(participant.placeholder || participant.isPlaceholder || participant.slotStatus === "open" || participant.slot_status === "open");
    const nickname = String(
      participant.nickname ||
      participant.playerName ||
      participant.player_name ||
      participant.name ||
      participant.displayName ||
      participant.teamName ||
      (isPlaceholder ? `Vaga ${index + 1}` : `Equipe ${index + 1}`)
    ).trim();

    const id = String(
      participant.id ||
      participant.participantId ||
      participant.participant_id ||
      participant.teamId ||
      participant.team_id ||
      participant.profileId ||
      participant.profile_id ||
      normalizePlayerKey(nickname, `team-${index + 1}`)
    );

    return {
      id,
      participantId: participant.participantId || participant.participant_id || participant.id || "",
      profileId: participant.profileId || participant.profile_id || "",
      profileSlug: participant.profileSlug || participant.profile_slug || participant.playerSlug || participant.player_slug || "",
      playerSlug: participant.playerSlug || participant.player_slug || participant.profileSlug || participant.profile_slug || "",
      authUserId: participant.authUserId || participant.auth_user_id || "",
      nickname: nickname || (isPlaceholder ? `Vaga ${index + 1}` : `Equipe ${index + 1}`),
      team: participant.team || participant.teamName || participant.team_name || (isPlaceholder ? "Aguardando inscrição" : ""),
      character: participant.character || participant.role || "",
      platform: participant.platform || "-SBW-",
      seed: participant.seed || index + 1,
      placeholder: isPlaceholder,
      isPlaceholder,
      slotStatus: participant.slotStatus || participant.slot_status || (isPlaceholder ? "open" : "filled")
    };
  }

  function createPlaceholderParticipant(index = 0) {
    const slot = index + 1;

    return {
      id: `triple-bracket-slot-${slot}`,
      participantId: `triple-bracket-slot-${slot}`,
      nickname: `Vaga ${slot}`,
      name: `Vaga ${slot}`,
      team: "Aguardando inscrição",
      platform: "-SBW-",
      seed: slot,
      placeholder: true,
      isPlaceholder: true,
      slotStatus: "open"
    };
  }

  function completeGroupStageParticipants(participants = []) {
    const realParticipants = Array.isArray(participants) ? participants.slice(0, DEFAULT_CONFIG.requiredTeams) : [];
    const completed = realParticipants.map((participant, index) => ({
      ...(participant || {}),
      seed: participant?.seed || index + 1,
      placeholder: Boolean(participant?.placeholder || participant?.isPlaceholder),
      isPlaceholder: Boolean(participant?.placeholder || participant?.isPlaceholder),
      slotStatus: participant?.slotStatus || participant?.slot_status || "filled"
    }));

    while (completed.length < DEFAULT_CONFIG.requiredTeams) {
      completed.push(createPlaceholderParticipant(completed.length));
    }

    return completed;
  }

  function createStandingRow(player) {
    return {
      participantId: player.id,
      profileId: player.profileId || "",
      profileSlug: player.profileSlug || player.playerSlug || "",
      playerSlug: player.playerSlug || player.profileSlug || "",
      authUserId: player.authUserId || "",
      nickname: player.nickname,
      team: player.team || "",
      seed: player.seed || 0,
      placeholder: Boolean(player.placeholder || player.isPlaceholder),
      isPlaceholder: Boolean(player.placeholder || player.isPlaceholder),
      slotStatus: player.slotStatus || (player.placeholder || player.isPlaceholder ? "open" : "filled"),
      played: 0,
      wins: 0,
      losses: 0,
      setsWon: 0,
      setsLost: 0,
      setBalance: 0,
      points: 0,
      winRate: 0,
      qualificationTarget: "A definir"
    };
  }

  function buildRoundRobinRounds(players, options = {}) {
    const prefix = normalizePlayerKey(options.prefix || "triple-bracket", "triple-bracket");
    const matchFormat = options.matchFormat || "MD3";
    const pool = players.map((player, index) => normalizeMatchPlayer(player, index));

    if (pool.length % 2 !== 0) {
      pool.push(null);
    }

    const totalSlots = pool.length;
    const totalRounds = totalSlots - 1;
    const rounds = [];
    let rotation = [...pool];

    for (let roundIndex = 0; roundIndex < totalRounds; roundIndex += 1) {
      const matches = [];

      for (let matchIndex = 0; matchIndex < totalSlots / 2; matchIndex += 1) {
        const playerA = rotation[matchIndex];
        const playerB = rotation[totalSlots - 1 - matchIndex];
        const matchNumber = matchIndex + 1;
        const roundNumber = roundIndex + 1;

        matches.push({
          id: `${prefix}-gs-r${roundNumber}-m${matchNumber}`,
          round: roundNumber,
          order: matchNumber,
          stage: "group_stage",
          phaseKey: "triple_group_stage",
          phaseLabel: "Fase todos contra todos",
          roundName: `Rodada ${roundNumber}`,
          matchFormat,
          bestOf: matchFormat,
          playerA,
          playerB,
          status: playerA && playerB ? "pending" : "bye",
          scoreA: null,
          scoreB: null,
          winnerId: null,
          nextMatchId: null,
          nextSlot: null,
          loserNextMatchId: null,
          loserNextSlot: null
        });
      }

      rounds.push({
        id: `${prefix}-group-round-${roundIndex + 1}`,
        name: `Rodada ${roundIndex + 1}`,
        stage: "group_stage",
        matches
      });

      const fixed = rotation[0];
      const rest = rotation.slice(1);
      const last = rest.pop();
      rotation = [fixed, last, ...rest];
    }

    return rounds;
  }

  function validateGroupStageParticipants(participants) {
    const count = Array.isArray(participants) ? participants.length : 0;

    if (count > DEFAULT_CONFIG.requiredTeams) {
      return {
        valid: false,
        count,
        missingSlots: 0,
        templateMode: false,
        message: `O Sistema de 3 Chaves MVP aceita no máximo ${DEFAULT_CONFIG.requiredTeams} equipes válidas. Agora: ${count}.`
      };
    }

    return {
      valid: true,
      count,
      missingSlots: Math.max(DEFAULT_CONFIG.requiredTeams - count, 0),
      templateMode: count < DEFAULT_CONFIG.requiredTeams,
      message: count < DEFAULT_CONFIG.requiredTeams
        ? `Estrutura modelo será gerada com ${count} inscrito(s) real(is) e ${DEFAULT_CONFIG.requiredTeams - count} vaga(s) em aberto.`
        : `Estrutura será gerada com ${DEFAULT_CONFIG.requiredTeams} equipes reais.`
    };
  }

  function buildGroupStageStructure(tournament = {}, participants = [], options = {}) {
    const validation = validateGroupStageParticipants(participants);

    if (!validation.valid) {
      return {
        success: false,
        valid: false,
        message: validation.message
      };
    }

    const config = buildConfig(
      tournament?.settings?.tripleBracket ||
      tournament?.settings?.triple_bracket ||
      tournament?.metadata?.tripleBracket ||
      tournament?.metadata?.triple_bracket ||
      {}
    );
    const completedParticipants = completeGroupStageParticipants(participants);
    const sourcePlayers = completedParticipants.map((participant, index) => normalizeMatchPlayer(participant, index));
    const placeholderSlots = sourcePlayers.filter((player) => player && (player.placeholder || player.isPlaceholder)).length;
    const modeState = getStructureModeFromCounts(validation.count, placeholderSlots);
    const templateMode = modeState.templateMode;
    const prefix = normalizePlayerKey(tournament.slug || tournament.id || tournament.title || "triple-bracket", "triple-bracket");
    const matchFormat = options.matchFormat || tournament?.settings?.matchFormat || tournament?.matchFormat || "MD3";
    const rounds = buildRoundRobinRounds(sourcePlayers, { prefix, matchFormat });
    const standings = sourcePlayers.map(createStandingRow);
    const flatMatches = rounds.flatMap((round) => round.matches || []);
    const now = new Date().toISOString();

    const groupStage = {
      type: "round_robin",
      label: "Fase todos contra todos",
      status: modeState.status,
      generatedAt: now,
      templateMode,
      officialMode: modeState.officialMode,
      resultLocked: modeState.resultLocked,
      resultLock: {
        locked: modeState.resultLocked,
        reason: modeState.resultLocked ? "template_slots_open" : null,
        message: modeState.message
      },
      realTeams: validation.count,
      placeholderSlots,
      teams: sourcePlayers,
      standings,
      rounds,
      matches: flatMatches,
      matchesTotal: flatMatches.filter((match) => match.playerA && match.playerB).length,
      rules: {
        pointsWin: 3,
        pointsLoss: 0,
        tieBreakers: "Pontos, vitórias, saldo de sets, sets vencidos, confronto direto manual"
      },
      splitRule: {
        highBracket: "1º ao 4º geral",
        middleBracket: "5º ao 8º geral"
      },
      nextStep: "generate_playoff_brackets_after_group_results"
    };

    return {
      success: true,
      valid: true,
      structure: {
        type: FORMAT_KEY,
        format: FORMAT_KEY,
        label: "Sistema de 3 Chaves",
        schemaVersion: SCHEMA_VERSION,
        generatedAt: now,
        playersUsed: sourcePlayers.length,
        realPlayersUsed: validation.count,
        placeholderSlots,
        templateMode,
        officialMode: modeState.officialMode,
        resultLocked: modeState.resultLocked,
        resultLock: {
          locked: modeState.resultLocked,
          reason: modeState.resultLocked ? "template_slots_open" : null,
          message: modeState.message
        },
        currentStep: "group_stage",
        automationStage: modeState.automationStage,
        settings: config,
        groupStage,
        standings,
        rounds,
        matches: flatMatches,
        playoffs: {
          status: "waiting_group_stage_results",
          message: "As Chaves Alta, Média e Baixa serão geradas após a conclusão da fase todos contra todos.",
          highBracketQualifiers: config.highBracketQualifiers,
          middleBracketQualifiers: config.middleBracketQualifiers,
          playoffBlueprint: clone(PLAYOFF_BLUEPRINT)
        },
        finals: {
          status: "waiting_playoff_results",
          finalSeries: config.finalSeries
        },
        notes: {
          templateMode,
          message: templateMode
            ? "Estrutura modelo gerada com vagas em aberto. Resultados oficiais ficam bloqueados até regenerar a estrutura com 8 equipes reais."
            : "Estrutura oficial gerada com 8 equipes reais. Resultados oficiais da fase inicial estão liberados."
        }
      }
    };
  }

  function getStructureModeFromCounts(realTeams, placeholderSlots) {
    const safeRealTeams = Number(realTeams || 0);
    const safePlaceholderSlots = Number(placeholderSlots || 0);
    const templateMode = safePlaceholderSlots > 0 || safeRealTeams < DEFAULT_CONFIG.requiredTeams;

    return {
      templateMode,
      officialMode: !templateMode,
      resultLocked: templateMode,
      status: templateMode ? "template_generated" : "official_generated",
      automationStage: templateMode ? "group_stage_template_generated" : "group_stage_official_generated",
      label: templateMode ? "Modelo com vagas em aberto" : "Estrutura oficial",
      message: templateMode
        ? "Estrutura modelo gerada com vagas em aberto. Resultados oficiais ficam bloqueados até regenerar a estrutura com 8 equipes reais."
        : "Estrutura oficial gerada com 8 equipes reais. Resultados da fase todos contra todos estão liberados."
    };
  }

  function isTemplateStructure(structure = {}) {
    if (!structure || typeof structure !== "object") return false;
    const groupStage = structure.groupStage || {};
    const resultLock = structure.resultLock || groupStage.resultLock || {};
    const placeholderSlots = Number(structure.placeholderSlots || groupStage.placeholderSlots || 0);
    const realPlayersUsed = Number(structure.realPlayersUsed || groupStage.realTeams || 0);

    return Boolean(
      structure.templateMode ||
      groupStage.templateMode ||
      resultLock.locked ||
      placeholderSlots > 0 ||
      (structure.type === FORMAT_KEY && realPlayersUsed > 0 && realPlayersUsed < DEFAULT_CONFIG.requiredTeams)
    );
  }

  function canRecordGroupStageResults(structure = {}) {
    return !isTemplateStructure(structure);
  }

  function buildOfficializationSummary(structure = {}) {
    const groupStage = structure.groupStage || {};
    const placeholderSlots = Number(structure.placeholderSlots || groupStage.placeholderSlots || 0);
    const realPlayersUsed = Number(structure.realPlayersUsed || groupStage.realTeams || 0);
    const templateMode = isTemplateStructure(structure);

    return {
      templateMode,
      officialMode: !templateMode,
      resultLocked: templateMode,
      realPlayersUsed,
      placeholderSlots,
      requiredTeams: DEFAULT_CONFIG.requiredTeams,
      title: templateMode ? "Modelo com vagas em aberto" : "Estrutura oficial",
      message: templateMode
        ? `Este modelo tem ${realPlayersUsed} inscrito(s) real(is) e ${placeholderSlots} vaga(s) em aberto. Resultados ficam bloqueados até regenerar com 8 equipes reais.`
        : "Esta estrutura foi gerada com 8 equipes reais. Resultados oficiais da fase todos contra todos estão liberados."
    };
  }

  function getMatchPlayerKey(player) {
    if (!player) return "";
    return String(player.id || player.participantId || player.playerId || player.profileId || player.nickname || player.name || "");
  }

  function standingToSeedPlayer(row, seedIndex) {
    if (!row) return null;
    const seed = seedIndex + 1;
    const id = getMatchPlayerKey(row) || `seed-${seed}`;

    return {
      id,
      participantId: row.participantId || row.id || id,
      profileId: row.profileId || "",
      profileSlug: row.profileSlug || row.playerSlug || "",
      playerSlug: row.playerSlug || row.profileSlug || "",
      authUserId: row.authUserId || "",
      nickname: row.nickname || row.name || `Seed ${seed}`,
      team: row.team || "",
      seed,
      seedLabel: `${seed}º geral`,
      sourceStanding: clone(row)
    };
  }

  function createWaitingSlot(label, extra = {}) {
    return {
      id: normalizePlayerKey(label, "slot"),
      nickname: label,
      seedLabel: extra.seedLabel || "A definir",
      placeholder: true,
      isPlaceholder: true,
      slotStatus: "waiting",
      waitingSlot: true,
      ...extra
    };
  }

  function createPlayoffMatch(id, label, stage, playerA, playerB, options = {}) {
    const waiting = Boolean(options.waiting || !playerA || !playerB || playerA.waitingSlot || playerB.waitingSlot);
    return {
      id,
      label,
      name: label,
      stage,
      phaseKey: stage,
      phaseLabel: options.phaseLabel || label,
      roundName: options.roundName || label,
      order: options.order || 1,
      matchFormat: options.matchFormat || "MD3",
      bestOf: options.matchFormat || "MD3",
      playerA: playerA || null,
      playerB: playerB || null,
      slotA: options.slotA || playerA?.seedLabel || playerA?.nickname || "A definir",
      slotB: options.slotB || playerB?.seedLabel || playerB?.nickname || "A definir",
      status: waiting ? "waiting" : "pending",
      scoreA: null,
      scoreB: null,
      winnerId: null,
      nextMatchId: options.nextMatchId || null,
      nextSlot: options.nextSlot || null,
      loserNextMatchId: options.loserNextMatchId || null,
      loserNextSlot: options.loserNextSlot || null,
      winnerTo: options.winnerTo || null,
      loserTo: options.loserTo || null,
      source: "triple_bracket_playoff_seed",
      resultLocked: Boolean(waiting || options.resultLocked),
      resultLockReason: (waiting || options.resultLocked)
        ? (options.resultLockReason || "triple_bracket_waiting_for_progression")
        : null
    };
  }

  function areGroupStageMatchesCompleted(structure = {}) {
    const groupStage = structure.groupStage || {};
    const rounds = groupStage.rounds || structure.rounds || [];
    const matches = rounds.flatMap((round) => round.matches || []).filter((match) => match && match.playerA && match.playerB);
    return matches.length === DEFAULT_CONFIG.groupStageMatches && matches.every((match) => String(match.status || "").toLowerCase() === "completed" && match.winnerId);
  }

  function buildPlayoffBracketsFromGroupStage(structure = {}, options = {}) {
    if (!structure || structure.type !== FORMAT_KEY) {
      return { success: false, message: "Estrutura do Sistema de 3 Chaves não encontrada." };
    }

    if (isTemplateStructure(structure)) {
      return { success: false, message: "Não gere chaves oficiais em uma estrutura modelo. Regenere com 8 equipes reais primeiro." };
    }

    if (!areGroupStageMatchesCompleted(structure)) {
      return { success: false, message: "Finalize as 28 partidas da fase todos contra todos antes de gerar as Chaves Alta, Média e Baixa." };
    }

    const standings = Array.isArray(structure.groupStage?.standings)
      ? structure.groupStage.standings
      : (Array.isArray(structure.standings) ? structure.standings : []);

    if (standings.length < DEFAULT_CONFIG.requiredTeams) {
      return { success: false, message: "Classificação geral incompleta. São necessárias 8 equipes classificadas." };
    }

    const seeds = standings.slice(0, DEFAULT_CONFIG.requiredTeams).map(standingToSeedPlayer);
    const [s1, s2, s3, s4, s5, s6, s7, s8] = seeds;
    const matchFormat = options.matchFormat || structure.settings?.matchFormat || "MD3";
    const generatedAt = new Date().toISOString();

    const highBracket = {
      status: "generated",
      label: "Chave Alta",
      generatedAt,
      rules: {
        entrants: "1º ao 4º geral",
        lossDestination: "Perdedores descem para a Chave Média"
      },
      rounds: [
        {
          id: "triple-high-r1",
          name: "Chave Alta — Semifinais",
          stage: "high_bracket",
          matches: [
            createPlayoffMatch("HA1", "HA1 · 1º vs 4º", "high_bracket", s1, s4, { order: 1, matchFormat, nextMatchId: "HA3", nextSlot: "A", loserTo: "HM4", loserNextMatchId: "HM4", loserNextSlot: "B" }),
            createPlayoffMatch("HA2", "HA2 · 2º vs 3º", "high_bracket", s2, s3, { order: 2, matchFormat, nextMatchId: "HA3", nextSlot: "B", loserTo: "HM3", loserNextMatchId: "HM3", loserNextSlot: "B" })
          ]
        },
        {
          id: "triple-high-r2",
          name: "Final da Chave Alta",
          stage: "high_bracket",
          matches: [
            createPlayoffMatch("HA3", "HA3 · Final da Chave Alta", "high_bracket", createWaitingSlot("Vencedor HA1"), createWaitingSlot("Vencedor HA2"), { order: 1, matchFormat, waiting: true, winnerTo: "Grande Final", nextMatchId: "GF1", nextSlot: "A", loserTo: "HM6", loserNextMatchId: "HM6", loserNextSlot: "B" })
          ]
        }
      ]
    };

    const middleBracket = {
      status: "generated",
      label: "Chave Média",
      generatedAt,
      rules: {
        entrants: "5º ao 8º geral + quedas da Chave Alta",
        lossDestination: "Perdedores descem para a Chave Baixa"
      },
      rounds: [
        {
          id: "triple-middle-r1",
          name: "Chave Média — Entrada",
          stage: "middle_bracket",
          matches: [
            createPlayoffMatch("HM1", "HM1 · 5º vs 8º", "middle_bracket", s5, s8, { order: 1, matchFormat, nextMatchId: "HM3", nextSlot: "A", loserTo: "HB1", loserNextMatchId: "HB1", loserNextSlot: "A" }),
            createPlayoffMatch("HM2", "HM2 · 6º vs 7º", "middle_bracket", s6, s7, { order: 2, matchFormat, nextMatchId: "HM4", nextSlot: "A", loserTo: "HB1", loserNextMatchId: "HB1", loserNextSlot: "B" })
          ]
        },
        {
          id: "triple-middle-r2",
          name: "Chave Média — Quedas da Alta",
          stage: "middle_bracket",
          matches: [
            createPlayoffMatch("HM3", "HM3 · Vencedor HM1 vs Perdedor HA2", "middle_bracket", createWaitingSlot("Vencedor HM1"), createWaitingSlot("Perdedor HA2"), { order: 1, matchFormat, waiting: true, nextMatchId: "HM5", nextSlot: "A", loserTo: "HB2", loserNextMatchId: "HB2", loserNextSlot: "A" }),
            createPlayoffMatch("HM4", "HM4 · Vencedor HM2 vs Perdedor HA1", "middle_bracket", createWaitingSlot("Vencedor HM2"), createWaitingSlot("Perdedor HA1"), { order: 2, matchFormat, waiting: true, nextMatchId: "HM5", nextSlot: "B", loserTo: "HB2", loserNextMatchId: "HB2", loserNextSlot: "B" })
          ]
        },
        {
          id: "triple-middle-r3",
          name: "Chave Média — Final parcial",
          stage: "middle_bracket",
          matches: [
            createPlayoffMatch("HM5", "HM5 · Vencedor HM3 vs Vencedor HM4", "middle_bracket", createWaitingSlot("Vencedor HM3"), createWaitingSlot("Vencedor HM4"), { order: 1, matchFormat, waiting: true, nextMatchId: "HM6", nextSlot: "A", loserTo: "HB4", loserNextMatchId: "HB4", loserNextSlot: "B" })
          ]
        },
        {
          id: "triple-middle-r4",
          name: "Final da Chave Média",
          stage: "middle_bracket",
          matches: [
            createPlayoffMatch("HM6", "HM6 · Vencedor HM5 vs Perdedor HA3", "middle_bracket", createWaitingSlot("Vencedor HM5"), createWaitingSlot("Perdedor HA3"), { order: 1, matchFormat, waiting: true, winnerTo: "Final Intermediária", nextMatchId: "FI1", nextSlot: "A", loserTo: "HB5", loserNextMatchId: "HB5", loserNextSlot: "B" })
          ]
        }
      ]
    };

    const lowBracket = {
      status: "generated",
      label: "Chave Baixa",
      generatedAt,
      rules: {
        entrants: "Quedas da Chave Média",
        lossDestination: "Perdedor na Chave Baixa está eliminado"
      },
      rounds: [
        {
          id: "triple-low-r1",
          name: "Chave Baixa — Primeira eliminação",
          stage: "low_bracket",
          matches: [
            createPlayoffMatch("HB1", "HB1 · Perdedor HM1 vs Perdedor HM2", "low_bracket", createWaitingSlot("Perdedor HM1"), createWaitingSlot("Perdedor HM2"), { order: 1, matchFormat, waiting: true, nextMatchId: "HB3", nextSlot: "A", loserTo: "Eliminado" })
          ]
        },
        {
          id: "triple-low-r2",
          name: "Chave Baixa — Segunda eliminação",
          stage: "low_bracket",
          matches: [
            createPlayoffMatch("HB2", "HB2 · Perdedor HM3 vs Perdedor HM4", "low_bracket", createWaitingSlot("Perdedor HM3"), createWaitingSlot("Perdedor HM4"), { order: 1, matchFormat, waiting: true, nextMatchId: "HB3", nextSlot: "B", loserTo: "Eliminado" })
          ]
        },
        {
          id: "triple-low-r3",
          name: "Chave Baixa — Sobrevivência",
          stage: "low_bracket",
          matches: [
            createPlayoffMatch("HB3", "HB3 · Vencedor HB1 vs Vencedor HB2", "low_bracket", createWaitingSlot("Vencedor HB1"), createWaitingSlot("Vencedor HB2"), { order: 1, matchFormat, waiting: true, nextMatchId: "HB4", nextSlot: "A", loserTo: "Eliminado" })
          ]
        },
        {
          id: "triple-low-r4",
          name: "Chave Baixa — Queda da Média",
          stage: "low_bracket",
          matches: [
            createPlayoffMatch("HB4", "HB4 · Vencedor HB3 vs Perdedor HM5", "low_bracket", createWaitingSlot("Vencedor HB3"), createWaitingSlot("Perdedor HM5"), { order: 1, matchFormat, waiting: true, nextMatchId: "HB5", nextSlot: "A", loserTo: "Eliminado" })
          ]
        },
        {
          id: "triple-low-r5",
          name: "Final da Chave Baixa",
          stage: "low_bracket",
          matches: [
            createPlayoffMatch("HB5", "HB5 · Vencedor HB4 vs Perdedor HM6", "low_bracket", createWaitingSlot("Vencedor HB4"), createWaitingSlot("Perdedor HM6"), { order: 1, matchFormat, waiting: true, winnerTo: "Final Intermediária", nextMatchId: "FI1", nextSlot: "B", loserTo: "Eliminado" })
          ]
        }
      ]
    };

    const intermediaryFinal = {
      status: "waiting_playoff_results",
      label: "Final Intermediária",
      generatedAt,
      rounds: [
        {
          id: "triple-intermediary-final-r1",
          name: "Final Intermediária",
          stage: "intermediary_final",
          matches: [
            createPlayoffMatch("FI1", "FI1 · Vencedor Chave Média vs Vencedor Chave Baixa", "intermediary_final", createWaitingSlot("Vencedor Chave Média"), createWaitingSlot("Vencedor Chave Baixa"), { order: 1, matchFormat, waiting: true, winnerTo: "Grande Final", nextMatchId: "GF1", nextSlot: "B" })
          ]
        }
      ]
    };

    const grandFinal = {
      status: "waiting_intermediary_final",
      label: "Grande Final",
      generatedAt,
      rules: {
        matchFormat: "FT5",
        noReset: true,
        highAdvantageVsMiddle: 1,
        highAdvantageVsLow: 2,
        note: "A vantagem é aplicada automaticamente quando o desafiante da Final Intermediária for conhecido."
      },
      rounds: [
        {
          id: "triple-grand-final-r1",
          name: "Grande Final",
          stage: "grand_final",
          matches: [
            createPlayoffMatch("GF1", "GF1 · Vencedor Chave Alta vs Vencedor Final Intermediária", "grand_final", createWaitingSlot("Vencedor Chave Alta"), createWaitingSlot("Vencedor Final Intermediária"), { order: 1, matchFormat: "FT5", waiting: true })
          ]
        }
      ]
    };

    return {
      success: true,
      generatedAt,
      seeds,
      playoffSummary: {
        status: "generated",
        generatedAt,
        highBracketSeeds: seeds.slice(0, 4),
        middleBracketSeeds: seeds.slice(4, 8),
        resultAutomation: "enabled_with_grand_final_advantage",
        resultLocked: false,
        message: "Chaves geradas com base na classificação final. Resultados das chaves liberam avanço automático entre Alta, Média, Baixa, Final Intermediária e Grande Final."
      },
      highBracket,
      middleBracket,
      lowBracket,
      intermediaryFinal,
      grandFinal
    };
  }


  const TRIPLE_PLAYOFF_INITIAL_MATCHES = Object.freeze(["HA1", "HA2", "HM1", "HM2"]);
  const TRIPLE_PLAYOFF_PROCESS_ORDER = Object.freeze([
    "HA1", "HA2", "HM1", "HM2",
    "HA3", "HM3", "HM4", "HB1",
    "HM5", "HB2", "HB3",
    "HM6", "HB4",
    "HB5",
    "FI1",
    "GF1"
  ]);
  const TRIPLE_DYNAMIC_WAITING_SLOTS = Object.freeze({
    HA3: ["Vencedor HA1", "Vencedor HA2"],
    HM3: ["Vencedor HM1", "Perdedor HA2"],
    HM4: ["Vencedor HM2", "Perdedor HA1"],
    HM5: ["Vencedor HM3", "Vencedor HM4"],
    HM6: ["Vencedor HM5", "Perdedor HA3"],
    HB1: ["Perdedor HM1", "Perdedor HM2"],
    HB2: ["Perdedor HM3", "Perdedor HM4"],
    HB3: ["Vencedor HB1", "Vencedor HB2"],
    HB4: ["Vencedor HB3", "Perdedor HM5"],
    HB5: ["Vencedor HB4", "Perdedor HM6"],
    FI1: ["Vencedor Chave Média", "Vencedor Chave Baixa"],
    GF1: ["Vencedor Chave Alta", "Vencedor Final Intermediária"]
  });

  const TRIPLE_GRAND_FINAL_ID = "GF1";
  const TRIPLE_FINAL_INTERMEDIARY_ID = "FI1";

  function getTripleBracketSourceFromMatchSide(match, player) {
    if (!match || !player) return "";
    const winnerKey = getTriplePlayerKey(player);
    const playerAKey = getTriplePlayerKey(match.playerA);
    const playerBKey = getTriplePlayerKey(match.playerB);

    if (match.id === "HA3" && winnerKey) {
      return "high_bracket";
    }

    if (match.id === TRIPLE_FINAL_INTERMEDIARY_ID && winnerKey) {
      if (String(winnerKey) === String(playerAKey)) return "middle_bracket";
      if (String(winnerKey) === String(playerBKey)) return "low_bracket";
    }

    return player.tripleBracketSource || player.sourceBracket || player.finalSource || "";
  }

  function getGrandFinalAdvantageValue(challenger = {}) {
    const source = String(
      challenger.tripleBracketFinalSource ||
      challenger.tripleBracketSource ||
      challenger.sourceBracket ||
      challenger.finalSource ||
      ""
    ).toLowerCase();

    if (source.includes("low") || source.includes("baixa")) return DEFAULT_CONFIG.finalSeries.highAdvantageVsLow || 2;
    if (source.includes("middle") || source.includes("media") || source.includes("média")) return DEFAULT_CONFIG.finalSeries.highAdvantageVsMiddle || 1;

    return DEFAULT_CONFIG.finalSeries.highAdvantageVsMiddle || 1;
  }

  function getGrandFinalAdvantageLabel(challenger = {}) {
    const source = String(
      challenger.tripleBracketFinalSource ||
      challenger.tripleBracketSource ||
      challenger.sourceBracket ||
      challenger.finalSource ||
      ""
    ).toLowerCase();

    if (source.includes("low") || source.includes("baixa")) {
      return "Chave Alta inicia 2–0 porque o desafiante veio da Chave Baixa.";
    }

    return "Chave Alta inicia 1–0 porque o desafiante veio da Chave Média.";
  }

  function applyGrandFinalAdvantage(match) {
    if (!match || match.id !== TRIPLE_GRAND_FINAL_ID || !hasTwoRealPlayers(match)) return match;

    const advantageScore = getGrandFinalAdvantageValue(match.playerB);
    const advantageLabel = getGrandFinalAdvantageLabel(match.playerB);

    match.matchFormat = "FT5";
    match.bestOf = "FT5";
    match.advantage = {
      type: "triple_bracket_high_seed_start",
      applied: true,
      slot: "A",
      scoreA: advantageScore,
      scoreB: 0,
      unit: "games",
      label: advantageLabel,
      source: match.playerB?.tripleBracketFinalSource || match.playerB?.tripleBracketSource || "middle_bracket",
      noReset: true
    };
    match.initialScoreA = advantageScore;
    match.initialScoreB = 0;
    match.advantageScoreA = advantageScore;
    match.advantageScoreB = 0;
    match.phaseLabel = "Grande Final · FT5 com vantagem";
    match.resultLockReason = null;

    if (String(match.status || "").toLowerCase() !== "completed") {
      match.resultLocked = false;
      match.status = "pending";

      if (match.scoreA === null || match.scoreA === undefined || Number(match.scoreA) < advantageScore) {
        match.scoreA = advantageScore;
      }

      if (match.scoreB === null || match.scoreB === undefined) {
        match.scoreB = 0;
      }
    }

    return match;
  }


  function isWaitingPlayer(player) {
    return Boolean(player && (player.waitingSlot || player.placeholder || player.isPlaceholder || player.slotStatus === "waiting"));
  }

  function getTriplePlayerKey(player) {
    return getMatchPlayerKey(player);
  }

  function normalizeProgressionPlayer(player, extra = {}) {
    if (!player) return null;

    return {
      ...clone(player),
      placeholder: false,
      isPlaceholder: false,
      waitingSlot: false,
      slotStatus: "filled",
      id: getTriplePlayerKey(player),
      playerId: player.playerId || player.participantId || player.id || getTriplePlayerKey(player),
      nickname: player.nickname || player.name || player.playerName || "Jogador",
      name: player.name || player.nickname || player.playerName || "Jogador",
      ...extra
    };
  }

  function getTripleBracketMatchCollections(structure = {}) {
    return [
      ...(structure.highBracket?.rounds || []),
      ...(structure.middleBracket?.rounds || []),
      ...(structure.lowBracket?.rounds || []),
      ...(structure.intermediaryFinal?.rounds || []),
      ...(structure.grandFinal?.rounds || [])
    ];
  }

  function getTriplePlayoffMatches(structure = {}) {
    return getTripleBracketMatchCollections(structure)
      .flatMap((round) => Array.isArray(round.matches) ? round.matches : [])
      .filter(Boolean);
  }

  function findTriplePlayoffMatch(structure = {}, matchId = "") {
    return getTriplePlayoffMatches(structure).find((match) => String(match.id) === String(matchId)) || null;
  }

  function hasTwoRealPlayers(match) {
    return Boolean(match && match.playerA && match.playerB && !isWaitingPlayer(match.playerA) && !isWaitingPlayer(match.playerB));
  }

  function markTripleMatchAvailability(match) {
    if (!match) return;

    if (hasTwoRealPlayers(match)) {
      if (String(match.status || "").toLowerCase() === "waiting") {
        match.status = "pending";
      }
      if (String(match.status || "").toLowerCase() !== "completed") {
        match.status = "pending";
      }
      match.resultLocked = false;
      match.resultLockReason = null;

      if (match.id === TRIPLE_GRAND_FINAL_ID) {
        applyGrandFinalAdvantage(match);
      }

      return;
    }

    match.status = "waiting";
    match.resultLocked = true;
    match.resultLockReason = "triple_bracket_waiting_for_progression";
  }

  function resetTripleMatchResult(match) {
    if (!match) return;

    match.scoreA = null;
    match.scoreB = null;
    match.winnerId = null;
    match.updatedAt = null;

    if (match.id === TRIPLE_GRAND_FINAL_ID) {
      match.advantage = null;
      match.initialScoreA = null;
      match.initialScoreB = null;
      match.advantageScoreA = null;
      match.advantageScoreB = null;
    }
    if (match.resultWorkflow) {
      match.resultWorkflow.resultStatus = "none";
      match.resultWorkflow.report = {
        scoreA: null,
        scoreB: null,
        winnerId: null,
        createdAt: null,
        updatedAt: null
      };
      match.resultWorkflow.confirmedBy = [];
      match.resultWorkflow.adminResolved = false;
      match.resultWorkflow.resultLocked = false;
    }
  }

  function resetDynamicTripleMatch(match) {
    if (!match) return;
    const labels = TRIPLE_DYNAMIC_WAITING_SLOTS[match.id] || [match.slotA || "A definir", match.slotB || "A definir"];
    match.playerA = createWaitingSlot(labels[0]);
    match.playerB = createWaitingSlot(labels[1]);
    match.slotA = labels[0];
    match.slotB = labels[1];
    resetTripleMatchResult(match);
    markTripleMatchAvailability(match);
  }

  function buildTripleMatchSnapshots(structure = {}) {
    const snapshots = {};
    getTriplePlayoffMatches(structure).forEach((match) => {
      snapshots[match.id] = {
        scoreA: match.scoreA,
        scoreB: match.scoreB,
        winnerId: match.winnerId,
        status: match.status,
        updatedAt: match.updatedAt,
        resultWorkflow: match.resultWorkflow ? clone(match.resultWorkflow) : null,
        playerAKey: getTriplePlayerKey(match.playerA),
        playerBKey: getTriplePlayerKey(match.playerB)
      };
    });
    return snapshots;
  }

  function restoreTripleSnapshotIfCompatible(match, snapshots = {}) {
    if (!match || !hasTwoRealPlayers(match)) return false;
    if (String(match.status || "").toLowerCase() === "completed" && match.winnerId) return true;

    const snapshot = snapshots[match.id];
    if (!snapshot || String(snapshot.status || "").toLowerCase() !== "completed") return false;
    if (snapshot.scoreA === null || snapshot.scoreA === undefined || snapshot.scoreB === null || snapshot.scoreB === undefined) return false;
    if (String(snapshot.playerAKey || "") !== String(getTriplePlayerKey(match.playerA) || "")) return false;
    if (String(snapshot.playerBKey || "") !== String(getTriplePlayerKey(match.playerB) || "")) return false;

    match.scoreA = snapshot.scoreA;
    match.scoreB = snapshot.scoreB;
    match.winnerId = snapshot.winnerId;
    match.status = "completed";
    match.updatedAt = snapshot.updatedAt || new Date().toISOString();
    if (snapshot.resultWorkflow) {
      match.resultWorkflow = clone(snapshot.resultWorkflow);
    }
    match.resultLocked = false;
    match.resultLockReason = null;
    return true;
  }

  function getTripleMatchWinner(match) {
    if (!match || String(match.status || "").toLowerCase() !== "completed" || !match.winnerId) return null;
    const winnerKey = String(match.winnerId || "");
    if (String(getTriplePlayerKey(match.playerA)) === winnerKey) return match.playerA;
    if (String(getTriplePlayerKey(match.playerB)) === winnerKey) return match.playerB;
    return null;
  }

  function getTripleMatchLoser(match) {
    if (!match || String(match.status || "").toLowerCase() !== "completed" || !match.winnerId) return null;
    const winnerKey = String(match.winnerId || "");
    if (String(getTriplePlayerKey(match.playerA)) === winnerKey) return match.playerB;
    if (String(getTriplePlayerKey(match.playerB)) === winnerKey) return match.playerA;
    return null;
  }

  function setTripleTargetSlot(structure, targetMatchId, slot, player, sourceLabel = "") {
    const target = findTriplePlayoffMatch(structure, targetMatchId);
    if (!target || !player) return false;

    const sourceBracket = getTripleBracketSourceFromMatchSide(findTriplePlayoffMatch(structure, String(sourceLabel || "").replace(/^Vencedor\s+|^Perdedor\s+/, "")), player);
    const normalized = normalizeProgressionPlayer(player, {
      lastSource: sourceLabel || targetMatchId,
      advancedAt: new Date().toISOString(),
      tripleBracketSource: sourceBracket || player.tripleBracketSource || player.sourceBracket || "",
      tripleBracketFinalSource: targetMatchId === TRIPLE_GRAND_FINAL_ID
        ? (sourceBracket || player.tripleBracketFinalSource || player.tripleBracketSource || player.sourceBracket || "")
        : (player.tripleBracketFinalSource || player.tripleBracketSource || sourceBracket || "")
    });

    if (String(slot || "A").toUpperCase() === "B") {
      target.playerB = normalized;
      target.slotB = normalized.seedLabel || normalized.nickname || "Classificado";
    } else {
      target.playerA = normalized;
      target.slotA = normalized.seedLabel || normalized.nickname || "Classificado";
    }

    markTripleMatchAvailability(target);

    if (target.id === TRIPLE_GRAND_FINAL_ID) {
      applyGrandFinalAdvantage(target);
    }

    return true;
  }

  function applyTripleMatchProgression(structure, match) {
    if (!structure || !match || String(match.status || "").toLowerCase() !== "completed") return;

    const winner = getTripleMatchWinner(match);
    const loser = getTripleMatchLoser(match);

    if (winner && match.nextMatchId && match.nextSlot) {
      setTripleTargetSlot(structure, match.nextMatchId, match.nextSlot, winner, `Vencedor ${match.id}`);
    }

    if (loser && match.loserNextMatchId && match.loserNextSlot) {
      setTripleTargetSlot(structure, match.loserNextMatchId, match.loserNextSlot, loser, `Perdedor ${match.id}`);
    }
  }

  function buildTripleProgressionSummary(structure = {}) {
    const matches = getTriplePlayoffMatches(structure);
    const playable = matches.filter(hasTwoRealPlayers);
    const completed = playable.filter((match) => String(match.status || "").toLowerCase() === "completed" && match.winnerId);
    const waiting = matches.filter((match) => !hasTwoRealPlayers(match));
    const grandFinal = findTriplePlayoffMatch(structure, TRIPLE_GRAND_FINAL_ID);
    const champion = getTripleMatchWinner(grandFinal);
    const grandFinalAdvantage = grandFinal?.advantage || null;

    return {
      status: champion ? "completed" : (completed.length > 0 ? "in_progress" : "generated"),
      playableMatches: playable.length,
      completedMatches: completed.length,
      waitingMatches: waiting.length,
      grandFinalAdvantage,
      champion: champion ? normalizeProgressionPlayer(champion, { placementLabel: "Campeão" }) : null,
      updatedAt: new Date().toISOString()
    };
  }

  function recalculatePlayoffProgression(structure = {}) {
    if (!structure || structure.type !== FORMAT_KEY) {
      return { success: false, message: "Estrutura do Sistema de 3 Chaves não encontrada." };
    }

    if (!structure.highBracket || !structure.middleBracket || !structure.lowBracket) {
      return { success: false, message: "As chaves ainda não foram geradas." };
    }

    const snapshots = buildTripleMatchSnapshots(structure);

    getTriplePlayoffMatches(structure).forEach((match) => {
      if (!TRIPLE_PLAYOFF_INITIAL_MATCHES.includes(match.id)) {
        resetDynamicTripleMatch(match);
      } else {
        markTripleMatchAvailability(match);
      }
    });

    TRIPLE_PLAYOFF_PROCESS_ORDER.forEach((matchId) => {
      const match = findTriplePlayoffMatch(structure, matchId);
      if (!match) return;

      restoreTripleSnapshotIfCompatible(match, snapshots);
      markTripleMatchAvailability(match);

      if (String(match.status || "").toLowerCase() === "completed" && match.winnerId) {
        applyTripleMatchProgression(structure, match);
      }
    });

    const summary = buildTripleProgressionSummary(structure);
    structure.playoffs = {
      ...(structure.playoffs || {}),
      status: summary.status,
      resultAutomation: "enabled_with_grand_final_advantage",
      resultLocked: false,
      progressionSummary: summary,
      message: summary.champion
        ? `Sistema de 3 Chaves concluído. Campeão: ${summary.champion.nickname}.`
        : "Avanço automático ativo para todas as chaves, com vantagem automática na Grande Final."
    };
    structure.automationStage = summary.champion ? "triple_bracket_completed" : "triple_playoff_progression_active";
    structure.currentStep = summary.champion ? "completed" : "triple_playoffs";
    structure.updatedAt = new Date().toISOString();

    return { success: true, summary };
  }

  function buildCreationPreview() {
    return {
      badge: "MVP 8 equipes",
      cards: [
        { label: "Fase inicial", value: "Todos contra todos", detail: "8 equipes · 28 partidas · classificação geral" },
        { label: "Corte", value: "Top 4 / Bottom 4", detail: "1º–4º entram na Chave Alta; 5º–8º entram na Chave Média" },
        { label: "Quedas", value: "Alta → Média → Baixa", detail: "A Chave Baixa é a última chance antes da eliminação" },
        { label: "Final", value: "FT5 sem reset", detail: "Alta começa 1–0 contra Média ou 2–0 contra Baixa" }
      ],
      flow: [
        { label: "Grupos", description: "Todas as 8 equipes se enfrentam em tabela única." },
        { label: "Separação", description: "Top 4 ganham caminho privilegiado na Chave Alta." },
        { label: "Playoffs", description: "Derrotas descem uma chave até a eliminação na Chave Baixa." },
        { label: "Decisão", description: "Média e Baixa decidem o desafiante da Grande Final." }
      ]
    };
  }

  window.SBWTripleBracket = Object.freeze({
    FORMAT_KEY,
    SCHEMA_VERSION,
    DEFAULT_CONFIG,
    PLAYOFF_BLUEPRINT,
    isTripleBracketFormat,
    buildConfig,
    buildCreationDraft,
    buildCreationPreview,
    normalizeMatchPlayer,
    createPlaceholderParticipant,
    completeGroupStageParticipants,
    createStandingRow,
    buildRoundRobinRounds,
    validateGroupStageParticipants,
    getStructureModeFromCounts,
    isTemplateStructure,
    canRecordGroupStageResults,
    buildOfficializationSummary,
    areGroupStageMatchesCompleted,
    buildPlayoffBracketsFromGroupStage,
    getTriplePlayoffMatches,
    findTriplePlayoffMatch,
    recalculatePlayoffProgression,
    buildTripleProgressionSummary,
    applyGrandFinalAdvantage,
    getGrandFinalAdvantageValue,
    getGrandFinalAdvantageLabel,
    buildGroupStageStructure
  });
})();
