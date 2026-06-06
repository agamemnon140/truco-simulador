/**
 * "Comunicacao minima" entre parceiros: os 3 sinais (verdadeiros, calculados da
 * mao real do parceiro) que o modo humano oferece, agora reaproveitaveis pelo
 * motor para os bots. Puro (sem I/O). Niveis: 0 ruim, 1 medio, 2 bom.
 *
 *  - signal      : tem manilha (2) / um 3 (1) / nada (0).
 *  - trucoAdvice : forte p/ apostar? manilha ou dois "grandes" (2); um grande (1); fraco (0).
 *  - canWin      : ganho a vaza atual? compara minha melhor carta com a melhor do
 *                  adversario na mesa (manilha + na frente = 2; na frente = 1; senao 0).
 */

import { cardStrength, isManilha } from "../core/ranking.js";
import { RuleSet } from "../core/rules.js";
import { Card, Rank } from "../core/types.js";

export type Level = 0 | 1 | 2;

export interface PartnerSignals {
  signal: Level;
  canWin: Level;
  trucoAdvice: Level;
}

export function signalLevel(hand: readonly Card[], vira: Card, rules: RuleSet): Level {
  if (hand.some((c) => isManilha(c, vira, rules))) return 2;
  if (hand.some((c) => c.rank === Rank.Tres)) return 1;
  return 0;
}

export function trucoAdviceLevel(hand: readonly Card[], vira: Card, rules: RuleSet): Level {
  const man = hand.filter((c) => isManilha(c, vira, rules)).length;
  const big = hand.filter((c) => c.rank === Rank.Tres || c.rank === Rank.Dois).length;
  if (man >= 1 || big >= 2) return 2;
  if (big >= 1) return 1;
  return 0;
}

/** `oppBestStrength` = maior forca da carta adversaria na mesa (ou -1 se nenhuma). */
export function canWinLevel(
  hand: readonly Card[],
  vira: Card,
  rules: RuleSet,
  oppBestStrength: number,
): Level {
  if (hand.length === 0) return 0;
  const myBest = Math.max(...hand.map((c) => cardStrength(c, vira, rules)));
  const hasMan = hand.some((c) => isManilha(c, vira, rules));
  if (myBest > oppBestStrength && hasMan) return 2;
  if (myBest > oppBestStrength) return 1;
  return 0;
}

export function partnerSignalsOf(
  hand: readonly Card[],
  vira: Card,
  rules: RuleSet,
  oppBestStrength: number,
): PartnerSignals {
  return {
    signal: signalLevel(hand, vira, rules),
    canWin: canWinLevel(hand, vira, rules, oppBestStrength),
    trucoAdvice: trucoAdviceLevel(hand, vira, rules),
  };
}
