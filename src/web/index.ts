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

export { playInteractive, HUMAN_SEAT } from "./play-entry.js";
export type { PlayOptions, PlayEvent, PlayUiHooks } from "./play-entry.js";

export { fmtCard, teamName } from "../cli/render.js";
