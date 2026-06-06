/**
 * Arena de avaliacao: faz duas "fabricas de jogador" (contendores) se enfrentarem
 * em muitas partidas e mede o desempenho.
 *
 * Controle de variancia:
 *  - sementes comuns: a mesma lista de sementes (baralhos) e usada para todos os
 *    candidatos de uma geracao;
 *  - espelhamento: cada semente e jogada 2x, trocando os lados, para anular a
 *    sorte de carta.
 */

import { Rng } from "../core/deck.js";
import { playMatch } from "../core/match.js";
import { RuleSet } from "../core/rules.js";
import { Player } from "../players/player.js";
import { seededRng } from "./rng.js";

/** Um contendor: sabe criar um Player para um assento (com RNG proprio). */
export interface Contender {
  name: string;
  makePlayer: (seat: number, rng: Rng) => Player;
}

/** RNG estavel para o jogador de um assento numa partida (blefe reproduzivel). */
function playerRng(matchSeed: number, seat: number): Rng {
  return seededRng((matchSeed * 1000 + seat * 7 + 1) >>> 0);
}

/**
 * Joga UMA partida: teamA ocupa os assentos pares (equipe 0), teamB os impares
 * (equipe 1). Retorna a equipe vencedora e o placar.
 */
async function playOneMatch(
  teamA: Contender,
  teamB: Contender,
  rules: RuleSet,
  matchSeed: number,
): Promise<{ winningTeam: number; scores: number[] }> {
  const players: Player[] = [];
  for (let seat = 0; seat < rules.numPlayers; seat++) {
    const side = seat % 2 === 0 ? teamA : teamB;
    players.push(side.makePlayer(seat, playerRng(matchSeed, seat)));
  }
  const r = await playMatch({ rules, players, rng: seededRng(matchSeed) });
  return { winningTeam: r.winningTeam, scores: r.scores };
}

export interface ArenaStats {
  /** Taxa de vitoria do candidato (0..1). */
  winRate: number;
  /** Saldo medio de pontos (candidato - adversario) normalizado por pointsToWin. */
  avgPointDiff: number;
  /** Numero de partidas jogadas. */
  matches: number;
  /** Fitness combinado (winRate + pequeno peso no saldo). */
  fitness: number;
}

/**
 * Avalia `candidate` contra um pool de `opponents`, em todas as `seeds` e nos
 * dois lados (espelhado). Cada semente usa um adversario do pool (rotacionado).
 */
export async function evaluateContender(
  candidate: Contender,
  opponents: readonly Contender[],
  seeds: readonly number[],
  rules: RuleSet,
): Promise<ArenaStats> {
  let wins = 0;
  let matches = 0;
  let diffSum = 0;

  for (let i = 0; i < seeds.length; i++) {
    const seed = seeds[i]!;
    const opp = opponents[i % opponents.length]!;

    // Lado 1: candidato = equipe 0.
    const m1 = await playOneMatch(candidate, opp, rules, seed);
    matches++;
    if (m1.winningTeam === 0) wins++;
    diffSum += ((m1.scores[0] ?? 0) - (m1.scores[1] ?? 0)) / rules.pointsToWin;

    // Lado 2 (espelhado): candidato = equipe 1, mesma semente.
    const m2 = await playOneMatch(opp, candidate, rules, seed);
    matches++;
    if (m2.winningTeam === 1) wins++;
    diffSum += ((m2.scores[1] ?? 0) - (m2.scores[0] ?? 0)) / rules.pointsToWin;
  }

  const winRate = matches > 0 ? wins / matches : 0;
  const avgPointDiff = matches > 0 ? diffSum / matches : 0;
  return {
    winRate,
    avgPointDiff,
    matches,
    fitness: winRate + 0.02 * avgPointDiff,
  };
}

/** Desempenho do candidato contra CADA oponente do pool, separadamente. */
export interface PoolStats {
  perOpponent: { name: string; winRate: number; avgPointDiff: number }[];
  /** Menor taxa de vitoria entre os oponentes (pior caso / round-robin). */
  worstWinRate: number;
  /** Media das taxas de vitoria. */
  meanWinRate: number;
}

/**
 * Avalia o candidato contra cada membro do `pool` SEPARADAMENTE (round-robin),
 * reusando evaluateContender por oponente com as mesmas sementes. O pior caso
 * (worstWinRate) e o sinal que evita especializacao/regressao.
 */
export async function evaluateVsPool(
  candidate: Contender,
  pool: readonly Contender[],
  seeds: readonly number[],
  rules: RuleSet,
): Promise<PoolStats> {
  const perOpponent: PoolStats["perOpponent"] = [];
  for (const opp of pool) {
    const s = await evaluateContender(candidate, [opp], seeds, rules);
    perOpponent.push({ name: opp.name, winRate: s.winRate, avgPointDiff: s.avgPointDiff });
  }
  const rates = perOpponent.map((o) => o.winRate);
  const worstWinRate = rates.length ? Math.min(...rates) : 0;
  const meanWinRate = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  return { perOpponent, worstWinRate, meanWinRate };
}
