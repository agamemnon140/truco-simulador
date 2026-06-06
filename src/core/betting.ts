/**
 * Maquina de estados da aposta (truco) de uma mao.
 *
 * Modelo: uma mao comeca valendo `baseValue` (1). Uma equipe pode PROPOR um
 * aumento (pedir truco -> seis -> nove -> doze). A equipe adversaria responde:
 *   - correr  : a mao acaba, quem propos leva o valor ESTABELECIDO (antes do
 *               aumento proposto);
 *   - aceitar : o valor sobe para o nivel proposto e o jogo continua;
 *   - aumentar: contrapropoe o proximo nivel (papeis se invertem).
 *
 * Regra de quem pode propor: quem fez o ultimo aumento aceito NAO pode propor
 * de novo; cabe a equipe adversaria. No inicio (sem truco), qualquer equipe pode.
 */

import { RuleSet } from "./rules.js";
import { TeamId } from "./types.js";

export interface BettingState {
  /** Indice do nivel aceito em rules.bettingLevels; -1 = sem truco ainda. */
  level: number;
  /** Equipe que fez o ultimo aumento aceito; null se nenhum. */
  lastRaiser: TeamId | null;
}

/** Estado inicial: mao valendo o valor base, sem truco. */
export function initBetting(): BettingState {
  return { level: -1, lastRaiser: null };
}

/** Valor atual estabelecido da mao (se ninguem aumentar mais). */
export function currentValue(s: BettingState, rules: RuleSet): number {
  return s.level < 0 ? rules.baseValue : rules.bettingLevels[s.level]!.value;
}

/** True se ja chegou ao ultimo nivel (nao da pra aumentar mais). */
export function isMaxed(s: BettingState, rules: RuleSet): boolean {
  return s.level >= rules.bettingLevels.length - 1;
}

/** Nivel que seria proposto a seguir, ou null se ja no maximo. */
export function nextLevel(
  s: BettingState,
  rules: RuleSet,
): { index: number; name: string; value: number } | null {
  if (isMaxed(s, rules)) return null;
  const index = s.level + 1;
  const lvl = rules.bettingLevels[index]!;
  return { index, name: lvl.name, value: lvl.value };
}

/**
 * Se `team` pode propor um aumento agora.
 * Nao pode se ja esta no maximo, nem se foi a propria equipe que fez o ultimo
 * aumento aceito (precisa o adversario responder/jogar antes).
 */
export function canPropose(
  s: BettingState,
  team: TeamId,
  rules: RuleSet,
): boolean {
  if (isMaxed(s, rules)) return false;
  return s.lastRaiser === null || s.lastRaiser !== team;
}

/**
 * Valor que a equipe proponente leva se a adversaria CORRER agora.
 * E o valor estabelecido antes do aumento proposto (== currentValue).
 */
export function forfeitValueOnRun(s: BettingState, rules: RuleSet): number {
  return currentValue(s, rules);
}

/**
 * Aplica a aceitacao de um aumento proposto por `proposer`.
 * Retorna novo estado com o nivel elevado.
 */
export function acceptRaise(
  s: BettingState,
  proposer: TeamId,
  rules: RuleSet,
): BettingState {
  if (isMaxed(s, rules)) {
    throw new Error("Nao ha aumento para aceitar: aposta no maximo.");
  }
  return { level: s.level + 1, lastRaiser: proposer };
}
