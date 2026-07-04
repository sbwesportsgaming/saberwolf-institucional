// v1.6.81 — Base do formato Sistema de 3 Chaves da plataforma -SBW-
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
    automationStage: "base_config"
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
    buildCreationPreview
  });
})();
