/**
 * Forca das cartas: calculo da manilha a partir da vira e comparacao de cartas.
 *
 * Esta e a logica central do truco. A "vira" e a carta revelada apos a
 * distribuicao; a manilha e o rank imediatamente acima do rank da vira na
 * ordem ciclica de RuleSet.rankOrder. As 4 manilhas sao mais fortes que
 * qualquer carta comum; entre si, desempatam pelo naipe (manilhaSuitOrder).
 */

import { RuleSet } from "./rules.js";
import { Card, Rank } from "./types.js";

/** Rank seguinte (ciclico) na ordem de forca: define qual rank vira manilha. */
export function manilhaRank(vira: Card, rules: RuleSet): Rank {
  const order = rules.rankOrder;
  const idx = order.indexOf(vira.rank);
  if (idx < 0) {
    throw new Error(`Rank da vira invalido para esta variante: ${vira.rank}`);
  }
  return order[(idx + 1) % order.length]!;
}

/** True se a carta e manilha dada a vira atual. */
export function isManilha(card: Card, vira: Card, rules: RuleSet): boolean {
  return card.rank === manilhaRank(vira, rules);
}

/**
 * Forca absoluta de uma carta dada a vira. Numeros maiores = mais forte.
 * Cartas comuns ocupam [0, rankOrder.length); manilhas ficam acima de todas
 * elas, ordenadas pelo naipe.
 */
export function cardStrength(card: Card, vira: Card, rules: RuleSet): number {
  const commonRange = rules.rankOrder.length;
  if (isManilha(card, vira, rules)) {
    const suitRank = rules.manilhaSuitOrder.indexOf(card.suit);
    if (suitRank < 0) {
      throw new Error(`Naipe sem ordem definida para manilha: ${card.suit}`);
    }
    return commonRange + suitRank;
  }
  const rankIdx = rules.rankOrder.indexOf(card.rank);
  if (rankIdx < 0) {
    throw new Error(`Rank invalido para esta variante: ${card.rank}`);
  }
  return rankIdx;
}

/**
 * Compara duas cartas pela forca. Retorna:
 *  > 0 se `a` e mais forte, < 0 se `b` e mais forte, 0 se EMPATE.
 * Empate so ocorre entre duas cartas comuns de mesmo rank (manilhas nunca
 * empatam, pois cada naipe tem forca distinta).
 */
export function compareCards(
  a: Card,
  b: Card,
  vira: Card,
  rules: RuleSet,
): number {
  return cardStrength(a, vira, rules) - cardStrength(b, vira, rules);
}
