/**
 * Ponto de entrada do nucleo (core) para reuso por outras interfaces (ex.: web).
 * Reexporta a API publica do motor e dos jogadores.
 */

export * from "./core/types.js";
export * from "./core/deck.js";
export * from "./core/rules.js";
export * from "./core/ranking.js";
export * from "./core/vaza.js";
export * from "./core/betting.js";
export * from "./core/hand.js";
export * from "./core/match.js";
export * from "./players/player.js";
export * from "./players/bot.js";
