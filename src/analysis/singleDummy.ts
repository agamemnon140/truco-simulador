/**
 * Analise "single-dummy" da mao: escolhe a MELHOR carta para o heroi jogar agora,
 * SEM clarividencia.
 *
 * Diferenca para o double-dummy (./doubleDummy.ts): apos sortear um mundo, o resto
 * da mao NAO e resolvido por minimax com cartas a vista. Em vez disso, cada jogador
 * (incluindo o parceiro e o proprio heroi nas jogadas seguintes) joga por uma
 * POLITICA fixa, decidindo apenas com a sua propria PlayerView — ninguem enxerga a
 * mao do heroi. Assim some o vies de clarividencia; o preco e depender de qual
 * inteligencia se assume para os demais.
 *
 * Para cada carta candidata da mao do heroi, fixamos essa jogada agora e medimos a
 * chance de vitoria pela media do rollout sobre os mundos. Recomendamos a de maior
 * valor esperado. Os mundos sorteados sao COMPARTILHADOS entre as candidatas
 * (mesmas amostras), reduzindo variancia na comparacao.
 */

import { cardStrength } from "../core/ranking.js";
import { Card, Seat, cardsEqual } from "../core/types.js";
import { Play } from "../core/vaza.js";
import { PlayerView } from "../players/player.js";
import { seededRng } from "../training/rng.js";
import { CardEval } from "./doubleDummy.js";
import { PolicyId, makePolicyPlayer, playoutWorld } from "./rollout.js";
import { WorldOptions, iterWorlds, planWorlds } from "./worlds.js";

export interface SingleDummyResult {
  /** Chance de vitoria jogando a melhor carta. */
  winProb: number;
  tieProb: number;
  lossProb: number;
  /** Carta recomendada agora (maximiza o EV sob a politica dada). */
  bestCard: Card;
  /** Todas as cartas da mao, da melhor para a pior. */
  cards: CardEval[];
  samples: number;
  method: "exact" | "montecarlo";
  policy: PolicyId;
}

export interface SingleDummyOptions extends WorldOptions {
  /** Inteligencia que joga o resto da mao (todos os assentos). Default "inocente". */
  policy?: PolicyId;
}

/** Lider da vaza corrente a partir da view. */
function currentLeader(view: PlayerView): Seat {
  return view.currentVazaPlays.length > 0
    ? view.currentVazaPlays[0]!.seat
    : view.seat;
}

/**
 * Recomenda a melhor carta do heroi agora, com rollout por politica (sem
 * clarividencia), mediado sobre os mundos.
 */
export async function analyzeSingleDummy(
  view: PlayerView,
  opts: SingleDummyOptions = {},
): Promise<SingleDummyResult> {
  const rules = view.rules;
  const n = rules.numPlayers;
  const leader = currentLeader(view);
  const acting = (leader + view.currentVazaPlays.length) % n;
  if (acting !== view.seat) {
    throw new Error(
      `analyzeSingleDummy: nao e a vez do heroi (assento a jogar = ${acting}, heroi = ${view.seat}).`,
    );
  }

  const policy = opts.policy ?? "inocente";
  const { method } = planWorlds(view, opts);
  const playerRng = seededRng((opts.seed ?? 1) + 7);
  const player = makePolicyPlayer(policy, playerRng);
  const heroTeam = view.team;

  // Candidatas: cartas distintas (por forca) da mao do heroi.
  const candidates: Card[] = [];
  const seenStrength = new Set<number>();
  for (const card of view.hand) {
    const st = cardStrength(card, view.vira, rules);
    if (seenStrength.has(st)) continue;
    seenStrength.add(st);
    candidates.push(card);
  }

  const acc = candidates.map(() => ({ win: 0, tie: 0, loss: 0 }));
  let samples = 0;

  for (const hands of iterWorlds(view, opts)) {
    samples++;
    for (let ci = 0; ci < candidates.length; ci++) {
      const card = candidates[ci]!;
      // Heroi joga `card` agora; remove da mao e injeta na vaza corrente.
      const heroHand = hands[view.seat]!;
      const cardIdx = heroHand.findIndex((c) => cardsEqual(c, card));
      const worldHands = hands.map((h, idx) =>
        idx === view.seat ? h.filter((_, j) => j !== cardIdx) : h.slice(),
      );
      const syntheticPlays: Play[] = [
        ...view.currentVazaPlays.map((p) => ({ ...p })),
        { seat: view.seat, card },
      ];
      const syntheticView: PlayerView = {
        ...view,
        currentVazaPlays: syntheticPlays,
      };
      const winner = await playoutWorld(syntheticView, worldHands, player);
      if (winner === null) acc[ci]!.tie++;
      else if (winner === heroTeam) acc[ci]!.win++;
      else acc[ci]!.loss++;
    }
  }

  const denom = samples || 1;
  const cards: CardEval[] = candidates.map((card, ci) => {
    const a = acc[ci]!;
    const winProb = a.win / denom;
    const lossProb = a.loss / denom;
    return {
      card,
      winProb,
      tieProb: a.tie / denom,
      lossProb,
      ev: winProb - lossProb,
    };
  });

  cards.sort((x, y) => y.ev - x.ev || y.winProb - x.winProb);
  const best = cards[0]!;

  return {
    winProb: best.winProb,
    tieProb: best.tieProb,
    lossProb: best.lossProb,
    bestCard: best.card,
    cards,
    samples,
    method,
    policy,
  };
}
