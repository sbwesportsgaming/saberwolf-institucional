// v1.6.84 — Geração das chaves do Sistema de 3 Chaves da plataforma -SBW-
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
      resultLocked: true,
      resultLockReason: "triple_bracket_playoff_progression_pending"
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
            createPlayoffMatch("HA1", "HA1 · 1º vs 4º", "high_bracket", s1, s4, { order: 1, matchFormat, loserTo: "HM4", loserNextMatchId: "HM4", loserNextSlot: "B" }),
            createPlayoffMatch("HA2", "HA2 · 2º vs 3º", "high_bracket", s2, s3, { order: 2, matchFormat, loserTo: "HM3", loserNextMatchId: "HM3", loserNextSlot: "B" })
          ]
        },
        {
          id: "triple-high-r2",
          name: "Final da Chave Alta",
          stage: "high_bracket",
          matches: [
            createPlayoffMatch("HA3", "HA3 · Final da Chave Alta", "high_bracket", createWaitingSlot("Vencedor HA1"), createWaitingSlot("Vencedor HA2"), { order: 1, matchFormat, waiting: true, winnerTo: "Grande Final", loserTo: "HM6", loserNextMatchId: "HM6", loserNextSlot: "B" })
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
            createPlayoffMatch("HM1", "HM1 · 5º vs 8º", "middle_bracket", s5, s8, { order: 1, matchFormat, loserTo: "HB1", loserNextMatchId: "HB1", loserNextSlot: "A" }),
            createPlayoffMatch("HM2", "HM2 · 6º vs 7º", "middle_bracket", s6, s7, { order: 2, matchFormat, loserTo: "HB1", loserNextMatchId: "HB1", loserNextSlot: "B" })
          ]
        },
        {
          id: "triple-middle-r2",
          name: "Chave Média — Quedas da Alta",
          stage: "middle_bracket",
          matches: [
            createPlayoffMatch("HM3", "HM3 · Vencedor HM1 vs Perdedor HA2", "middle_bracket", createWaitingSlot("Vencedor HM1"), createWaitingSlot("Perdedor HA2"), { order: 1, matchFormat, waiting: true, loserTo: "HB2", loserNextMatchId: "HB2", loserNextSlot: "A" }),
            createPlayoffMatch("HM4", "HM4 · Vencedor HM2 vs Perdedor HA1", "middle_bracket", createWaitingSlot("Vencedor HM2"), createWaitingSlot("Perdedor HA1"), { order: 2, matchFormat, waiting: true, loserTo: "HB2", loserNextMatchId: "HB2", loserNextSlot: "B" })
          ]
        },
        {
          id: "triple-middle-r3",
          name: "Chave Média — Final parcial",
          stage: "middle_bracket",
          matches: [
            createPlayoffMatch("HM5", "HM5 · Vencedor HM3 vs Vencedor HM4", "middle_bracket", createWaitingSlot("Vencedor HM3"), createWaitingSlot("Vencedor HM4"), { order: 1, matchFormat, waiting: true, loserTo: "HB4", loserNextMatchId: "HB4", loserNextSlot: "B" })
          ]
        },
        {
          id: "triple-middle-r4",
          name: "Final da Chave Média",
          stage: "middle_bracket",
          matches: [
            createPlayoffMatch("HM6", "HM6 · Vencedor HM5 vs Perdedor HA3", "middle_bracket", createWaitingSlot("Vencedor HM5"), createWaitingSlot("Perdedor HA3"), { order: 1, matchFormat, waiting: true, winnerTo: "Final Intermediária", loserTo: "HB5", loserNextMatchId: "HB5", loserNextSlot: "B" })
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
            createPlayoffMatch("HB1", "HB1 · Perdedor HM1 vs Perdedor HM2", "low_bracket", createWaitingSlot("Perdedor HM1"), createWaitingSlot("Perdedor HM2"), { order: 1, matchFormat, waiting: true, loserTo: "Eliminado" })
          ]
        },
        {
          id: "triple-low-r2",
          name: "Chave Baixa — Segunda eliminação",
          stage: "low_bracket",
          matches: [
            createPlayoffMatch("HB2", "HB2 · Perdedor HM3 vs Perdedor HM4", "low_bracket", createWaitingSlot("Perdedor HM3"), createWaitingSlot("Perdedor HM4"), { order: 1, matchFormat, waiting: true, loserTo: "Eliminado" })
          ]
        },
        {
          id: "triple-low-r3",
          name: "Chave Baixa — Sobrevivência",
          stage: "low_bracket",
          matches: [
            createPlayoffMatch("HB3", "HB3 · Vencedor HB1 vs Vencedor HB2", "low_bracket", createWaitingSlot("Vencedor HB1"), createWaitingSlot("Vencedor HB2"), { order: 1, matchFormat, waiting: true, loserTo: "Eliminado" })
          ]
        },
        {
          id: "triple-low-r4",
          name: "Chave Baixa — Queda da Média",
          stage: "low_bracket",
          matches: [
            createPlayoffMatch("HB4", "HB4 · Vencedor HB3 vs Perdedor HM5", "low_bracket", createWaitingSlot("Vencedor HB3"), createWaitingSlot("Perdedor HM5"), { order: 1, matchFormat, waiting: true, loserTo: "Eliminado" })
          ]
        },
        {
          id: "triple-low-r5",
          name: "Final da Chave Baixa",
          stage: "low_bracket",
          matches: [
            createPlayoffMatch("HB5", "HB5 · Vencedor HB4 vs Perdedor HM6", "low_bracket", createWaitingSlot("Vencedor HB4"), createWaitingSlot("Perdedor HM6"), { order: 1, matchFormat, waiting: true, winnerTo: "Final Intermediária", loserTo: "Eliminado" })
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
            createPlayoffMatch("FI1", "FI1 · Vencedor Chave Média vs Vencedor Chave Baixa", "intermediary_final", createWaitingSlot("Vencedor Chave Média"), createWaitingSlot("Vencedor Chave Baixa"), { order: 1, matchFormat, waiting: true, winnerTo: "Grande Final" })
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
        note: "A vantagem real será aplicada quando o desafiante da Final Intermediária for conhecido."
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
        resultAutomation: "pending_next_patch",
        resultLocked: true,
        message: "Chaves geradas com base na classificação final. Resultados das chaves serão liberados após a automação de avanço entre Alta, Média e Baixa."
      },
      highBracket,
      middleBracket,
      lowBracket,
      intermediaryFinal,
      grandFinal
    };
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
    buildGroupStageStructure
  });
})();
