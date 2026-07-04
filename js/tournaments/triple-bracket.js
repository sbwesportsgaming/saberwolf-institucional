// v1.6.82 — Fase todos contra todos do Sistema de 3 Chaves da plataforma -SBW-
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
    automationStage: "round_robin_ready"
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
    const templateMode = placeholderSlots > 0;
    const prefix = normalizePlayerKey(tournament.slug || tournament.id || tournament.title || "triple-bracket", "triple-bracket");
    const matchFormat = options.matchFormat || tournament?.settings?.matchFormat || tournament?.matchFormat || "MD3";
    const rounds = buildRoundRobinRounds(sourcePlayers, { prefix, matchFormat });
    const standings = sourcePlayers.map(createStandingRow);
    const flatMatches = rounds.flatMap((round) => round.matches || []);
    const now = new Date().toISOString();

    const groupStage = {
      type: "round_robin",
      label: "Fase todos contra todos",
      status: templateMode ? "template_generated" : "generated",
      generatedAt: now,
      templateMode,
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
        currentStep: "group_stage",
        automationStage: templateMode ? "group_stage_template_generated" : "group_stage_generated",
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
            ? "Estrutura modelo gerada com vagas em aberto. Antes de lançar resultados reais, preencha as inscrições e regenere/atualize a estrutura com as 8 equipes reais."
            : "Estrutura oficial gerada com 8 equipes reais."
        }
      }
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
    buildGroupStageStructure
  });
})();
