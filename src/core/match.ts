/**
 * Partida (jogo): conduz maos sucessivas, acumula a pontuacao de cada equipe e
 * termina quando uma equipe atinge a pontuacao alvo (12 no Paulista).
 *
 * Define a atribuicao de assentos a equipes e a rotacao da "mao" (quem lidera)
 * a cada nova mao.
 */

import { HandObserver, HandResult, playHand } from "./hand.js";
import { Rng } from "./deck.js";
import { RuleSet } from "./rules.js";
import { Seat, TeamId } from "./types.js";
import { Player } from "../players/player.js";

/** Atribui assentos a equipes: alternado (parceiros sentam-se cruzados). */
export function assignTeams(rules: RuleSet): TeamId[] {
  return Array.from(
    { length: rules.numPlayers },
    (_, seat) => seat % rules.numTeams,
  );
}

/** Observador da partida (alem dos eventos de mao). */
export interface MatchObserver extends HandObserver {
  onMatchStart?(info: { teamOfSeat: readonly TeamId[] }): void;
  onHandStart?(info: { handNumber: number; firstSeat: Seat }): void;
  onScoreUpdate?(info: {
    result: HandResult;
    scores: readonly number[];
  }): void;
  onMatchEnd?(info: {
    winningTeam: TeamId;
    scores: readonly number[];
  }): void;
}

export interface MatchConfig {
  rules: RuleSet;
  players: readonly Player[];
  rng?: Rng;
  observer?: MatchObserver;
  /** Assento que lidera a primeira mao (default 0). */
  startSeat?: Seat;
  /** Placar inicial por equipe (default todos 0). Util para testes/demos. */
  initialScores?: readonly number[];
}

export interface MatchResult {
  winningTeam: TeamId;
  scores: number[];
  handsPlayed: number;
}

/** Conduz uma partida ate uma equipe atingir rules.pointsToWin. */
export async function playMatch(cfg: MatchConfig): Promise<MatchResult> {
  const { rules, players, observer } = cfg;
  if (players.length !== rules.numPlayers) {
    throw new Error(
      `Esperados ${rules.numPlayers} jogadores, recebidos ${players.length}.`,
    );
  }

  const teamOfSeat = assignTeams(rules);
  const scores = new Array<number>(rules.numTeams).fill(0);
  if (cfg.initialScores) {
    for (let t = 0; t < rules.numTeams; t++) {
      scores[t] = cfg.initialScores[t] ?? 0;
    }
  }
  let firstSeat: Seat = cfg.startSeat ?? 0;
  let handsPlayed = 0;

  observer?.onMatchStart?.({ teamOfSeat });

  while (Math.max(...scores) < rules.pointsToWin) {
    handsPlayed++;
    observer?.onHandStart?.({ handNumber: handsPlayed, firstSeat });

    const result = await playHand({
      rules,
      players,
      teamOfSeat,
      scores,
      firstSeat,
      rng: cfg.rng,
      observer,
    });

    if (result.winningTeam !== null) {
      scores[result.winningTeam]! += result.points;
    }
    observer?.onScoreUpdate?.({ result, scores });

    // Rotaciona a mao para o proximo assento.
    firstSeat = (firstSeat + 1) % rules.numPlayers;
  }

  // Equipe com maior pontuacao vence (a que cruzou o alvo).
  let winningTeam: TeamId = 0;
  for (let t = 1; t < scores.length; t++) {
    if (scores[t]! > scores[winningTeam]!) winningTeam = t;
  }

  observer?.onMatchEnd?.({ winningTeam, scores });
  return { winningTeam, scores, handsPlayed };
}
