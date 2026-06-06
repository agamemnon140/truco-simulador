/**
 * Explicabilidade da inteligencia evoluida: dado um genoma e uma PlayerView,
 * decompoe o cardScore (qual carta jogar) e o score de aposta S em
 * contribuicoes (feature x peso), para mostrar "por que" o bot decidiu assim.
 *
 * Puro (sem I/O): serve ao CLI e ao HTML.
 */

import { Card, cardToString } from "../core/types.js";
import {
  BET_FEATURE_NAMES,
  CARD_FEATURE_NAMES,
  betFeatures,
  cardFeatures,
  precompute,
} from "./features.js";
import { Genome } from "./genome.js";
import { PlayerView } from "./player.js";

/** Contribuicao de uma feature ao score: contribution = weight * value. */
export interface Contribution {
  index: number;
  name: string;
  value: number;
  weight: number;
  contribution: number;
}

/** Explicacao do score de uma carta candidata. */
export interface CardExplanation {
  card: Card;
  score: number;
  contributions: Contribution[];
  chosen: boolean;
}

export interface CardChoiceExplanation {
  cards: CardExplanation[];
  chosenIndex: number;
}

/** Payload emitido pelo callback onDecision do EvolvedBotPlayer. */
export interface DecisionInfo {
  seat: number;
  name: string;
  /** True se decidiu pedir/aumentar truco; false se jogou carta. */
  raised: boolean;
  betting: BettingExplanation;
  /** Presente quando jogou uma carta. */
  cardChoice?: CardChoiceExplanation;
}

/** Explicacao da decisao de aposta (score S vs limiares). */
export interface BettingExplanation {
  s: number;
  contributions: Contribution[];
  thrCall: number;
  thrAccept: number;
  thrRaise: number;
}

function build(
  names: readonly string[],
  weights: readonly number[],
  values: readonly number[],
): { score: number; contributions: Contribution[] } {
  const contributions: Contribution[] = [];
  let score = 0;
  for (let i = 0; i < weights.length; i++) {
    const contribution = weights[i]! * values[i]!;
    score += contribution;
    contributions.push({
      index: i,
      name: names[i] ?? `f${i}`,
      value: values[i]!,
      weight: weights[i]!,
      contribution,
    });
  }
  return { score, contributions };
}

/** Decompoe a escolha de carta: score e contribuicoes por carta candidata. */
export function explainCardChoice(
  genome: Genome,
  view: PlayerView,
): CardChoiceExplanation {
  const pre = precompute(view);
  const cards: CardExplanation[] = view.hand.map((card) => {
    const { score, contributions } = build(
      CARD_FEATURE_NAMES,
      genome.cardWeights,
      cardFeatures(view, card, pre),
    );
    return { card, score, contributions, chosen: false };
  });
  let chosenIndex = 0;
  for (let i = 1; i < cards.length; i++) {
    if (cards[i]!.score > cards[chosenIndex]!.score) chosenIndex = i;
  }
  if (cards[chosenIndex]) cards[chosenIndex]!.chosen = true;
  return { cards, chosenIndex };
}

/** Decompoe a decisao de aposta: S e contribuicoes. */
export function explainBetting(
  genome: Genome,
  view: PlayerView,
): BettingExplanation {
  const pre = precompute(view);
  const { score, contributions } = build(
    BET_FEATURE_NAMES,
    genome.betWeights,
    betFeatures(view, pre),
  );
  return {
    s: score,
    contributions,
    thrCall: genome.thrCall,
    thrAccept: genome.thrAccept,
    thrRaise: genome.thrRaise,
  };
}

/** Top-k contribuicoes por magnitude (usado nas APOSTAS, decisao unica). */
export function topContributions(
  contributions: readonly Contribution[],
  k = 3,
): Contribution[] {
  return [...contributions]
    .filter((c) => Math.abs(c.contribution) > 1e-9)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, k);
}

/** Uma feature e quanto ela DIFERENCIA a carta escolhida das demais. */
export interface DiffContribution {
  name: string;
  diff: number;
}

/**
 * Para explicar a ESCOLHA de carta: contribuicao DIFERENCIAL = contribuicao da
 * carta escolhida menos a media daquela feature entre todas as candidatas.
 * Features constantes entre as cartas (contexto, posicao na vaza) zeram e somem;
 * sobram as que de fato distinguem a escolha. Top-k por magnitude.
 */
export function differentiatingContributions(
  exp: CardChoiceExplanation,
  cardIndex: number,
  k = 3,
): DiffContribution[] {
  const cards = exp.cards;
  const chosen = cards[cardIndex];
  if (!chosen || cards.length === 0) return [];
  const n = chosen.contributions.length;
  const diffs: DiffContribution[] = [];
  for (let i = 0; i < n; i++) {
    let mean = 0;
    for (const c of cards) mean += c.contributions[i]!.contribution;
    mean /= cards.length;
    diffs.push({
      name: chosen.contributions[i]!.name,
      diff: chosen.contributions[i]!.contribution - mean,
    });
  }
  return diffs
    .filter((d) => Math.abs(d.diff) > 1e-9)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, k);
}

const sign = (x: number) => (x >= 0 ? "+" : "−");
const fmt = (x: number) => `${sign(x)}${Math.abs(x).toFixed(2)}`;

/** Formata as razoes de uma escolha de carta em uma linha (pura). */
export function formatCardChoice(exp: CardChoiceExplanation, name: string): string {
  const chosen = exp.cards[exp.chosenIndex]!;
  const reasons = differentiatingContributions(exp, exp.chosenIndex, 3)
    .map((d) => `${d.name} ${fmt(d.diff)}`)
    .join(", ");
  return `   [explica] ${name} jogou ${cardToString(chosen.card)} ` +
    `(score ${chosen.score.toFixed(2)}): ${reasons || "carta unica"}`;
}

/** Formata as razoes de um pedido/aumento de truco em uma linha (pura). */
export function formatBetting(exp: BettingExplanation, name: string): string {
  const reasons = topContributions(exp.contributions, 3)
    .map((c) => `${c.name} ${fmt(c.contribution)}`)
    .join(", ");
  return `   [explica] ${name} apostou: S=${exp.s.toFixed(2)} ` +
    `(limiar truco ${exp.thrCall.toFixed(2)}); ${reasons}`;
}
