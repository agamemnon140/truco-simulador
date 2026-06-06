/**
 * Ponto de entrada unico do bundle web (global `Truco`). Reune os dois modos:
 *
 *   Truco.simulate(options)            -> Promise<string[]>      (assistir bot vs bot)
 *   Truco.playInteractive(options, ui) -> Promise<MatchResult>   (humano joga)
 *
 * Tambem reexpoe helpers de render (fmtCard/teamName) para a UI formatar cartas
 * e equipes do mesmo jeito que a CLI, sem reimplementar.
 */

export { simulate } from "./browser-entry.js";
export type { SimulateOptions } from "./browser-entry.js";

export { playInteractive } from "./play-entry.js";
export type { PlayOptions, PlayEvent, PlayUiHooks, SeatConfig } from "./play-entry.js";

export { fmtCard, teamName } from "../cli/render.js";

// Lista de personalidades (id/label/description) para a UI montar dropdowns e a tela de Info.
export { PERSONALITIES } from "../players/personalities.js";

// Calculadora de chance de vitoria da mao (web/calc.html). Expoe a API de calculo e
// os enums/utilitarios que a UI precisa para montar cartas e ler a manilha.
export { calcScenario, CALC_POLICIES } from "../analysis/calcApi.js";
export type { CalcScenario, CalcOptions, CalcResult } from "../analysis/calcApi.js";
export { Rank, Suit, cardToString } from "../core/types.js";
export type { Card } from "../core/types.js";
export { manilhaRank, cardStrength } from "../core/ranking.js";
export { resolveVaza } from "../core/vaza.js";
export { TRUCO_PAULISTA } from "../core/rules.js";
