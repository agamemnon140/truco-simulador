/**
 * Analise "double-dummy" da mao: jogo OTIMO por inducao reversa (backward
 * induction / minimax) supondo cartas a vista, mediado sobre os mundos possiveis.
 *
 * Para um baralho FIXO (as 4 maos conhecidas), o truco sem truco vira um jogo de
 * informacao perfeita e soma zero entre as duas equipes: a indução reversa da, de
 * trás para frente, o resultado com jogo perfeito (≤ (3!)^4 = 1296 folhas, barato).
 * A probabilidade de vitoria para um conjunto de cartas abertas e a MEDIA desse
 * resultado sobre os mundos (exata quando os mundos sao poucos — fim da mao — e
 * amostrada por Monte Carlo no inicio).
 *
 * Vantagem sobre o estimador por politica (./winEstimator.ts): NAO depende de qual
 * bot assumir — assume jogo perfeito. Vies: clarividencia (todos enxergam tudo e
 * coordenam perfeitamente), entao e um limite superior do que se obtem na pratica
 * (o analogo do "double-dummy" do bridge). O ótimo de informacao imperfeita
 * (Nash) exigiria CFR.
 */

import { decideHand } from "../core/hand.js";
import { cardStrength, manilhaRank } from "../core/ranking.js";
import { RuleSet } from "../core/rules.js";
import { Card, Seat, TeamId, cardsEqual } from "../core/types.js";
import { Play, VazaResult, resolveVaza } from "../core/vaza.js";
import { PlayerView } from "../players/player.js";
import { WorldOptions, iterWorlds, planWorlds } from "./worlds.js";

interface DDCtx {
  rules: RuleSet;
  vira: Card;
  teamOfSeat: readonly TeamId[];
  heroTeam: TeamId;
  n: number;
}

/**
 * Valor (do ponto de vista da equipe do heroi) com jogo otimo de ambos os lados,
 * a partir do estado parcial e das maos completas `hands`. +1 vitoria, 0 empate,
 * -1 derrota. As equipes maximizam/minimizam esse valor (soma zero).
 */
function ddValue(
  ctx: DDCtx,
  hands: Card[][],
  results: VazaResult[],
  plays: Play[],
  leader: Seat,
): number {
  const { n, rules, vira, teamOfSeat, heroTeam } = ctx;

  // Vaza completa: resolve e decide.
  if (plays.length === n) {
    const result = resolveVaza(plays, vira, teamOfSeat, rules);
    const newResults = [...results, result];
    const decision = decideHand(newResults, rules);
    if (decision === "cancel") return 0;
    if (decision !== "continue") return decision === heroTeam ? 1 : -1;
    const newLeader = result.winningSeat ?? leader;
    return ddValue(ctx, hands, newResults, [], newLeader);
  }

  const seat = (leader + plays.length) % n;
  const hand = hands[seat]!;
  const maximizing = teamOfSeat[seat] === heroTeam;
  let best = maximizing ? -Infinity : Infinity;

  // Cartas de mesma forca na mesma mao sao intercambiaveis: avalia uma so.
  const seenStrength = new Set<number>();
  for (let i = 0; i < hand.length; i++) {
    const card = hand[i]!;
    const st = cardStrength(card, vira, rules);
    if (seenStrength.has(st)) continue;
    seenStrength.add(st);

    const newHands = hands.map((h, idx) =>
      idx === seat ? h.filter((_, j) => j !== i) : h,
    );
    const val = ddValue(ctx, newHands, results, [...plays, { seat, card }], leader);

    if (maximizing) {
      if (val > best) best = val;
      if (best === 1) break; // poda: nao ha valor melhor
    } else {
      if (val < best) best = val;
      if (best === -1) break; // poda: nao ha valor pior para o heroi
    }
  }
  return best;
}

/** Avaliacao double-dummy de uma carta candidata. */
export interface CardEval {
  card: Card;
  winProb: number;
  tieProb: number;
  lossProb: number;
  /** Valor esperado = winProb - lossProb (o que a inducao reversa maximiza). */
  ev: number;
}

export interface DoubleDummyResult {
  /** Chance de vitoria jogando a melhor carta (valor da posicao). */
  winProb: number;
  tieProb: number;
  lossProb: number;
  /** Carta recomendada agora (maximiza o EV double-dummy). */
  bestCard: Card;
  /** Todas as cartas da mao, da melhor para a pior. */
  cards: CardEval[];
  samples: number;
  method: "exact" | "montecarlo";
}

/** Lider da vaza corrente a partir da view. */
function currentLeader(view: PlayerView): Seat {
  return view.currentVazaPlays.length > 0
    ? view.currentVazaPlays[0]!.seat
    : view.seat;
}

/**
 * Analisa a posicao atual (e a vez do heroi) por double-dummy: para cada carta da
 * mao do heroi, calcula a chance de vitoria com jogo otimo dos dois lados,
 * mediada sobre os mundos, e recomenda a melhor carta.
 */
export function analyzeDoubleDummy(
  view: PlayerView,
  opts: WorldOptions = {},
): DoubleDummyResult {
  const rules = view.rules;
  const n = rules.numPlayers;
  const leader = currentLeader(view);
  const acting = (leader + view.currentVazaPlays.length) % n;
  if (acting !== view.seat) {
    throw new Error(
      `analyzeDoubleDummy: nao e a vez do heroi (assento a jogar = ${acting}, heroi = ${view.seat}).`,
    );
  }

  const { method } = planWorlds(view, opts);
  const ctx: DDCtx = {
    rules,
    vira: view.vira,
    teamOfSeat: view.teamOfSeat,
    heroTeam: view.team,
    n,
  };

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
      // Heroi joga `card` agora; demais maos vem do mundo.
      const heroHand = hands[view.seat]!;
      const cardIdx = heroHand.findIndex((c) => cardsEqual(c, card));
      const newHands = hands.map((h, idx) =>
        idx === view.seat ? h.filter((_, j) => j !== cardIdx) : h,
      );
      const plays: Play[] = [
        ...view.currentVazaPlays.map((p) => ({ ...p })),
        { seat: view.seat, card },
      ];
      const v = ddValue(
        ctx,
        newHands,
        view.completedVazaResults.slice(),
        plays,
        leader,
      );
      if (v > 0) acc[ci]!.win++;
      else if (v < 0) acc[ci]!.loss++;
      else acc[ci]!.tie++;
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

  // Melhor carta: maximiza EV (= o que a inducao reversa maximiza); desempata por
  // maior chance de vitoria.
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
  };
}

/** Conveniencia: so a manilha desta mao (util para logs/depuracao). */
export function manilhaOf(view: PlayerView): string {
  return manilhaRank(view.vira, view.rules);
}
