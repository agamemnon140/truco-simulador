/**
 * API "amigavel a UI" para a calculadora de chance de vitoria da mao (web/calc.html).
 *
 * Recebe um cenario montado por humano (vira, assento do heroi, quem foi a mao, mao
 * do heroi e as cartas ja jogadas por vaza, EM ORDEM DE JOGO) e devolve a comparacao
 * completa dos estimadores ja existentes, SEM truco:
 *   - politicas (rollout): random, inocente, melhorada_1..5  (./winEstimator.ts)
 *   - double-dummy: jogo otimo com cartas a vista, limite superior (./doubleDummy.ts)
 *   - single-dummy: melhor carta sem clarividencia (./singleDummy.ts)
 *
 * A UI so informa CARTAS por vaza; os assentos sao derivados da rotacao do lider
 * (vaza 1 abre na "mao"; cada vaza seguinte abre em quem venceu a anterior), e os
 * resultados das vazas completas sao calculados por resolveVaza(). Assim a UI nao
 * precisa conhecer a mecanica interna do PlayerView.
 *
 * Fixado em Truco Paulista 2v2 (parceiros cruzados: assentos 0+2 vs 1+3).
 */

import { manilhaRank } from "../core/ranking.js";
import { RuleSet, TRUCO_PAULISTA } from "../core/rules.js";
import { Card, Rank, Seat, TeamId, cardToString, cardsEqual } from "../core/types.js";
import { Play, VazaResult, resolveVaza } from "../core/vaza.js";
import { PlayerView } from "../players/player.js";
import { DoubleDummyResult, analyzeDoubleDummy } from "./doubleDummy.js";
import { SingleDummyResult, analyzeSingleDummy } from "./singleDummy.js";
import { PolicyId, WinEstimate, comparePolicies } from "./winEstimator.js";

/** Politicas comparadas na tabela (da mais "ingenua" a mais forte). */
export const CALC_POLICIES: PolicyId[] = [
  "random",
  "inocente",
  "melhorada_1",
  "melhorada_2",
  "melhorada_3",
  "melhorada_4",
  "melhorada_5",
];

/** Cenario montado pela UI. So cartas; assentos sao derivados. */
export interface CalcScenario {
  /** Assento do heroi (0..3). Equipe = seat % 2. */
  seat: Seat;
  /** Quem foi a "mao" (abriu a vaza 1). */
  maoSeat: Seat;
  /** Carta virada (define a manilha). */
  vira: Card;
  /** Cartas que o heroi AINDA tem na mao. */
  hand: Card[];
  /** Vazas ja completas: cada uma com 4 cartas, EM ORDEM DE JOGO (a partir do lider). */
  completedVazas: Card[][];
  /** Cartas ja jogadas na vaza atual, em ordem de jogo (0..3). */
  currentVaza: Card[];
}

/** Opcoes de calculo. */
export interface CalcOptions {
  /** Amostras de Monte Carlo quando a enumeracao exata nao cabe. Default 3000. */
  samples?: number;
  /** Semente para reprodutibilidade. Default 42. */
  seed?: number;
}

export interface CalcResult {
  /** Rank que e manilha nesta mao. */
  manilha: Rank;
  /** Assento que deve jogar agora (derivado da rotacao do lider). */
  acting: Seat;
  /** Verdadeiro quando e a vez do heroi (habilita double/single-dummy). */
  heroToPlay: boolean;
  /** Resultados derivados de cada vaza completa (para a UI conferir/empate). */
  completedResults: VazaResult[];
  /** Chance de vitoria por politica de rollout. */
  policies: Record<string, WinEstimate>;
  /** Jogo otimo com cartas a vista (so quando e a vez do heroi). */
  doubleDummy: DoubleDummyResult | null;
  /** Melhor carta sem clarividencia, oponentes='melhorada_5' (so quando e a vez do heroi). */
  singleDummy: SingleDummyResult | null;
}

const RULES: RuleSet = TRUCO_PAULISTA;

/** Mapa assento -> equipe alternando (0,1,0,1). */
function alternatingTeams(n: number): TeamId[] {
  return Array.from({ length: n }, (_, s) => s % 2);
}

/**
 * Converte as cartas por vaza (em ordem de jogo) em jogadas com assento, seguindo a
 * rotacao do lider, e calcula o resultado de cada vaza completa. Devolve tambem o
 * lider da vaza atual.
 */
function buildPlays(
  scenario: CalcScenario,
  teamOfSeat: readonly TeamId[],
): {
  completedVazaPlays: Play[][];
  completedVazaResults: VazaResult[];
  currentVazaPlays: Play[];
  currentLeader: Seat;
} {
  const n = RULES.numPlayers;
  let leader = scenario.maoSeat;
  const completedVazaPlays: Play[][] = [];
  const completedVazaResults: VazaResult[] = [];

  for (const cards of scenario.completedVazas) {
    const plays: Play[] = cards.map((card, k) => ({
      seat: (leader + k) % n,
      card,
    }));
    const result = resolveVaza(plays, scenario.vira, teamOfSeat, RULES);
    completedVazaPlays.push(plays);
    completedVazaResults.push(result);
    // Em empate (sem vencedor) o lider se mantem (regra de hand.ts).
    leader = result.winningSeat ?? leader;
  }

  const currentVazaPlays: Play[] = scenario.currentVaza.map((card, k) => ({
    seat: (leader + k) % n,
    card,
  }));

  return {
    completedVazaPlays,
    completedVazaResults,
    currentVazaPlays,
    currentLeader: leader,
  };
}

/** Valida o cenario e lanca mensagens claras para a UI exibir. */
function validate(scenario: CalcScenario): void {
  const n = RULES.numPlayers;
  const cpp = RULES.cardsPerPlayer;

  if (scenario.seat < 0 || scenario.seat >= n) {
    throw new Error(`Assento do heroi invalido: ${scenario.seat} (esperado 0..${n - 1}).`);
  }
  if (scenario.maoSeat < 0 || scenario.maoSeat >= n) {
    throw new Error(`Assento da "mao" invalido: ${scenario.maoSeat} (esperado 0..${n - 1}).`);
  }
  if (scenario.completedVazas.length > cpp) {
    throw new Error(`Vazas completas demais: ${scenario.completedVazas.length} (maximo ${cpp}).`);
  }
  scenario.completedVazas.forEach((cards, i) => {
    if (cards.length !== n) {
      throw new Error(`Vaza ${i + 1} incompleta: ${cards.length} cartas (precisa de ${n}).`);
    }
  });
  if (scenario.currentVaza.length >= n) {
    throw new Error(`Vaza atual cheia (${scenario.currentVaza.length}); ela ja estaria completa.`);
  }

  // Todas as cartas vistas devem ser distintas (vira + mao do heroi + todas as jogadas).
  const all: Card[] = [
    scenario.vira,
    ...scenario.hand,
    ...scenario.completedVazas.flat(),
    ...scenario.currentVaza,
  ];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      if (cardsEqual(all[i]!, all[j]!)) {
        throw new Error(`Carta repetida no cenario: ${cardToString(all[i]!)}.`);
      }
    }
  }
}

/**
 * Calcula a comparacao completa de chance de vitoria da mao (sem truco) para o
 * cenario dado. Lanca Error com mensagem amigavel se o cenario for inconsistente.
 */
export async function calcScenario(
  scenario: CalcScenario,
  opts: CalcOptions = {},
): Promise<CalcResult> {
  validate(scenario);

  const n = RULES.numPlayers;
  const teamOfSeat = alternatingTeams(n);
  const { completedVazaPlays, completedVazaResults, currentVazaPlays, currentLeader } =
    buildPlays(scenario, teamOfSeat);

  const view: PlayerView = {
    seat: scenario.seat,
    team: teamOfSeat[scenario.seat]!,
    hand: scenario.hand,
    vira: scenario.vira,
    manilha: manilhaRank(scenario.vira, RULES),
    rules: RULES,
    scores: new Array(RULES.numTeams).fill(0),
    teamOfSeat,
    completedVazaPlays,
    completedVazaResults,
    currentVazaPlays,
    handValue: RULES.baseValue,
    blind: false,
  };

  // Consistencia da contagem de cartas (heroi joga 1 por vaza): a mao restante deve
  // bater com cartasPorJogador - vazas em que o heroi ja jogou. Damos um erro claro
  // antes que o motor lance um mais generico.
  const acting = (currentLeader + currentVazaPlays.length) % n;
  const heroPlayedInCurrent = currentVazaPlays.some((p) => p.seat === scenario.seat);
  const heroPlayed = completedVazaPlays.length + (heroPlayedInCurrent ? 1 : 0);
  const expectedHand = RULES.cardsPerPlayer - heroPlayed;
  if (scenario.hand.length !== expectedHand) {
    throw new Error(
      `Mao do heroi tem ${scenario.hand.length} carta(s), mas o esperado e ${expectedHand} ` +
        `(${RULES.cardsPerPlayer} - ${heroPlayed} ja jogada(s) pelo heroi).`,
    );
  }

  const wopts = { samples: opts.samples ?? 3000, seed: opts.seed ?? 42, mode: "auto" as const };

  const policies = await comparePolicies(view, CALC_POLICIES, wopts);

  const heroToPlay = acting === scenario.seat;
  let doubleDummy: DoubleDummyResult | null = null;
  let singleDummy: SingleDummyResult | null = null;
  if (heroToPlay) {
    doubleDummy = analyzeDoubleDummy(view, wopts);
    singleDummy = await analyzeSingleDummy(view, { ...wopts, policy: "melhorada_5" });
  }

  return {
    manilha: view.manilha,
    acting,
    heroToPlay,
    completedResults: completedVazaResults,
    policies,
    doubleDummy,
    singleDummy,
  };
}
