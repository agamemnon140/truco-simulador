/**
 * Bot basico: decide por heuristica simples baseada na forca das cartas.
 *
 * Estrategia (suficiente para o MVP, facil de evoluir depois):
 *  - Jogar: se da pra vencer a vaza, joga a MENOR carta que vence; se esta
 *    liderando, joga a mais forte; se nao da pra vencer, descarta a mais fraca.
 *  - Pedir truco: so quando a mao e forte e a aposta permite.
 *  - Responder: mao muito forte -> aumenta (se puder); mao razoavel -> aceita;
 *    mao fraca -> corre.
 */

import { cardStrength, compareCards } from "../core/ranking.js";
import { Card } from "../core/types.js";
import {
  Action,
  MaoDeOnzeContext,
  MaoDeOnzeDecision,
  Player,
  PlayerView,
  Proposal,
  RaiseResponse,
} from "./player.js";

/** Forca maxima possivel de uma carta nesta variante (manilha mais forte). */
function maxStrength(view: PlayerView): number {
  return view.rules.rankOrder.length + view.rules.manilhaSuitOrder.length - 1;
}

/** Pontuacao da mao do bot em [0, 1]: media normalizada da forca das cartas. */
function handScore(view: PlayerView): number {
  if (view.hand.length === 0) return 0;
  const max = maxStrength(view);
  let sum = 0;
  for (const c of view.hand) sum += cardStrength(c, view.vira, view.rules);
  return sum / (max * view.hand.length);
}

/** Carta mais forte atualmente vencendo a vaza, ou null se ninguem jogou. */
function currentBest(view: PlayerView): Card | null {
  let best: Card | null = null;
  for (const p of view.currentVazaPlays) {
    if (best === null || compareCards(p.card, best, view.vira, view.rules) > 0) {
      best = p.card;
    }
  }
  return best;
}

/** Forca normalizada [0,1] de um conjunto de cartas, dada a vira. */
function cardsScore(cards: readonly Card[], view: PlayerView): number {
  if (cards.length === 0) return 0;
  const max = maxStrength(view);
  let sum = 0;
  for (const c of cards) sum += cardStrength(c, view.vira, view.rules);
  return sum / (max * cards.length);
}

/** Escolhe a carta a jogar conforme a heuristica. */
function pickCard(view: PlayerView): Card {
  // Mao "fechada" (11x11): nao se conhece as cartas; joga uma sem estrategia.
  if (view.blind) return view.hand[0]!;

  const hand = [...view.hand].sort(
    (a, b) =>
      cardStrength(a, view.vira, view.rules) -
      cardStrength(b, view.vira, view.rules),
  );
  const best = currentBest(view);

  if (best === null) {
    // Liderando a vaza: joga a carta mais forte.
    return hand[hand.length - 1]!;
  }

  // Menor carta que vence a carta atual.
  for (const c of hand) {
    if (compareCards(c, best, view.vira, view.rules) > 0) return c;
  }
  // Nao da pra vencer: descarta a mais fraca.
  return hand[0]!;
}

export class BotPlayer implements Player {
  constructor(readonly name: string) {}

  async chooseAction(view: PlayerView, canRaise: boolean): Promise<Action> {
    // Pede truco quando a mao e forte e a aposta permite.
    if (canRaise && handScore(view) > 0.7) {
      return { type: "raise" };
    }
    return { type: "play", card: pickCard(view) };
  }

  async respondToRaise(
    view: PlayerView,
    _proposal: Proposal,
    canCounter: boolean,
  ): Promise<RaiseResponse> {
    const score = handScore(view);
    if (score > 0.78 && canCounter) return "raise";
    if (score > 0.35) return "accept";
    return "run";
  }

  async decideMaoDeOnze(
    view: PlayerView,
    ctx: MaoDeOnzeContext,
  ): Promise<MaoDeOnzeDecision> {
    // Avalia a forca combinada da dupla (propria mao + cartas do parceiro).
    const all = [...view.hand, ...ctx.partnerHands.flat()];
    const score = cardsScore(all, view);
    // Joga valendo 3 se a dupla parece pelo menos mediana; senao corre (da 1).
    return score > 0.45 ? "play" : "fold";
  }
}
